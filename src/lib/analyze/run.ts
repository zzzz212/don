// Background analyze job orchestrator. Called from /api/analyze/run
// (authenticated by INTERNAL_SECRET header). Owns the Analysis row's
// state transitions: claims PENDING atomically, sets RUNNING, drives
// analyzeContract with progress callbacks, persists final risks/score/
// summary, marks COMPLETED. Handles cancellation, failure, and budgets.

import { prisma } from "@/lib/db";
import { analyzeContract } from "@/lib/ai/analyze";
import { embedDocumentChunks } from "@/lib/document-search";
import { reportError } from "@/lib/telemetry";
import { consumeReferralBonus } from "@/lib/referral";
import { captureEvent } from "@/lib/analytics/server";
import { ensureActiveOrg } from "@/lib/org";
import { getEffectiveUserPlan } from "@/lib/plans";
import { pickStageFromProgress } from "./job";

interface ProgressCheckpoint {
  progress: number;
  stage: string;
}

/**
 * Run the background analyze job for an Analysis row that's currently
 * status=PENDING. Performs atomic claim, executes analyze, writes
 * progress, and persists results.
 *
 * Returns { claimed: false } if another worker already claimed the row
 * (multiple kick-offs racing — only one wins). Returns { claimed: true }
 * after the job either completes, fails, or is cancelled.
 */
export async function runAnalyzeJob(
  analysisId: string
): Promise<{ claimed: boolean }> {
  // 1. Atomic claim: PENDING → RUNNING, single-fire.
  const claimResult = await prisma.analysis.updateMany({
    where: { id: analysisId, status: "PENDING" },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      progress: 5,
      stage: pickStageFromProgress(5),
    },
  });
  if (claimResult.count === 0) {
    // Another worker won the race, or the row was cancelled before we got
    // here. Log + return.
    console.info(`[analyze.run] ${analysisId} not in PENDING state, skipping`);
    return { claimed: false };
  }

  // 2. Load full context for analyzeContract.
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    include: {
      document: {
        select: {
          id: true,
          userId: true,
          orgId: true,
          rawText: true,
        },
      },
    },
  });
  if (!analysis) {
    console.error(`[analyze.run] ${analysisId} disappeared after claim`);
    return { claimed: true };
  }

  const { document } = analysis;
  if (!document) {
    await markFailed(analysisId, "Document не найден");
    return { claimed: true };
  }

  try {
    // 3. Resolve plan tier (for analyze tier selector).
    const orgId =
      document.orgId ?? (await ensureActiveOrg(document.userId));
    const owner = await prisma.user.findUnique({
      where: { id: document.userId },
      select: { plan: true, trialEndsAt: true },
    });
    const effectivePlan = owner
      ? getEffectiveUserPlan(owner).plan
      : "FREE";

    // 4. Progress checkpoint helper. Each call writes status to DB +
    //    checks if the row was cancelled. If cancelled, throws to exit.
    const checkpoint = async (cp: ProgressCheckpoint): Promise<void> => {
      // Cancellation check: read current status. If CANCELLED, throw
      // a sentinel to short-circuit.
      const current = await prisma.analysis.findUnique({
        where: { id: analysisId },
        select: { status: true },
      });
      if (current?.status === "CANCELLED") {
        throw new Error("__CANCELLED__");
      }
      await prisma.analysis.update({
        where: { id: analysisId },
        data: { progress: cp.progress, stage: cp.stage },
      });
    };

    // Stage 1: chunking decision (fast)
    await checkpoint({ progress: 30, stage: pickStageFromProgress(30) });

    // Stage 2: analyzing — this is the long step (20-150s)
    await checkpoint({ progress: 50, stage: pickStageFromProgress(50) });
    const result = await analyzeContract(
      document.rawText,
      document.userId,
      orgId,
      effectivePlan
    );

    // Stage 3: synthesis happened inside analyzeContract for multi-pass;
    // for single-pass we're already done. Either way, we're at 90%.
    await checkpoint({ progress: 90, stage: pickStageFromProgress(90) });

    // Stage 4: persist final result + COMPLETED status.
    const metadata = JSON.stringify({
      contractType: result.contractType,
      parties: result.parties,
      verdict: result.verdict,
      verdictReason: result.verdictReason,
      notarization: result.notarization,
      registration: result.registration,
      missingClauses: result.missingClauses,
      preSigningChecklist: result.preSigningChecklist,
      isDemo: result.isDemo ?? false,
    });

    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        score: result.score,
        summary: result.summary,
        risks: JSON.stringify(result.risks),
        metadata,
        status: "COMPLETED",
        progress: 100,
        stage: pickStageFromProgress(100),
        finishedAt: new Date(),
        errorMessage: null,
      },
    });

    // 5. Post-completion side effects (fire-and-forget).
    void embedDocumentChunks(document.id, document.rawText).catch((e) => {
      reportError(e, {
        op: "analyze.run.embed-chunks",
        userId: document.userId,
        extra: { documentId: document.id },
      });
    });

    void captureEvent({
      userId: document.userId,
      orgId,
      event: "analysis_completed",
      properties: {
        textLength: document.rawText.length,
        score: result.score,
        risksCount: result.risks?.length ?? 0,
        savedToDb: true,
        viaDurableJob: true,
      },
    });

    if (orgId) {
      await consumeReferralBonus(orgId);
    }

    return { claimed: true };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "__CANCELLED__") {
      // User cancelled mid-flight; status is already CANCELLED, just exit.
      console.info(`[analyze.run] ${analysisId} cancelled by user`);
      return { claimed: true };
    }
    await markFailed(analysisId, msg || "Неизвестная ошибка");
    await reportError(err, {
      op: "analyze.run",
      extra: { analysisId },
    });
    return { claimed: true };
  }
}

async function markFailed(analysisId: string, errorMessage: string): Promise<void> {
  await prisma.analysis.update({
    where: { id: analysisId },
    data: {
      status: "FAILED",
      errorMessage: errorMessage.slice(0, 500),
      finishedAt: new Date(),
    },
  });
}
