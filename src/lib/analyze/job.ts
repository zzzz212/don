// Pure types + helpers for the durable analyze job system.
// Server logic lives in run.ts and the API routes; this file is
// dependency-free (no Prisma, no fetch) so it can be imported from
// client components for shared TypeScript types.

export type AnalysisJobStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type AnalysisJobStage =
  | "parsing"
  | "chunking"
  | "analyzing"
  | "synthesizing"
  | "saving";

// What client sees in /api/analyze/active and /api/analyze/[id]/status.
// Server-side dates are serialised as ISO strings.
export interface AnalysisJobView {
  analysisId: string;
  documentId: string;
  fileName: string;
  status: AnalysisJobStatus;
  stage: string | null;
  progress: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

// Stage label derived from progress percentage. Used by the worker to
// stamp a human-readable stage alongside each progress write, and by
// the client UI as fallback when stage column is null.
export function pickStageFromProgress(progress: number): AnalysisJobStage {
  if (progress < 30) return "parsing";
  if (progress < 50) return "chunking";
  if (progress < 85) return "analyzing";
  if (progress < 95) return "synthesizing";
  return "saving";
}

// Thresholds for the stuck-job cron. PENDING > 30s = the kick-off
// fetch likely failed; restart it. RUNNING > 30 min = worker died
// silently (Vercel function timeout, OOM, etc.); mark FAILED.
export const STUCK_PENDING_MS = 30_000;
export const STUCK_RUNNING_MS = 30 * 60 * 1000;
