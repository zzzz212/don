import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildTrialExpiringEmail } from "@/lib/email/templates/trial-expiring";
import { buildTrialExpiredEmail } from "@/lib/email/templates/trial-expired";
import { logAudit } from "@/lib/audit";
import { reportError } from "@/lib/telemetry";

// Daily cron — fires lifecycle emails around the trial boundary.
// Scheduled via vercel.json crons[].schedule "0 9 * * *" (09:00 UTC =
// midday Moscow). Idempotent: the dedup check against AuditEvent
// means re-running this within 24h won't re-send anything.
//
// Authentication: Vercel signs cron requests with the project's
// CRON_SECRET. Production must have CRON_SECRET set; dev / preview
// can call the endpoint directly with the same header for testing.
//
// Why this matters for revenue: TRIAL_DAYS = 2. Without these two
// nudges (warning at day 1, "your trial ended" at day 0), trial→paid
// conversion sits where it sits. Industry benchmark says properly-
// timed expiry reminders lift conversion by 25-45%. This is the
// single biggest revenue lever we have once acquisition is solved.

// Vercel cron sends Authorization: Bearer <CRON_SECRET>. Manual / curl
// calls during dev should mimic the same header. The check rejects
// anonymous requests in production but allows them in dev for ease of
// local testing.
function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured — only allow in non-prod environments.
    // Production must always configure CRON_SECRET; otherwise the
    // endpoint would be open to anyone who guessed the path.
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// Dedup window: don't re-send a "trial expiring" email to the same
// user within the last N days. 14 days is long enough that even if
// the cron runs twice a day for some reason, no user gets pinged
// twice for the same trial; short enough that a user who reactivated
// trial after some lifecycle action (admin extension) can get a
// fresh nudge.
const DEDUP_WINDOW_DAYS = 14;

interface RunResult {
  expiringSent: number;
  expiredSent: number;
  expiringSkipped: number;
  expiredSkipped: number;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const result = await runBillingReminders(now);
    return NextResponse.json({ ok: true, ranAt: now.toISOString(), ...result });
  } catch (error) {
    await reportError(error, { op: "cron.billing-reminders" });
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}

async function runBillingReminders(now: Date): Promise<RunResult> {
  const dedupSince = new Date(
    now.getTime() - DEDUP_WINDOW_DAYS * MS_PER_DAY
  );

  // ── Stage 1: "trial expiring" — trialEndsAt in (now, now + 24h]
  const expiringStart = now;
  const expiringEnd = new Date(now.getTime() + 24 * MS_PER_HOUR);
  const expiringCandidates = await prisma.user.findMany({
    where: {
      // Only users still on FREE — paid users don't need the nudge.
      plan: "FREE",
      trialEndsAt: { gt: expiringStart, lte: expiringEnd },
    },
    select: {
      id: true,
      email: true,
      name: true,
      trialEndsAt: true,
    },
  });

  let expiringSent = 0;
  let expiringSkipped = 0;
  for (const user of expiringCandidates) {
    if (!user.trialEndsAt || !user.email) {
      expiringSkipped += 1;
      continue;
    }
    const recentSend = await prisma.auditEvent.findFirst({
      where: {
        userId: user.id,
        action: "email.trial_expiring_sent",
        createdAt: { gte: dedupSince },
      },
      select: { id: true },
    });
    if (recentSend) {
      expiringSkipped += 1;
      continue;
    }

    // Fire-and-forget email; sendEmail never throws.
    await sendEmail(
      buildTrialExpiringEmail({
        to: user.email,
        name: user.name,
        trialEndsAt: user.trialEndsAt.toISOString(),
      })
    );
    await logAudit({
      orgId: null,
      userId: user.id,
      action: "email.trial_expiring_sent",
      target: user.id,
      targetType: "user",
      payload: {
        trialEndsAt: user.trialEndsAt.toISOString(),
      },
    });
    expiringSent += 1;
  }

  // ── Stage 2: "trial expired" — trialEndsAt in (now - 24h, now]
  // We catch users whose trial ended within the last day (the daily
  // cadence guarantees at-most-once delivery without a strict equality
  // check).
  const expiredStart = new Date(now.getTime() - 24 * MS_PER_HOUR);
  const expiredEnd = now;
  const expiredCandidates = await prisma.user.findMany({
    where: {
      plan: "FREE",
      trialEndsAt: { gt: expiredStart, lte: expiredEnd },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  let expiredSent = 0;
  let expiredSkipped = 0;
  for (const user of expiredCandidates) {
    if (!user.email) {
      expiredSkipped += 1;
      continue;
    }
    const recentSend = await prisma.auditEvent.findFirst({
      where: {
        userId: user.id,
        action: "email.trial_expired_sent",
        createdAt: { gte: dedupSince },
      },
      select: { id: true },
    });
    if (recentSend) {
      expiredSkipped += 1;
      continue;
    }

    await sendEmail(
      buildTrialExpiredEmail({
        to: user.email,
        name: user.name,
      })
    );
    await logAudit({
      orgId: null,
      userId: user.id,
      action: "email.trial_expired_sent",
      target: user.id,
      targetType: "user",
      payload: {},
    });
    expiredSent += 1;
  }

  return {
    expiringSent,
    expiredSent,
    expiringSkipped,
    expiredSkipped,
  };
}
