import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { kickOffBackgroundAnalyze } from "@/lib/analyze/kick-off";
import { reportError } from "@/lib/telemetry";
import { STUCK_PENDING_MS, STUCK_RUNNING_MS } from "@/lib/analyze/job";

// Health-check cron. Runs every 5 minutes. Two recovery paths:
//
// 1. Status=PENDING for > 30 seconds. The kick-off fetch likely failed
//    (cold start race, network drop). Retry the kick-off — worker's
//    atomic claim ensures even if the original kick-off DID succeed
//    and is now running, the retry won't double-process.
//
// 2. Status=RUNNING for > 30 minutes. The worker died silently (Vercel
//    function timeout, OOM, transient infra error). Mark the row FAILED
//    with an explanatory errorMessage so the user can retry.
//
// Idempotent: re-running within the window is safe. Audited via Sentry
// on failures.

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();
    const pendingThreshold = new Date(now - STUCK_PENDING_MS);
    const runningThreshold = new Date(now - STUCK_RUNNING_MS);

    // Find stuck PENDING rows
    const stuckPending = await prisma.analysis.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: pendingThreshold },
      },
      select: { id: true },
      take: 50,
    });
    let kicked = 0;
    for (const row of stuckPending) {
      void kickOffBackgroundAnalyze(row.id);
      kicked++;
    }

    // Find stuck RUNNING rows — mark FAILED
    const failResult = await prisma.analysis.updateMany({
      where: {
        status: "RUNNING",
        startedAt: { lt: runningThreshold },
      },
      data: {
        status: "FAILED",
        errorMessage:
          "Анализ занял слишком много времени. Возможно, документ слишком сложный или превысил лимит вашего тарифа. Попробуйте ещё раз или обновитесь до тарифа «Про».",
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({
      kickedPending: kicked,
      markedFailed: failResult.count,
    });
  } catch (error) {
    await reportError(error, { op: "cron.restart-stuck-analyses" });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
