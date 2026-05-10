import { NextRequest, NextResponse } from "next/server";
import { applySucceededPayment, markPaymentCanceled } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";
import { captureEvent } from "@/lib/analytics/server";

// POST /api/billing/webhook  (called by ЮKassa)
//
// We do not trust the payload as-is: applySucceededPayment() re-fetches
// the payment via the ЮKassa API to confirm status before mutating any
// state. So even an attacker forging a "succeeded" body would only get
// a no-op rejection. Add IP allowlisting (185.71.76.0/27, 185.71.77.0/27,
// 77.75.153.0/25, 77.75.156.11, 77.75.156.35, 77.75.154.128/25) at the
// platform layer for defence in depth.
//
// Idempotence is guaranteed at the data layer:
//   • Payment row is keyed by providerPaymentId (unique)
//   • applySucceededPayment short-circuits if Payment.status is already
//     SUCCEEDED.
// So ЮKassa retrying the webhook (which they do on non-200) is safe.

interface YookassaNotification {
  type?: string;
  event?: string;
  object?: {
    id?: string;
    status?: string;
    cancellation_details?: { reason?: string };
  };
}

export async function POST(request: NextRequest) {
  let body: YookassaNotification;
  try {
    body = (await request.json()) as YookassaNotification;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event ?? "";
  const paymentId = body.object?.id;

  if (!paymentId) {
    return NextResponse.json(
      { error: "Missing payment id" },
      { status: 400 }
    );
  }

  try {
    if (event === "payment.succeeded") {
      const result = await applySucceededPayment(paymentId);
      if (result.ok) {
        // Re-read the payment to attach userId/orgId/plan for analytics.
        const persisted = await prisma.payment.findUnique({
          where: { providerPaymentId: paymentId },
          select: { userId: true, orgId: true, plan: true, amountKopecks: true },
        });
        if (persisted) {
          void captureEvent({
            userId: persisted.userId,
            orgId: persisted.orgId,
            event: "payment_succeeded",
            properties: {
              plan: persisted.plan,
              amountRub: Math.round(persisted.amountKopecks / 100),
            },
          });
        }
      }
      if (!result.ok) {
        // Don't return 5xx for "status not actually succeeded" — that's
        // a legitimate no-op (e.g. notification arrived before the
        // capture step actually finished server-side, very rare). 200
        // tells ЮKassa "received", and we'll see the real succeeded
        // notification next.
        await reportError(new Error(`webhook no-op: ${result.reason}`), {
          op: "billing.webhook",
          tags: { event, paymentId },
        });
      }
      return NextResponse.json({ ok: true });
    }

    if (event === "payment.canceled" || event === "payment.failed") {
      await markPaymentCanceled(
        paymentId,
        body.object?.cancellation_details?.reason
      );
      const persisted = await prisma.payment.findUnique({
        where: { providerPaymentId: paymentId },
        select: { userId: true, orgId: true, plan: true },
      });
      if (persisted) {
        void captureEvent({
          userId: persisted.userId,
          orgId: persisted.orgId,
          event: "payment_failed",
          properties: {
            plan: persisted.plan,
            reason: body.object?.cancellation_details?.reason ?? event,
          },
        });
      }
      return NextResponse.json({ ok: true });
    }

    if (event === "payment.waiting_for_capture") {
      // Auto-capture is on (capture: true in createPayment) — this state
      // shouldn't normally land for our flow. Acknowledge silently.
      return NextResponse.json({ ok: true });
    }

    // Unknown event — acknowledge with 200 so ЮKassa doesn't keep
    // retrying. Log so we know if something new appears.
    await reportError(new Error(`unhandled webhook event: ${event}`), {
      op: "billing.webhook",
      tags: { event, paymentId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportError(error, {
      op: "billing.webhook",
      tags: { event, paymentId: paymentId ?? "unknown" },
    });
    // Return 5xx so ЮKassa retries the webhook later — better than
    // silent state divergence.
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ЮKassa fires GET sometimes during their setup health-check.
export async function GET() {
  return NextResponse.json({ ok: true });
}
