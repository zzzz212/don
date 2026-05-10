// Public billing API. Routes call these functions; no route ever touches
// YookassaClient directly. Keeps provider concerns isolated and makes the
// future "swap to Stripe for foreign customers" change a single-file edit.
//
// State model:
//   POST /api/billing/checkout   → createCheckoutSession()
//     • inserts Payment(status=PENDING) with a fresh idempotence key
//     • calls ЮKassa createPayment
//     • stores providerPaymentId, returns confirmation URL
//   POST /api/billing/webhook    → applySucceededPayment()
//     • idempotent: re-fetches payment from ЮKassa, only flips state on
//       a *real* succeeded status
//     • marks Payment(status=SUCCEEDED), upserts Subscription, bumps
//       Organization.plan, clears trialEndsAt, emits receipt email

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildSubscriptionActivatedEmail } from "@/lib/email/templates/subscription-activated";
import {
  BRAND,
  PRICING_KOPECKS,
  PRICING_RUB,
  type PaidPlan,
  isPaidPlan,
} from "@/lib/legal-info";
import { reportError } from "@/lib/telemetry";
import { YookassaClient, kopecksToYookassaValue } from "./yookassa";

export interface CheckoutSessionInput {
  orgId: string;
  userId: string;
  userEmail: string;
  plan: PaidPlan;
  /** Absolute return URL — user lands here after the ЮKassa hosted page. */
  returnUrl: string;
  /** When true, ЮKassa saves the payment method for future auto-renewals. */
  savePaymentMethod?: boolean;
}

export interface CheckoutSession {
  /** Internal Payment.id — caller can poll status with this. */
  paymentId: string;
  /** ЮKassa confirmation URL — frontend redirects browser to it. */
  confirmationUrl: string;
}

export interface BillingProviderUnavailableError extends Error {
  code: "PROVIDER_UNAVAILABLE";
}

class BillingError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "PROVIDER_UNAVAILABLE"
      | "INVALID_PLAN"
      | "ALREADY_PAID"
      | "NO_CONFIRMATION_URL"
  ) {
    super(message);
    this.name = "BillingError";
  }
}
export { BillingError };

export const PERIOD_MONTHS = 1;

function periodEnd(start: Date, months: number): Date {
  const d = new Date(start);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * Build a description string used in the ЮKassa dashboard and on the
 * receipt — not user-facing email copy. Keep it short and stable so
 * support can grep for it.
 */
function describePurchase(plan: PaidPlan, orgName: string): string {
  const planLabel = plan === "PRO" ? "«Про»" : "«Бизнес»";
  // ЮKassa caps description at 128 chars.
  return `${BRAND.name} — тариф ${planLabel}, 1 мес. (${orgName})`.slice(0, 128);
}

/**
 * Begin a checkout. Inserts a PENDING Payment, calls ЮKassa, returns the
 * URL the user should be redirected to. Never charges anything until
 * the user completes the hosted form.
 */
export async function createCheckoutSession(
  input: CheckoutSessionInput
): Promise<CheckoutSession> {
  const client = YookassaClient.fromEnv();
  if (!client) {
    throw new BillingError(
      "Платежи временно недоступны. Свяжитесь с поддержкой.",
      "PROVIDER_UNAVAILABLE"
    );
  }

  if (!isPaidPlan(input.plan)) {
    throw new BillingError("Неизвестный тариф", "INVALID_PLAN");
  }

  const amountKopecks = PRICING_KOPECKS[input.plan];

  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { id: true, name: true },
  });
  if (!org) {
    throw new BillingError("Workspace не найден", "INVALID_PLAN");
  }

  // Fresh idempotence key per checkout — prevents the same intent from
  // being charged twice across retries within ЮKassa's window.
  const idempotenceKey = randomUUID();

  // Insert Payment row first so we have an internal id to put into
  // metadata (handy when staring at ЮKassa dashboard).
  const payment = await prisma.payment.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      amountKopecks,
      currency: "RUB",
      plan: input.plan,
      periodMonths: PERIOD_MONTHS,
      status: "PENDING",
      idempotenceKey,
      customerEmail: input.userEmail.toLowerCase().trim(),
    },
  });

  let yookassaPayment;
  try {
    yookassaPayment = await client.createPayment({
      amountKopecks,
      description: describePurchase(input.plan, org.name),
      returnUrl: input.returnUrl,
      idempotenceKey,
      savePaymentMethod: input.savePaymentMethod,
      metadata: {
        paymentId: payment.id,
        orgId: input.orgId,
        userId: input.userId,
        plan: input.plan,
      },
      receipt: {
        customer: { email: input.userEmail },
        items: [
          {
            description: describePurchase(input.plan, org.name),
            quantity: "1",
            amount: {
              value: kopecksToYookassaValue(amountKopecks),
              currency: "RUB",
            },
            vat_code: 1, // НДС не облагается (УСН)
            payment_mode: "full_payment",
            payment_subject: "service",
          },
        ],
      },
    });
  } catch (e) {
    // Provider failed — mark the payment as FAILED so it doesn't sit
    // pending forever in our DB.
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureReason:
          e instanceof Error ? e.message.slice(0, 500) : "unknown",
      },
    });
    throw e;
  }

  // Store the provider id immediately — webhooks arrive faster than you'd
  // expect, sometimes before the create-payment HTTP response is even
  // processed by Vercel's edge.
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerPaymentId: yookassaPayment.id,
      status: yookassaPayment.status === "succeeded"
        ? "SUCCEEDED"
        : yookassaPayment.status === "waiting_for_capture"
          ? "WAITING_FOR_CAPTURE"
          : "PENDING",
    },
  });

  if (!yookassaPayment.confirmation?.confirmation_url) {
    throw new BillingError(
      "ЮKassa не вернула URL подтверждения",
      "NO_CONFIRMATION_URL"
    );
  }

  return {
    paymentId: payment.id,
    confirmationUrl: yookassaPayment.confirmation.confirmation_url,
  };
}

/**
 * Apply a succeeded payment to the workspace: upsert Subscription, bump
 * Organization.plan, clear trial, and send receipt. Idempotent on
 * (paymentId, status). Re-fetches from ЮKassa to defeat spoofed webhooks.
 */
export async function applySucceededPayment(
  providerPaymentId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const client = YookassaClient.fromEnv();
  if (!client) {
    return { ok: false, reason: "PROVIDER_UNAVAILABLE" };
  }

  // Re-fetch authoritatively. Any caller (webhook, admin retry) goes
  // through the same path — we never trust the body of an inbound
  // notification.
  const yookassaPayment = await client.getPayment(providerPaymentId);

  if (yookassaPayment.status !== "succeeded") {
    return { ok: false, reason: `status=${yookassaPayment.status}` };
  }

  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId },
  });
  if (!payment) {
    await reportError(
      new Error(`Webhook for unknown providerPaymentId ${providerPaymentId}`),
      { op: "billing.apply", tags: { providerPaymentId } }
    );
    return { ok: false, reason: "UNKNOWN_PAYMENT" };
  }

  // Already applied? Idempotency guard.
  if (payment.status === "SUCCEEDED") {
    return { ok: true };
  }

  if (!isPaidPlan(payment.plan)) {
    return { ok: false, reason: "INVALID_PLAN" };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const periodStart = now;
    const periodEndAt = periodEnd(periodStart, payment.periodMonths);

    // Upsert subscription. If the org has a prior CANCELED sub, this
    // reactivates it with new period boundaries.
    await tx.subscription.upsert({
      where: { orgId: payment.orgId },
      create: {
        orgId: payment.orgId,
        plan: payment.plan,
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEndAt,
        provider: "yookassa",
        providerPaymentMethodId:
          yookassaPayment.payment_method?.saved &&
          yookassaPayment.payment_method.id
            ? yookassaPayment.payment_method.id
            : null,
      },
      update: {
        plan: payment.plan,
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
        canceledAt: null,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEndAt,
        providerPaymentMethodId:
          yookassaPayment.payment_method?.saved &&
          yookassaPayment.payment_method.id
            ? yookassaPayment.payment_method.id
            : undefined,
      },
    });

    // Re-link the Payment to the Subscription.
    const sub = await tx.subscription.findUnique({
      where: { orgId: payment.orgId },
      select: { id: true },
    });

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        succeededAt: now,
        subscriptionId: sub?.id ?? null,
      },
    });

    // Promote the workspace to the paid plan and burn any active trial
    // — they paid, no need to keep gifting them PRO via trial flag.
    await tx.organization.update({
      where: { id: payment.orgId },
      data: {
        plan: payment.plan,
        trialEndsAt: null,
      },
    });
  });

  // Receipt — fire-and-forget; receipt is also delivered by ЮKassa via 54-ФЗ.
  void sendEmail(
    buildSubscriptionActivatedEmail({
      to: payment.customerEmail,
      plan: payment.plan as PaidPlan,
      amountRub:
        payment.plan === "PRO" ? PRICING_RUB.PRO : PRICING_RUB.BUSINESS,
      periodEnd: periodEnd(now, payment.periodMonths).toISOString(),
    })
  );

  return { ok: true };
}

/** Mark a payment as canceled/failed when the user abandons the form. */
export async function markPaymentCanceled(
  providerPaymentId: string,
  reason?: string
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId },
  });
  if (!payment || payment.status === "SUCCEEDED") return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "CANCELED",
      failureReason: reason?.slice(0, 500),
    },
  });
}

export function isBillingConfigured(): boolean {
  return YookassaClient.fromEnv() !== null;
}
