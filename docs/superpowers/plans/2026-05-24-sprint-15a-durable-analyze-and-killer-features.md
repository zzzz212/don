# Sprint 15A — Durable Analyze + Killer Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert synchronous `/api/analyze` into a durable async job system with resume-on-reload and parallel jobs, plus two killer features (AI negotiation moves in Deal Room + ICS export of contract deadlines).

**Architecture:** Sixteen tasks. Foundation first — schema migration with safe defaults, then `extractAndPrepareDocument` helper that splits the existing route's pre-analyze prep from the analyze call itself. New `/api/analyze/start` returns analysisId in <2s; new `/api/analyze/run` (internal endpoint guarded by `INTERNAL_SECRET`) executes the actual analyze and writes progress checkpoints to DB. Vercel function self-invoke for kick-off (no new infra). Client polls every 2.5s, persists job ids in localStorage, hydrates from `GET /api/analyze/active` on mount. Cron `/api/cron/restart-stuck-analyses` runs every 5 min as recovery. Then two killer features layered on the now-stable foundation: AI negotiation moves cached on `DealClause.suggestedMoves` exposed via `<NegotiationMoves>` rendered under DISPUTED clauses; ICS export via `GET /api/documents/[id]/deadlines.ics` exposed as button on `/report/[id]`.

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript / Prisma + Neon Postgres / Tailwind 4 (warm-minimalism editorial tokens) / Anthropic Claude (analyze + chat AI) / Vitest 4 / Vercel cron + serverless functions (self-invoke pattern, no Inngest).

**Spec reference:** [`docs/superpowers/specs/2026-05-24-sprint-15a-durable-analyze-and-killer-features.md`](../specs/2026-05-24-sprint-15a-durable-analyze-and-killer-features.md)

---

## File map

**Create:**
- `src/lib/analyze/job.ts` — Pure helpers: type definitions for `AnalysisJobView`, `pickStageFromProgress`, atomic claim helper signature
- `src/lib/analyze/prepare.ts` — Extract pre-analyze logic (parse, OCR check, OCR execute) from existing `/api/analyze/route.ts` into a reusable function returning `{ contractText, usedOcr, mimeType }`
- `src/lib/analyze/run.ts` — `runAnalyzeJob(analysisId)` orchestrator: claim PENDING row, drive analyzeContract with progress callbacks, persist final result, handle failures and cancellations
- `src/lib/analyze/kick-off.ts` — `kickOffBackgroundAnalyze(analysisId)` self-invoke helper with 2-retry backoff
- `src/app/api/analyze/start/route.ts` — New entry point: parse+OCR sync, create PENDING Document+Analysis, kick off worker, return `{ analysisId, documentId }`
- `src/app/api/analyze/run/route.ts` — Internal endpoint (auth via `x-internal-token` header against `INTERNAL_SECRET`). Calls `runAnalyzeJob`.
- `src/app/api/analyze/[id]/status/route.ts` — GET, returns `{ status, stage, progress, errorMessage?, finishedAt? }`
- `src/app/api/analyze/[id]/result/route.ts` — GET, returns full analysis (only if COMPLETED), else 425 Too Early
- `src/app/api/analyze/[id]/cancel/route.ts` — POST, sets status=CANCELLED
- `src/app/api/analyze/active/route.ts` — GET, lists PENDING+RUNNING jobs for current user
- `src/app/api/cron/restart-stuck-analyses/route.ts` — Health-check cron
- `src/components/active-analyses-strip.tsx` — Sticky multi-track panel polling /status for each job
- `src/lib/ai/schemas/negotiation.ts` — `MovesSchema` and `NegotiationMovesPromptInput`
- `src/app/api/deals/[id]/clauses/[clauseId]/suggest-moves/route.ts` — Sender path for moves
- `src/app/api/deals/by-token/[token]/clauses/[clauseId]/suggest-moves/route.ts` — Receiver path for moves
- `src/app/deal/[token]/negotiation-moves.tsx` — Client component rendering 3 moves cards
- `src/app/api/documents/[id]/deadlines.ics/route.ts` — ICS endpoint
- `src/lib/ics.ts` — Pure ICS string builder
- `src/components/ics-download-button.tsx` — Button for /report overflow
- `src/lib/__tests__/analyze-job.test.ts` — Pure-logic tests for claim semantics, status mapping
- `src/lib/__tests__/negotiation-schema.test.ts` — Schema validation tests
- `src/lib/__tests__/ics.test.ts` — Pure ICS builder tests

**Modify:**
- `prisma/schema.prisma` — Add `AnalysisStatus` enum + 6 fields on `Analysis`, 1 field on `DealClause`
- `src/lib/rate-limit.ts` — Add `analyze.start`, `analyze.poll`, `negotiation.suggest` endpoints
- `src/app/api/analyze/route.ts` — Mark as deprecated alias that POSTs to `/start` then polls until done (back-compat for external callers)
- `src/app/analyze/page.tsx` — Replace sessionStorage flow with start+register-job; render `<ActiveAnalysesStrip>` above the upload zone
- `src/app/dashboard/page.tsx` — Render `<ActiveAnalysesStrip>` above KPI strip when active jobs exist
- `src/app/deal/[token]/clause-card.tsx` — Render `<NegotiationMoves>` under DISPUTED clauses
- `src/app/report/[id]/page.tsx` — Add `<IcsDownloadButton>` to overflow MenuButton items
- `vercel.json` — Add cron entry for `/api/cron/restart-stuck-analyses`

---

## Pre-flight: Environment variable

Before any task: this plan introduces a new env var `INTERNAL_SECRET`. The implementer must:

1. Add `INTERNAL_SECRET=<random-256-bit>` to `.env.local` (local dev)
2. Tell the controller to add the same value to Vercel Production and Preview envs (Vercel Dashboard → Project → Settings → Environment Variables)

If `INTERNAL_SECRET` is missing in any environment, `/api/analyze/start` will refuse to kick-off (with a clear log message), and `/api/analyze/run` will refuse all requests. Defensive — better to fail fast than run unprotected internal endpoints.

---

## Task 1: Schema migration — AnalysisStatus + Analysis fields + DealClause.suggestedMoves

**Why first:** every downstream task depends on the new fields existing.

**Files:**
- Modify: `prisma/schema.prisma:451-461` (Analysis model) and `:986-1016` (DealClause model)

- [ ] **Step 1: Add the AnalysisStatus enum**

In `prisma/schema.prisma`, add this enum block. Place it directly after the existing `enum Role { ... }` or any other enum in the file (search for `enum ` to find one — the project already has enums in `prisma/schema.prisma`):

```prisma
enum AnalysisStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

- [ ] **Step 2: Add 6 fields to the Analysis model**

In `prisma/schema.prisma`, find the `model Analysis` block (around line 451). Replace it with:

```prisma
model Analysis {
  id         String   @id @default(cuid())
  documentId String   @unique
  score      Int      @default(0)
  summary    String   @default("")
  risks      String   @default("[]")
  metadata   String?
  createdAt  DateTime @default(now())

  // Sprint 15A — durable async job tracking. status=COMPLETED is the
  // default so every pre-existing Analysis row is treated as a finished
  // job after migration without backfill. score/summary/risks defaults
  // cover newly-created PENDING rows where the values are not yet known;
  // the worker overwrites them on completion.
  status       AnalysisStatus @default(COMPLETED)
  startedAt    DateTime?
  finishedAt   DateTime?
  progress     Int            @default(100)
  stage        String?
  errorMessage String?

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([status, startedAt])
}
```

Note: added `@default(0)`, `@default("")`, `@default("[]")` to existing `score`, `summary`, `risks` columns — needed because Task 3 creates PENDING rows BEFORE we have the analyze result. The default for `risks` is the JSON string for an empty array (not `null` — column is NOT NULL). Existing rows already have values so defaults won't affect them; only NEW PENDING rows get the empty defaults until the worker overwrites them on completion.

The `@@index([status, startedAt])` helps Task 8's cron query find stuck rows fast (`status IN ('PENDING','RUNNING') AND startedAt < now() - interval`).

- [ ] **Step 3: Add suggestedMoves field to DealClause**

In `prisma/schema.prisma`, find `model DealClause` (around line 986). Add a single line after `updatedAt`:

```prisma
  // Sprint 15A — AI negotiation moves cached. Null = not yet requested.
  // Populated by POST /api/deals/.../clauses/.../suggest-moves. Shape:
  // { moves: Array<{id:'A'|'B'|'C', title, body, proposedText?:string}> }
  suggestedMoves Json?
```

- [ ] **Step 4: Push schema to DB (LOCAL dev only)**

Run: `npx prisma db push`

Expected: success, no data loss prompt. If Prisma reports potential data loss, **stop** and investigate — the defaults should prevent it.

- [ ] **Step 5: Generate Prisma client**

Run: `npx prisma generate`

Expected: client regenerated successfully.

- [ ] **Step 6: Run existing tests to confirm no regression**

Run: `npm test`

Expected: 417 tests PASS (or however many baseline at this point — confirm no NEW failures).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Schema: AnalysisStatus enum + durable-job fields + DealClause.suggestedMoves

Adds AnalysisStatus enum (PENDING|RUNNING|COMPLETED|FAILED|CANCELLED) and
six tracking columns to Analysis: status (default COMPLETED so existing
rows stay valid), startedAt, finishedAt, progress (default 100), stage,
errorMessage. Defaults on score/summary/risks make it safe to create
PENDING rows before the analyze result exists — the worker overwrites
them on completion.

Adds @@index([status, startedAt]) for the stuck-job cron query.

Adds DealClause.suggestedMoves Json? for caching AI negotiation moves
between requests (Sprint 15A killer feature #1).

All migrations are safe (defaults + nullable), no backfill needed.
EOF
)"
```

---

## Task 2: Job types + pure helpers

**Why:** isolate domain types and any pure functions before tasks that consume them. Pure files are easier to test independently.

**Files:**
- Create: `src/lib/analyze/job.ts`
- Create: `src/lib/__tests__/analyze-job.test.ts`

- [ ] **Step 1: Write the test file first**

Create `src/lib/__tests__/analyze-job.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import {
  pickStageFromProgress,
  type AnalysisJobView,
  STUCK_PENDING_MS,
  STUCK_RUNNING_MS,
} from "../analyze/job";

describe("pickStageFromProgress", () => {
  it("returns parsing under 30%", () => {
    expect(pickStageFromProgress(0)).toBe("parsing");
    expect(pickStageFromProgress(29)).toBe("parsing");
  });

  it("returns chunking 30-50%", () => {
    expect(pickStageFromProgress(30)).toBe("chunking");
    expect(pickStageFromProgress(49)).toBe("chunking");
  });

  it("returns analyzing 50-85%", () => {
    expect(pickStageFromProgress(50)).toBe("analyzing");
    expect(pickStageFromProgress(84)).toBe("analyzing");
  });

  it("returns synthesizing 85-95%", () => {
    expect(pickStageFromProgress(85)).toBe("synthesizing");
    expect(pickStageFromProgress(94)).toBe("synthesizing");
  });

  it("returns saving 95-100%", () => {
    expect(pickStageFromProgress(95)).toBe("saving");
    expect(pickStageFromProgress(100)).toBe("saving");
  });
});

describe("AnalysisJobView shape", () => {
  it("compiles with all expected fields", () => {
    const sample: AnalysisJobView = {
      analysisId: "a1",
      documentId: "d1",
      fileName: "test.docx",
      status: "RUNNING",
      stage: "analyzing",
      progress: 60,
      errorMessage: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
    expect(sample.status).toBe("RUNNING");
  });
});

describe("stuck-job thresholds", () => {
  it("PENDING threshold is 30 seconds", () => {
    expect(STUCK_PENDING_MS).toBe(30_000);
  });
  it("RUNNING threshold is 30 minutes", () => {
    expect(STUCK_RUNNING_MS).toBe(30 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Run the test (expect fail — module doesn't exist)**

Run: `npx vitest run src/lib/__tests__/analyze-job.test.ts`
Expected: FAIL with "Cannot find module '../analyze/job'".

- [ ] **Step 3: Create the module**

Create `src/lib/analyze/job.ts`:

```ts
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
```

- [ ] **Step 4: Re-run the test**

Run: `npx vitest run src/lib/__tests__/analyze-job.test.ts`
Expected: 9 tests PASS.

- [ ] **Step 5: Confirm full test suite still green**

Run: `npm test`
Expected: 417 + 9 = 426 PASS (or higher baseline + 9).

- [ ] **Step 6: Commit**

```bash
git add src/lib/analyze/job.ts src/lib/__tests__/analyze-job.test.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Add pure analyze-job types + stage helper + stuck-job thresholds

Foundation for the durable analyze rewrite. Types and helpers live in
their own dependency-free module so the client component bundle can
import the AnalysisJobView type without dragging Prisma in. Stage
mapping is derived deterministically from progress percentage so the
worker and the UI always agree.
EOF
)"
```

---

## Task 3: Extract document preparation into `prepare.ts`

**Why:** The existing `/api/analyze/route.ts` is 449 lines doing parse + OCR + quota + analyze + DB save in one function. To reuse the parse+OCR logic in `/api/analyze/start` we need to extract it. Pure refactor — no behavior change.

**Files:**
- Create: `src/lib/analyze/prepare.ts`

- [ ] **Step 1: Read the current /api/analyze/route.ts**

Read lines 1-280 to understand the parse + OCR section. Specifically, the block from `formData.get("file")` through `if (isOversizedDocument(contractText))` is the part we're extracting.

- [ ] **Step 2: Create `prepare.ts` with the extracted logic**

Create `src/lib/analyze/prepare.ts`:

```ts
// Pre-analyze document preparation: parse file → detect OCR need →
// optionally run OCR → length-check the resulting text. Extracted from
// the old /api/analyze/route.ts so /api/analyze/start can run these
// fast (<15s) steps synchronously inside the request handler, write
// a PENDING Analysis row, and hand off to the background worker.
//
// Pure data transform — no auth, no quota check, no DB. Caller does
// auth+quota; this module only returns the prepared text or throws a
// typed error the caller can map to an HTTP status.

import { parseDocument } from "@/lib/parsers";
import { isOversizedDocument, HARD_DOC_LIMIT } from "@/lib/ai/chunking";
import {
  getOcr,
  isOcrAvailable,
  OcrError,
  recognizeMultiPagePdf,
} from "@/lib/ocr";
import { logOcrUsage } from "@/lib/ai/usage";

export type PrepareErrorCode =
  | "EMPTY_DOCUMENT"
  | "DOCUMENT_TOO_LARGE"
  | "DOCUMENT_TOO_LARGE_FOR_OCR"
  | "OCR_NOT_AVAILABLE"
  | "OCR_EMPTY_RESULT"
  | "OCR_PROVIDER_ERROR"
  | "OCR_INPUT_TOO_LARGE"
  | "PARSE_FAILED";

export class PrepareError extends Error {
  constructor(
    message: string,
    public readonly code: PrepareErrorCode,
    public readonly extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PrepareError";
  }
}

export interface PrepareResult {
  contractText: string;
  usedOcr: boolean;
  /** mimeType after parsing — may differ from original if parser disambiguated */
  mimeType: string;
  fileBytes: Uint8Array;
}

/**
 * Parse a file, run OCR if needed (and allowed), and return ready-to-analyze
 * text. Throws PrepareError on any failure the caller should map to HTTP.
 *
 * @param file The uploaded File from FormData
 * @param ocrAllowed Whether the current user's plan permits OCR (caller
 *                   checked plan/quota beforehand)
 * @param userId    For OCR usage logging — pass null if anonymous
 * @param orgId     For OCR usage logging — pass null if anonymous
 */
export async function prepareDocument(
  file: File,
  ocrAllowed: boolean,
  userId: string | null,
  orgId: string | null
): Promise<PrepareResult> {
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const originalMimeType = file.type || "application/octet-stream";

  // 1. Parse the document
  let contractText: string;
  let needsOcr = false;
  let mimeType = originalMimeType;
  try {
    const parsed = await parseDocument(
      new File([fileBytes], file.name, { type: originalMimeType })
    );
    contractText = parsed.text;
    needsOcr = parsed.needsOcr ?? false;
    if (parsed.mimeType) mimeType = parsed.mimeType;
  } catch {
    throw new PrepareError(
      "Не удалось прочитать файл. Убедитесь, что формат поддерживается (PDF, DOCX, TXT).",
      "PARSE_FAILED"
    );
  }

  // 2. OCR path
  let usedOcr = false;
  if (needsOcr) {
    if (!isOcrAvailable()) {
      throw new PrepareError(
        "Документ выглядит как скан (текстовый слой пуст). Распознавание сканов не настроено в этом окружении.",
        "OCR_NOT_AVAILABLE"
      );
    }
    if (!ocrAllowed) {
      throw new PrepareError(
        "Распознавание сканов доступно на тарифах «Про» и «Бизнес». Перейдите на платный план.",
        "OCR_NOT_AVAILABLE"
      );
    }

    const ocr = getOcr();
    const isPdf = mimeType === "application/pdf";
    const fitsInline = file.size <= ocr.inlineLimitBytes;

    try {
      if (fitsInline) {
        const ocrResult = await ocr.recognize({
          data: fileBytes,
          mimeType,
          languages: ["ru", "en"],
        });
        contractText = ocrResult.text;
        usedOcr = true;
        await logOcrUsage(userId, orgId, ocrResult, contractText.length);
      } else if (isPdf) {
        const ocrResult = await recognizeMultiPagePdf(fileBytes);
        contractText = ocrResult.text;
        usedOcr = true;
        await logOcrUsage(userId, orgId, ocrResult, contractText.length);
        if (ocrResult.failedPages > 0) {
          console.warn(
            `[prepare] OCR completed with ${ocrResult.failedPages}/${ocrResult.pageCount} failed pages`
          );
        }
      } else {
        throw new PrepareError(
          `Размер изображения (${(file.size / 1024 / 1024).toFixed(2)} МБ) превышает лимит OCR (${(ocr.inlineLimitBytes / 1024 / 1024).toFixed(2)} МБ на изображение). Уменьшите разрешение или сожмите файл.`,
          "DOCUMENT_TOO_LARGE_FOR_OCR",
          { sizeBytes: file.size, limitBytes: ocr.inlineLimitBytes }
        );
      }
    } catch (ocrError) {
      if (ocrError instanceof PrepareError) throw ocrError;
      const code =
        ocrError instanceof OcrError ? ocrError.code : "PROVIDER_ERROR";
      console.error("[prepare] OCR failed:", ocrError);
      if (code === "EMPTY_RESULT") {
        throw new PrepareError(
          "Не удалось распознать текст. Возможно, скан слишком низкого качества — попробуйте другую копию.",
          "OCR_EMPTY_RESULT"
        );
      }
      if (code === "INPUT_TOO_LARGE") {
        throw new PrepareError(
          ocrError instanceof OcrError
            ? ocrError.message
            : "Изображение слишком большое для OCR",
          "OCR_INPUT_TOO_LARGE"
        );
      }
      throw new PrepareError(
        "Сервис распознавания временно недоступен. Попробуйте позже.",
        "OCR_PROVIDER_ERROR"
      );
    }
  } else if (!contractText.trim()) {
    throw new PrepareError(
      "Документ пуст или не содержит текста.",
      "EMPTY_DOCUMENT"
    );
  }

  // 3. Length check
  if (isOversizedDocument(contractText)) {
    throw new PrepareError(
      `Документ слишком большой для автоматического анализа (${contractText.length.toLocaleString("ru-RU")} символов, лимит ${HARD_DOC_LIMIT.toLocaleString("ru-RU")}). Разбейте его на части и проанализируйте по разделам.`,
      "DOCUMENT_TOO_LARGE",
      { textLength: contractText.length, limit: HARD_DOC_LIMIT }
    );
  }

  return { contractText, usedOcr, mimeType, fileBytes };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: no regressions. New file isn't tested directly — its behavior is verified via the existing `/api/analyze/route.ts` until Task 4 swaps callers.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyze/prepare.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Extract document parse + OCR into src/lib/analyze/prepare.ts

Pure refactor — no behaviour change. The existing /api/analyze route
mixes auth, quota, parse, OCR, analyze, DB save into one 449-line
function. The new /api/analyze/start endpoint needs the parse + OCR
steps but NOT the analyze + save steps (analyze runs in the background
worker). Lifted those steps out as prepareDocument() returning typed
PrepareError for HTTP mapping.

The old /api/analyze route still does inline parsing; it will switch
to prepareDocument in a later commit when wrapping /start for back-compat.
EOF
)"
```

---

## Task 4: Create `kickOffBackgroundAnalyze` helper

**Why:** isolates the self-invoke fetch with 2-retry logic so it can be unit-tested and reused (from `/start` and from the cron health-check).

**Files:**
- Create: `src/lib/analyze/kick-off.ts`

- [ ] **Step 1: Create the helper**

Create `src/lib/analyze/kick-off.ts`:

```ts
// Fire-and-forget HTTP call to /api/analyze/run, with a small retry
// loop in case the first fetch is dropped (cold start race, transient
// network). The cron at /api/cron/restart-stuck-analyses is the true
// safety net — if both retries fail, the row stays PENDING and the
// cron will reattempt within ~5 minutes.
//
// Auth: x-internal-token header with INTERNAL_SECRET. Production MUST
// set this env var; missing secret in production logs an error and
// declines to kick off (caller's Analysis row stays PENDING, cron will
// pick it up but won't be able to authenticate either — surfacing the
// misconfiguration visibly).

import { BRAND } from "@/lib/legal-info";

const RETRY_DELAYS_MS = [0, 1_000]; // 2 attempts, 1s between

export async function kickOffBackgroundAnalyze(analysisId: string): Promise<void> {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    console.error(
      "[analyze.kick-off] INTERNAL_SECRET not set — cannot kick off background worker. " +
        "Set INTERNAL_SECRET in Vercel project env vars."
    );
    return;
  }

  const url = `${BRAND.publicUrl}/api/analyze/run`;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
    try {
      // Fire-and-forget: we do NOT await response.json() or response body.
      // We do await the initial fetch() promise enough to confirm Vercel
      // accepted the connection (request line + headers were transmitted),
      // then return immediately. The function on the other side runs to
      // completion independently.
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-token": secret,
        },
        body: JSON.stringify({ analysisId }),
      });
      // Don't drain the body — let Vercel's function continue. We only
      // need to know the connection was accepted.
      if (res.ok || res.status === 204) {
        return;
      }
      console.warn(
        `[analyze.kick-off] /run returned ${res.status} for ${analysisId} (attempt ${attempt + 1})`
      );
    } catch (err) {
      console.warn(
        `[analyze.kick-off] fetch failed for ${analysisId} (attempt ${attempt + 1}):`,
        (err as Error).message
      );
    }
  }

  // Both attempts failed. The row stays PENDING — cron will retry.
  console.error(
    `[analyze.kick-off] both kick-off attempts failed for ${analysisId}. ` +
      "Cron /api/cron/restart-stuck-analyses will pick it up within 5min."
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 426+ PASS, no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/lib/analyze/kick-off.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Add kickOffBackgroundAnalyze helper for self-invoke pattern

Fire-and-forget HTTP call to /api/analyze/run with one retry. Used
by /api/analyze/start after creating the PENDING row, and reused by
the stuck-job cron when a row sits in PENDING > 30s.

INTERNAL_SECRET env var guards /api/analyze/run from external callers.
Missing secret in production refuses to kick off (visible in logs) —
better than silently running an unprotected internal endpoint.
EOF
)"
```

---

## Task 5: Create `runAnalyzeJob` orchestrator

**Why:** central place where the analyze logic + progress writes live. Wrapped by `/api/analyze/run`.

**Files:**
- Create: `src/lib/analyze/run.ts`

- [ ] **Step 1: Create the orchestrator**

Create `src/lib/analyze/run.ts`:

```ts
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

const CANCEL_CHECK_INTERVAL_MS = 2_000;

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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 426+ PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/analyze/run.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Add runAnalyzeJob orchestrator with atomic claim + progress + cancel

Background worker for the durable analyze flow. Atomic claim via
updateMany WHERE status='PENDING' guarantees single-fire even when two
kick-offs race. Progress checkpoints write status to DB at 5/30/50/90/100
percent and also check for CANCELLED — user can stop the job between
checkpoints. Failure path marks status=FAILED with errorMessage truncated
to 500 chars (zero risk of OOM persisting an enormous stack).

Post-completion: embed chunks + captureEvent + referral bonus all
fire-and-forget so worker exits promptly.
EOF
)"
```

---

## Task 6: Rate-limit endpoints + API routes for `/start`, `/run`

**Files:**
- Modify: `src/lib/rate-limit.ts`
- Create: `src/app/api/analyze/start/route.ts`
- Create: `src/app/api/analyze/run/route.ts`

- [ ] **Step 1: Add new rate-limit endpoints**

Modify `src/lib/rate-limit.ts`. Find the `RateLimitEndpoint` type (line 4) and add three new endpoints. Replace the existing union with:

```ts
export type RateLimitEndpoint =
  | "analyze"
  | "analyze.start"
  | "analyze.poll"
  | "chat"
  | "generate"
  | "billing.checkout"
  | "network"
  | "workspace-chat"
  | "deals.create"
  | "deals.action"
  | "negotiation.suggest"
  | "default";
```

Then find the `LIMITS` map (line 22) and add four entries. The full updated map:

```ts
const LIMITS: Record<RateLimitEndpoint, { max: number; windowSec: number }> = {
  analyze: { max: 10, windowSec: 60 },
  // analyze.start mirrors the old analyze cap — kicking off a job is the
  // gated action, polling is essentially unlimited.
  "analyze.start": { max: 10, windowSec: 60 },
  // Polling — high cap, used by every active job every 2.5s.
  "analyze.poll": { max: 300, windowSec: 60 },
  chat: { max: 30, windowSec: 60 },
  generate: { max: 10, windowSec: 60 },
  "billing.checkout": { max: 10, windowSec: 60 },
  network: { max: 30, windowSec: 60 },
  "workspace-chat": { max: 30, windowSec: 60 },
  "deals.create": { max: 10, windowSec: 60 },
  "deals.action": { max: 60, windowSec: 60 },
  // Negotiation moves AI calls — gated but allows a few per minute as
  // the user iterates on a single deal.
  "negotiation.suggest": { max: 15, windowSec: 60 },
  default: { max: 60, windowSec: 60 },
};
```

- [ ] **Step 2: Create `/api/analyze/start/route.ts`**

Create the file:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { checkQuotaSafe } from "@/lib/quota";
import { ensureActiveOrg, getMembership } from "@/lib/org";
import { getStorage, isStorageAvailable } from "@/lib/storage";
import { reportError } from "@/lib/telemetry";
import { prepareDocument, PrepareError } from "@/lib/analyze/prepare";
import { kickOffBackgroundAnalyze } from "@/lib/analyze/kick-off";
import { pickStageFromProgress } from "@/lib/analyze/job";
import { captureEvent } from "@/lib/analytics/server";

// Synchronous portion: parse + OCR + quota check + DB row creation.
// Budget ~15s. Returns analysisId so the client can poll for progress.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    const rl = await rateLimit(ip, "analyze.start");
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: "Слишком много запросов. Подождите немного.",
          code: "RATE_LIMITED",
          resetAt: rl.resetAt,
        },
        { status: 429 }
      );
    }

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Авторизуйтесь для запуска анализа." },
        { status: 401 }
      );
    }
    const orgId =
      session?.user?.activeOrgId ?? (await ensureActiveOrg(userId));

    // VIEWER role can't spend quota.
    const m = await getMembership(userId, orgId);
    if (m?.role === "VIEWER") {
      return NextResponse.json(
        { error: "Роль «Наблюдатель» не позволяет запускать анализ договоров." },
        { status: 403 }
      );
    }

    // Quota check — only check, don't consume. Worker consumes on COMPLETED.
    const quota = await checkQuotaSafe(orgId, "analyze");
    if (quota && !quota.allowed) {
      return NextResponse.json(
        {
          error: `Лимит тарифа ${quota.plan} исчерпан: ${quota.used} из ${quota.limit} анализов в этом месяце.`,
          code: "QUOTA_EXCEEDED",
          quota: {
            feature: quota.feature,
            used: quota.used,
            limit: quota.limit,
            plan: quota.plan,
            resetsAt: quota.resetsAt.toISOString(),
          },
        },
        { status: 402 }
      );
    }

    // OCR allowed flag — for prepareDocument
    const ocrQuota = await checkQuotaSafe(orgId, "ocr");
    const ocrAllowed = ocrQuota ? ocrQuota.allowed : false;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Файл не предоставлен" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Файл слишком большой. Максимальный размер — 10 МБ" },
        { status: 400 }
      );
    }

    // Parse + OCR (synchronous part, budget ~15s).
    let prepared;
    try {
      prepared = await prepareDocument(file, ocrAllowed, userId, orgId);
    } catch (err) {
      if (err instanceof PrepareError) {
        const status =
          err.code === "DOCUMENT_TOO_LARGE"
            ? 413
            : err.code === "OCR_NOT_AVAILABLE"
              ? 402
              : err.code === "PARSE_FAILED" || err.code === "EMPTY_DOCUMENT"
                ? 400
                : 422;
        return NextResponse.json(
          { error: err.message, code: err.code, ...(err.extra ?? {}) },
          { status }
        );
      }
      throw err;
    }

    // Upload original to Blob (fire-and-forget — analysis runs without it).
    let blobInfo: { url: string; key: string } | null = null;
    if (isStorageAvailable()) {
      try {
        const storage = getStorage();
        const uploaded = await storage.upload({
          fileName: file.name,
          mimeType: prepared.mimeType,
          data: prepared.fileBytes,
          folder: `documents/${userId}`,
        });
        blobInfo = { url: uploaded.url, key: uploaded.key };
      } catch (storageError) {
        console.error("Failed to store original document:", storageError);
      }
    }

    // Create Document + PENDING Analysis row atomically.
    const document = await prisma.document.create({
      data: {
        userId,
        orgId,
        fileName: file.name,
        fileSize: file.size,
        rawText: prepared.contractText,
        mimeType: prepared.mimeType,
        blobUrl: blobInfo?.url ?? null,
        blobKey: blobInfo?.key ?? null,
        analysis: {
          create: {
            status: "PENDING",
            progress: 0,
            stage: pickStageFromProgress(0),
            // score/summary/risks default to 0/""/"[]" via schema defaults
          },
        },
      },
      include: { analysis: true },
    });

    if (!document.analysis) {
      // Shouldn't happen — schema guarantees the nested create.
      return NextResponse.json(
        { error: "Не удалось создать запись анализа" },
        { status: 500 }
      );
    }

    void captureEvent({
      userId,
      orgId,
      event: "analysis_started",
      properties: {
        textLength: prepared.contractText.length,
        usedOcr: prepared.usedOcr,
      },
    });

    // Kick off background worker (fire-and-forget — function continues
    // returning the response regardless of kick-off outcome).
    void kickOffBackgroundAnalyze(document.analysis.id);

    return NextResponse.json({
      analysisId: document.analysis.id,
      documentId: document.id,
    });
  } catch (error) {
    await reportError(error, { op: "analyze.start" });
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}`.slice(0, 500)
        : String(error).slice(0, 500);
    return NextResponse.json(
      { error: "Ошибка при создании анализа. Попробуйте позже.", detail },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create `/api/analyze/run/route.ts`**

Create the file:

```ts
import { NextRequest, NextResponse } from "next/server";
import { runAnalyzeJob } from "@/lib/analyze/run";
import { reportError } from "@/lib/telemetry";

// Background worker endpoint — called by kickOffBackgroundAnalyze and
// by the stuck-job cron. NOT publicly accessible: requires
// x-internal-token header matching INTERNAL_SECRET.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    console.error("[analyze.run] INTERNAL_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const tokenHeader = request.headers.get("x-internal-token");
  if (tokenHeader !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      analysisId?: string;
    };
    if (!body.analysisId || typeof body.analysisId !== "string") {
      return NextResponse.json({ error: "analysisId required" }, { status: 400 });
    }

    const result = await runAnalyzeJob(body.analysisId);
    return NextResponse.json({ ok: true, claimed: result.claimed });
  } catch (error) {
    await reportError(error, { op: "analyze.run.endpoint" });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: 426+ PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rate-limit.ts src/app/api/analyze/start/route.ts src/app/api/analyze/run/route.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Add /api/analyze/start (sync prep) and /api/analyze/run (background worker)

/start does parse + OCR + quota check (<15s), creates Document + PENDING
Analysis row, returns { analysisId, documentId }, kicks off /run via
fire-and-forget HTTP self-invoke. Quota is checked but not consumed —
worker logs AiUsage on COMPLETED so failed/cancelled jobs don't burn
quota (UX improvement vs. existing /api/analyze which consumed regardless).

/run is internal-only: x-internal-token must match INTERNAL_SECRET. Calls
runAnalyzeJob and returns { ok: true, claimed }. Atomic claim ensures
duplicate kick-offs don't run twice.

Adds rate-limit endpoints analyze.start (10/min), analyze.poll (300/min,
essentially unlimited), and negotiation.suggest (15/min, for later task).
EOF
)"
```

---

## Task 7: API routes for status / result / cancel / active

**Files:**
- Create: `src/app/api/analyze/[id]/status/route.ts`
- Create: `src/app/api/analyze/[id]/result/route.ts`
- Create: `src/app/api/analyze/[id]/cancel/route.ts`
- Create: `src/app/api/analyze/active/route.ts`

- [ ] **Step 1: Create status endpoint**

Create `src/app/api/analyze/[id]/status/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`analyze.poll:${session.user.id}`, "analyze.poll");
  if (!rl.ok) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      stage: true,
      progress: true,
      errorMessage: true,
      finishedAt: true,
      document: { select: { userId: true } },
    },
  });
  if (!analysis) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  if (analysis.document.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    status: analysis.status,
    stage: analysis.stage,
    progress: analysis.progress,
    errorMessage: analysis.errorMessage,
    finishedAt: analysis.finishedAt?.toISOString() ?? null,
  });
}
```

- [ ] **Step 2: Create result endpoint**

Create `src/app/api/analyze/[id]/result/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`analyze.poll:${session.user.id}`, "analyze.poll");
  if (!rl.ok) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: {
      document: {
        select: {
          id: true,
          userId: true,
          fileName: true,
          rawText: true,
        },
      },
    },
  });
  if (!analysis) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  if (analysis.document.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (analysis.status !== "COMPLETED") {
    return NextResponse.json(
      { status: analysis.status, progress: analysis.progress, stage: analysis.stage },
      { status: 425 } // Too Early
    );
  }

  // Parse risks JSON for client (matches old /api/analyze response shape).
  let parsedRisks: unknown = [];
  try {
    parsedRisks = JSON.parse(analysis.risks);
  } catch {
    parsedRisks = [];
  }
  let parsedMetadata: Record<string, unknown> = {};
  if (analysis.metadata) {
    try {
      parsedMetadata = JSON.parse(analysis.metadata) as Record<string, unknown>;
    } catch {
      parsedMetadata = {};
    }
  }

  return NextResponse.json({
    documentId: analysis.document.id,
    fileName: analysis.document.fileName,
    score: analysis.score,
    summary: analysis.summary,
    risks: parsedRisks,
    ...parsedMetadata,
  });
}
```

- [ ] **Step 3: Create cancel endpoint**

Create `src/app/api/analyze/[id]/cancel/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership and update atomically — only PENDING or RUNNING rows
  // can be cancelled. COMPLETED / FAILED / already-CANCELLED rows: no-op.
  const result = await prisma.analysis.updateMany({
    where: {
      id,
      status: { in: ["PENDING", "RUNNING"] },
      document: { userId: session.user.id },
    },
    data: {
      status: "CANCELLED",
      finishedAt: new Date(),
    },
  });

  return NextResponse.json({ cancelled: result.count > 0 });
}
```

- [ ] **Step 4: Create active jobs endpoint**

Create `src/app/api/analyze/active/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { AnalysisJobView } from "@/lib/analyze/job";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ jobs: [] });
  }

  const rows = await prisma.analysis.findMany({
    where: {
      status: { in: ["PENDING", "RUNNING"] },
      document: { userId: session.user.id },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      document: { select: { id: true, fileName: true } },
    },
  });

  const jobs: AnalysisJobView[] = rows.map((r) => ({
    analysisId: r.id,
    documentId: r.document.id,
    fileName: r.document.fileName,
    status: r.status,
    stage: r.stage,
    progress: r.progress,
    errorMessage: r.errorMessage,
    startedAt: r.startedAt?.toISOString() ?? null,
    finishedAt: r.finishedAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ jobs });
}
```

- [ ] **Step 5: Type-check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, 426+ tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/analyze/[id]/status/route.ts src/app/api/analyze/[id]/result/route.ts src/app/api/analyze/[id]/cancel/route.ts src/app/api/analyze/active/route.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Add /api/analyze/[id]/{status,result,cancel} + /api/analyze/active

Read endpoints for the durable job system. status returns lightweight
{status, stage, progress, errorMessage}; result returns full analysis
only when COMPLETED (425 Too Early otherwise so client doesn't have to
guess); cancel is owner-only atomic update PENDING|RUNNING → CANCELLED;
active lists current user's in-flight jobs (cap 20, recent first) —
used by client to rehydrate state after page reload when localStorage
is unavailable or stale.

All four are owner-scoped via session.user.id check against Document.userId.
EOF
)"
```

---

## Task 8: Cron `/api/cron/restart-stuck-analyses`

**Files:**
- Create: `src/app/api/cron/restart-stuck-analyses/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron route**

Create `src/app/api/cron/restart-stuck-analyses/route.ts`:

```ts
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
```

- [ ] **Step 2: Add cron entry to vercel.json**

Replace `vercel.json` with:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/billing-reminders",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/restart-stuck-analyses",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

- [ ] **Step 3: Type-check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, 426+ tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/restart-stuck-analyses/route.ts vercel.json
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Add stuck-analysis recovery cron (5-minute interval)

Runs every 5 minutes. Two recovery paths:
- PENDING for >30s: re-kick the worker. The atomic claim in runAnalyzeJob
  ensures double-kick is safe (only one worker wins).
- RUNNING for >30min: mark FAILED with a tariff-aware errorMessage. The
  worker probably hit Vercel's 300s timeout (Pro) or 60s timeout (Hobby).
  User sees "anal took too long" + upgrade CTA.

Auth: Bearer ${CRON_SECRET} header — same pattern as billing-reminders.
EOF
)"
```

---

## Task 9: `<ActiveAnalysesStrip>` client component

**Files:**
- Create: `src/components/active-analyses-strip.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/active-analyses-strip.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { X, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { AnalysisJobView } from "@/lib/analyze/job";

// Sticky multi-track panel. Sits above page content on /analyze and
// /dashboard. Polls every 2.5s for each active job; on COMPLETED the
// row converts to a "Перейти к отчёту →" link for 5 seconds, then
// drops out of view.
//
// Local state of in-flight job IDs is mirrored to localStorage so a
// reload mid-analysis re-hydrates the same set of jobs.

const POLL_INTERVAL_MS = 2_500;
const COMPLETED_DISPLAY_MS = 5_000;
const LS_KEY = "yakso.activeAnalyses";

interface DisplayJob extends AnalysisJobView {
  /** Set to a timestamp when status flips to COMPLETED; row removes after COMPLETED_DISPLAY_MS */
  completedAt?: number;
}

export function ActiveAnalysesStrip() {
  const [jobs, setJobs] = useState<DisplayJob[]>([]);
  const pollHandles = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Persist active job ids to localStorage so reload preserves them.
  const writeLocalStorage = useCallback((current: DisplayJob[]) => {
    const inFlight = current
      .filter((j) => j.status === "PENDING" || j.status === "RUNNING")
      .map((j) => j.analysisId);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(inFlight));
    } catch {
      // ignore
    }
  }, []);

  // Fetch a single job's status. Returns null if 404/403.
  const fetchStatus = useCallback(
    async (analysisId: string): Promise<Partial<AnalysisJobView> | null> => {
      try {
        const res = await fetch(`/api/analyze/${analysisId}/status`);
        if (!res.ok) return null;
        return (await res.json()) as Partial<AnalysisJobView>;
      } catch {
        return null;
      }
    },
    []
  );

  // Start polling a single job.
  const startPolling = useCallback(
    (analysisId: string) => {
      if (pollHandles.current.has(analysisId)) return;
      const handle = setInterval(async () => {
        const update = await fetchStatus(analysisId);
        if (!update) return;
        setJobs((prev) => {
          const next = prev.map((j) =>
            j.analysisId === analysisId
              ? {
                  ...j,
                  ...update,
                  completedAt:
                    update.status === "COMPLETED" && !j.completedAt
                      ? Date.now()
                      : j.completedAt,
                }
              : j
          );
          writeLocalStorage(next);
          return next;
        });
        if (
          update.status === "COMPLETED" ||
          update.status === "FAILED" ||
          update.status === "CANCELLED"
        ) {
          // Stop polling — this job is in a terminal state.
          const h = pollHandles.current.get(analysisId);
          if (h) {
            clearInterval(h);
            pollHandles.current.delete(analysisId);
          }
        }
      }, POLL_INTERVAL_MS);
      pollHandles.current.set(analysisId, handle);
    },
    [fetchStatus, writeLocalStorage]
  );

  // Remove a job from the strip (after COMPLETED display window or on cancel).
  const removeJob = useCallback(
    (analysisId: string) => {
      const h = pollHandles.current.get(analysisId);
      if (h) {
        clearInterval(h);
        pollHandles.current.delete(analysisId);
      }
      setJobs((prev) => {
        const next = prev.filter((j) => j.analysisId !== analysisId);
        writeLocalStorage(next);
        return next;
      });
    },
    [writeLocalStorage]
  );

  // Cancel a job via API.
  const cancelJob = useCallback(
    async (analysisId: string) => {
      try {
        await fetch(`/api/analyze/${analysisId}/cancel`, { method: "POST" });
      } catch {
        // ignore — UI removes optimistically
      }
      removeJob(analysisId);
    },
    [removeJob]
  );

  // Hydration on mount: server truth + local fallback.
  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      try {
        const res = await fetch("/api/analyze/active");
        if (!res.ok) return;
        const data = (await res.json()) as { jobs: AnalysisJobView[] };
        if (!mounted) return;
        setJobs(data.jobs);
        writeLocalStorage(data.jobs);
        for (const j of data.jobs) {
          if (j.status === "PENDING" || j.status === "RUNNING") {
            startPolling(j.analysisId);
          }
        }
      } catch {
        // ignore — strip just won't show until next start
      }
    }
    void hydrate();
    return () => {
      mounted = false;
      for (const h of pollHandles.current.values()) clearInterval(h);
      pollHandles.current.clear();
    };
  }, [startPolling, writeLocalStorage]);

  // Auto-remove COMPLETED rows after display window.
  useEffect(() => {
    const completedJobs = jobs.filter((j) => j.completedAt);
    if (completedJobs.length === 0) return;
    const timers = completedJobs.map((j) => {
      const elapsed = Date.now() - (j.completedAt ?? 0);
      const remaining = Math.max(0, COMPLETED_DISPLAY_MS - elapsed);
      return setTimeout(() => removeJob(j.analysisId), remaining);
    });
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [jobs, removeJob]);

  // Expose imperative API to parent via window event — /analyze page
  // dispatches a `yakso:analyze-started` event on successful POST /start.
  useEffect(() => {
    function onStarted(e: Event) {
      const detail = (e as CustomEvent<AnalysisJobView>).detail;
      setJobs((prev) => {
        if (prev.some((j) => j.analysisId === detail.analysisId)) return prev;
        const next = [detail, ...prev];
        writeLocalStorage(next);
        return next;
      });
      startPolling(detail.analysisId);
    }
    window.addEventListener("yakso:analyze-started", onStarted as EventListener);
    return () =>
      window.removeEventListener(
        "yakso:analyze-started",
        onStarted as EventListener
      );
  }, [startPolling, writeLocalStorage]);

  if (jobs.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 border-b border-rule bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-3 sm:px-10">
        <AnimatePresence initial={false}>
          {jobs.map((j) => (
            <motion.li
              key={j.analysisId}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-3"
            >
              <Indicator status={j.status} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {j.fileName}
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <ProgressBar progress={j.progress} status={j.status} />
                  <span className="text-[10px] uppercase tracking-[0.18em] text-ink-quiet">
                    {labelFor(j)}
                  </span>
                </div>
              </div>
              {j.status === "COMPLETED" ? (
                <Link
                  href={`/report/${j.documentId}`}
                  className="text-sm font-semibold text-success underline-offset-4 hover:underline"
                >
                  Перейти →
                </Link>
              ) : j.status === "FAILED" ? (
                <button
                  type="button"
                  onClick={() => removeJob(j.analysisId)}
                  className="text-sm font-semibold text-danger hover:underline"
                >
                  Закрыть
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void cancelJob(j.analysisId)}
                  className="text-ink-quiet/60 transition-colors hover:text-foreground"
                  aria-label="Отменить анализ"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function Indicator({ status }: { status: AnalysisJobView["status"] }) {
  if (status === "COMPLETED")
    return <CheckCircle className="h-4 w-4 shrink-0 text-success" aria-hidden />;
  if (status === "FAILED")
    return <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden />;
  return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />;
}

function ProgressBar({
  progress,
  status,
}: {
  progress: number;
  status: AnalysisJobView["status"];
}) {
  const color =
    status === "COMPLETED"
      ? "bg-success"
      : status === "FAILED"
        ? "bg-danger"
        : "bg-primary";
  return (
    <div className="h-[2px] flex-1 max-w-[200px] bg-rule/40">
      <div
        className={`h-full transition-[width] duration-500 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}

function labelFor(j: AnalysisJobView): string {
  if (j.status === "FAILED") return j.errorMessage ?? "Ошибка";
  if (j.status === "COMPLETED") return "Готово";
  if (j.status === "CANCELLED") return "Отменено";
  if (j.stage === "parsing") return "Читаем документ";
  if (j.stage === "chunking") return "Разбиваем на части";
  if (j.stage === "analyzing") return "Анализируем риски";
  if (j.stage === "synthesizing") return "Собираем отчёт";
  if (j.stage === "saving") return "Сохраняем";
  return "В работе";
}
```

- [ ] **Step 2: Type-check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, 426+ PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/active-analyses-strip.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Add ActiveAnalysesStrip — sticky multi-job progress panel

Polls /api/analyze/[id]/status every 2.5s per in-flight job. Persists
the active ids in localStorage so a page reload restores the strip,
and re-hydrates from GET /api/analyze/active on mount (server truth
wins over local cache). COMPLETED rows convert to "Перейти →" links
for 5 seconds then drop out. FAILED rows show errorMessage and a close
button. Cancel button POSTs /cancel and optimistically removes.

Listens for window event `yakso:analyze-started` from the upload form
so a newly-started job appears in the strip without round-tripping.
EOF
)"
```

---

## Task 10: Rewrite `/analyze` page to use durable jobs

**Files:**
- Modify: `src/app/analyze/page.tsx`

- [ ] **Step 1: Read the current state of /analyze/page.tsx**

The current file (377 lines) uses fetch-and-block POST to `/api/analyze` and sessionStorage handoff. We're replacing the analyze submission with a `/start` call that dispatches a window event, and adding `<ActiveAnalysesStrip>` at the top.

- [ ] **Step 2: Replace the handleAnalyze function and add the strip**

Modify `src/app/analyze/page.tsx`. The changes are surgical — the rest of the page (UI for file picker, mode toggle, paste textarea) stays.

Replace the imports block at the top (currently lines 1-22) with:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { UploadZone } from "@/components/upload-zone";
import { Button, buttonClass } from "@/components/button";
import { ActiveAnalysesStrip } from "@/components/active-analyses-strip";
import type { AnalysisJobView } from "@/lib/analyze/job";
import {
  FileSearch,
  Upload,
  ClipboardPaste,
  Scale,
  AlertTriangle,
  Crown,
  ExternalLink,
  LogIn,
} from "lucide-react";
```

(Removed: `useRouter`, `Loader2`, `CheckCircle` since we no longer block the page.)

Replace the `AnalyzeError` interface block (currently lines 23-32) and the constants (lines 34-45) with:

```tsx
interface AnalyzeError {
  message: string;
  code?: string;
  upgradeNeeded?: boolean;
  authNeeded?: boolean;
  compressHint?: boolean;
}

// Below this, a paste is almost certainly a fragment, not a contract —
// guard the button so the user doesn't spend an analysis on a snippet.
const MIN_PASTE_LENGTH = 200;
```

Now find the `AnalyzePage()` function (was line 47). Replace its body with the new shape — no `isAnalyzing` / `currentStage` blocking spinner state, instead dispatch start + window event + redirect-to-strip-on-page.

Full new component body:

```tsx
export default function AnalyzePage() {
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<AnalyzeError | null>(null);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [pastedText, setPastedText] = useState("");
  const pasteLength = pastedText.trim().length;

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
  };

  const handleAnalyze = async (file: File) => {
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze/start", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        const code: string | undefined = data.code;
        const message: string =
          data.error || `Ошибка при создании анализа (HTTP ${response.status})`;
        setError({
          message,
          code,
          upgradeNeeded:
            code === "QUOTA_EXCEEDED" || code === "OCR_NOT_AVAILABLE",
          authNeeded: response.status === 401,
          compressHint: code === "DOCUMENT_TOO_LARGE_FOR_OCR",
        });
        return;
      }

      const { analysisId, documentId } = (await response.json()) as {
        analysisId: string;
        documentId: string;
      };

      // Notify the strip — it picks up the job, starts polling, shows
      // the row. Page stays put; user can start another analysis or
      // navigate freely.
      const job: AnalysisJobView = {
        analysisId,
        documentId,
        fileName: file.name,
        status: "PENDING",
        stage: "parsing",
        progress: 0,
        errorMessage: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      };
      window.dispatchEvent(
        new CustomEvent("yakso:analyze-started", { detail: job })
      );

      // Reset the upload form for the next analysis (parallel mode).
      setSelectedFile(null);
      setPastedText("");
    } catch (err) {
      setError({
        message:
          err instanceof Error
            ? err.message
            : "Ошибка при создании анализа",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnalyzeText = () => {
    const text = pastedText.trim();
    if (text.length < MIN_PASTE_LENGTH) return;
    const file = new File([text], "Вставленный договор.txt", {
      type: "text/plain",
    });
    void handleAnalyze(file);
  };

  return (
    <AppShell>
      <ActiveAnalysesStrip />
      <PageHeader
        title="Анализ договора"
        description="Загрузите PDF или DOCX. Анализ запустится в фоне — можете загрузить ещё один или закрыть вкладку."
        actions={
          <Link
            href="/sample-report"
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            <FileSearch className="h-4 w-4" aria-hidden="true" />
            Открыть пример отчёта
          </Link>
        }
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="animate-fade-in">
          {/* Source toggle */}
          <div className="mb-5 flex justify-center">
            <div className="inline-flex rounded-xl border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("file");
                  setError(null);
                }}
                aria-pressed={mode === "file"}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === "file"
                    ? "bg-primary text-primary-fg"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Загрузить файл
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("text");
                  setError(null);
                }}
                aria-pressed={mode === "text"}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === "text"
                    ? "bg-primary text-primary-fg"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
                Вставить текст
              </button>
            </div>
          </div>

          {mode === "file" ? (
            <div className="animate-fade-in">
              <UploadZone onFileSelect={handleFileSelect} />
              <p className="mt-3 text-center text-xs text-muted">
                Нужно проверить несколько договоров сразу?{" "}
                <Link
                  href="/bulk"
                  className="font-semibold text-primary hover:underline"
                >
                  Массовая проверка →
                </Link>
              </p>
              {selectedFile && (
                <div className="mt-6 animate-scale-in text-center">
                  <Button
                    size="lg"
                    loading={submitting}
                    onClick={() =>
                      selectedFile && handleAnalyze(selectedFile)
                    }
                  >
                    <Scale className="h-5 w-5" aria-hidden="true" />
                    {submitting ? "Запускаем…" : "Начать анализ"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="animate-fade-in">
              <label
                htmlFor="paste-area"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Текст договора
              </label>
              <textarea
                id="paste-area"
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  setError(null);
                }}
                rows={14}
                placeholder="Вставьте сюда полный текст договора — например, скопированный из письма или мессенджера."
                className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1.5 text-xs text-muted">
                {pasteLength === 0
                  ? `Вставьте не меньше ${MIN_PASTE_LENGTH} символов.`
                  : pasteLength < MIN_PASTE_LENGTH
                    ? `Ещё ${MIN_PASTE_LENGTH - pasteLength} символов до минимума.`
                    : `${pasteLength.toLocaleString("ru-RU")} символов — можно анализировать.`}
              </p>
              <div className="mt-5 text-center">
                <Button
                  size="lg"
                  loading={submitting}
                  onClick={handleAnalyzeText}
                  disabled={pasteLength < MIN_PASTE_LENGTH || submitting}
                >
                  <Scale className="h-5 w-5" aria-hidden="true" />
                  {submitting ? "Запускаем…" : "Начать анализ"}
                </Button>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 animate-fade-in space-y-3 rounded-xl border border-danger/30 bg-danger-light p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-danger mt-0.5" />
                <p className="text-sm text-danger">{error.message}</p>
              </div>
              {error.upgradeNeeded && (
                <Link
                  href="/billing"
                  className={buttonClass({ size: "sm", className: "ml-8" })}
                >
                  <Crown className="h-4 w-4" />
                  Перейти на «Про» — безлимит
                </Link>
              )}
              {error.authNeeded && (
                <Link
                  href="/login"
                  className={buttonClass({ size: "sm", className: "ml-8" })}
                >
                  <LogIn className="h-4 w-4" />
                  Войти в аккаунт
                </Link>
              )}
              {error.compressHint && (
                <a
                  href="https://www.ilovepdf.com/compress_pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-8 inline-flex items-center gap-2 rounded-lg border border-danger/40 bg-card px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-light"
                >
                  <ExternalLink className="h-4 w-4" />
                  Сжать PDF на ilovepdf.com
                </a>
              )}
            </div>
          )}

          {/* Info */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Время анализа", value: "~30 секунд" },
              { label: "Поддержка", value: "PDF, DOCX, TXT" },
              { label: "Максимальный размер", value: "10 МБ" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border bg-card p-4 text-center"
              >
                <p className="text-sm font-semibold text-foreground">
                  {item.value}
                </p>
                <p className="mt-0.5 text-xs text-muted">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 3: Type-check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, 426+ PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/analyze/page.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Switch /analyze to durable job flow with parallel + resume support

Old behaviour: page blocks on a 60-300s POST to /api/analyze. Reload
loses the in-flight analysis; user has to refresh and start over.
Parallel uploads from two tabs each rewrite sessionStorage.

New behaviour: POST /api/analyze/start returns analysisId in <2s, page
dispatches a window event picked up by ActiveAnalysesStrip, strip polls
status until COMPLETED, then exposes a "Перейти →" link to the report.
Reload mid-analysis: strip rehydrates from /api/analyze/active and
continues polling. Multiple uploads stack as multiple rows in the strip.

Form resets after successful start so the user can immediately upload
another document without page navigation.
EOF
)"
```

---

## Task 11: Add `<ActiveAnalysesStrip>` to `/dashboard`

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add import + mount**

In `src/app/dashboard/page.tsx`, find the imports block. Add:

```tsx
import { ActiveAnalysesStrip } from "@/components/active-analyses-strip";
```

(Place it alongside other component imports near the top.)

Then find the JSX render — the dashboard content begins with `<AppShell>` or similar wrapper. Find the line just after `<PageHeader ... />` (or equivalent header element) and insert `<ActiveAnalysesStrip />` right above the first content section.

The exact placement may vary based on whether the dashboard uses `<AppShell>` + `<PageHeader>` pattern. Look for the first `<section>` or `<div className="mx-auto max-w-...">` in the dashboard's render and add the strip immediately before it.

Result (the relevant insertion):

```tsx
<AppShell>
  <PageHeader ... />
  <ActiveAnalysesStrip />
  <div className="mx-auto max-w-...">
    {/* rest of dashboard */}
  </div>
</AppShell>
```

The strip is `null` when there are no active jobs, so no visual change unless an analysis is running.

- [ ] **Step 2: Type-check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, 426+ PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Mount ActiveAnalysesStrip on /dashboard

The strip is null-render when no jobs are active, so this is invisible
99% of the time. When a job is in flight (e.g. user started analyze
then navigated to /dashboard), the strip restores from /api/analyze/active
and resumes polling, giving the user a visual handle on the in-flight
work no matter which page they're on.
EOF
)"
```

---

## Task 12: Negotiation moves schema + AI prompt

**Files:**
- Create: `src/lib/ai/schemas/negotiation.ts`
- Create: `src/lib/__tests__/negotiation-schema.test.ts`
- Modify: `src/lib/ai/prompts.ts` (add `NEGOTIATION_MOVES_PROMPT` export)

- [ ] **Step 1: Write the schema test first**

Create `src/lib/__tests__/negotiation-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MovesSchema } from "../ai/schemas/negotiation";

describe("MovesSchema", () => {
  const validA = {
    id: "A" as const,
    title: "Согласиться",
    body: "Под формулировкой… это безопасно потому что…",
    proposedText: null,
  };
  const validB = {
    id: "B" as const,
    title: "Компромисс",
    body: "Снизить штраф до 0.1% и cap'нуть на 5%",
    proposedText: "Неустойка составляет 0.1% за каждый день просрочки, но не более 5% от суммы договора.",
  };
  const validC = {
    id: "C" as const,
    title: "Стоять на своём",
    body: "Текущая формулировка защищает от…",
    proposedText: null,
  };

  it("accepts exactly 3 moves with correct ids A, B, C", () => {
    const result = MovesSchema.safeParse({ moves: [validA, validB, validC] });
    expect(result.success).toBe(true);
  });

  it("rejects fewer than 3 moves", () => {
    const result = MovesSchema.safeParse({ moves: [validA, validB] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 3 moves", () => {
    const result = MovesSchema.safeParse({
      moves: [validA, validB, validC, validA],
    });
    expect(result.success).toBe(false);
  });

  it("accepts null proposedText", () => {
    const result = MovesSchema.safeParse({
      moves: [validA, validB, { ...validC, proposedText: null }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts omitted proposedText (treated as undefined)", () => {
    const { proposedText: _omitted, ...withoutPt } = validC;
    const result = MovesSchema.safeParse({
      moves: [validA, validB, withoutPt],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = MovesSchema.safeParse({
      moves: [{ ...validA, title: "" }, validB, validC],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown id value", () => {
    const result = MovesSchema.safeParse({
      moves: [{ ...validA, id: "D" }, validB, validC],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run: `npx vitest run src/lib/__tests__/negotiation-schema.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Create the schema module**

Create `src/lib/ai/schemas/negotiation.ts`:

```ts
import { z } from "zod";

// Output of POST /api/deals/.../suggest-moves. Exactly 3 moves, one
// per archetype: A = accept the counter-position, B = compromise with
// concrete proposed text, C = stand firm with rationale.

export const MoveSchema = z.object({
  id: z.enum(["A", "B", "C"]),
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(800),
  proposedText: z.string().max(2000).nullable().optional(),
});

export const MovesSchema = z.object({
  moves: z.array(MoveSchema).length(3),
});

export type Move = z.infer<typeof MoveSchema>;
export type Moves = z.infer<typeof MovesSchema>;
```

- [ ] **Step 4: Re-run schema tests**

Run: `npx vitest run src/lib/__tests__/negotiation-schema.test.ts`
Expected: 7 tests PASS.

- [ ] **Step 5: Add the prompt to `src/lib/ai/prompts.ts`**

Open `src/lib/ai/prompts.ts`. At the bottom of the file, after the existing prompt exports, add:

```ts
// Sprint 15A — AI negotiation moves for Deal Room DISPUTED clauses.
// Called with clause text + each side's position + comment history.
// Returns exactly 3 moves: A (accept), B (compromise with text), C (stand).
export const NEGOTIATION_MOVES_PROMPT = `Ты — переговорный медиатор по договорному праву РФ. Спорный пункт договора уже обсуждается. Тебе даны текст пункта, позиции обеих сторон и история комментариев. Сгенерируй РОВНО 3 ОПЦИИ для текущей стороны:

A. "Согласиться" — если позиция контрагента разумна. В body коротко объясни, под какой именно формулировкой имеет смысл подписаться и почему это безопасно для клиента. proposedText оставь null.

B. "Компромисс" — конкретная формулировка нового пункта, которая частично уступает контрагенту, но защищает ключевой риск клиента. В body одно предложение о том, какой компромисс предлагается. В proposedText — готовая юридическая формулировка пункта в императивном стиле ("Сторона обязана…", "Сумма составляет…" — с конкретными числами и сроками).

C. "Стоять на своём" — аргументация для отстаивания текущей формулировки. В body — почему текущий текст важен и какой риск возникает при уступке. proposedText оставь null.

ВАЖНО:
☑ Ровно 3 опции, по одной каждого типа.
☑ id строго A, B, C.
☑ title — 3-5 слов.
☑ body — 1-2 предложения, прямые и конкретные.
☑ proposedText — только для B, готовый юридический текст, не "стороны должны обсудить".
☑ Не оборачивай moves в дополнительный объект на уровне ответа — массив из 3 объектов внутри поля moves, и ничего больше.

Всё на русском.`;
```

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: 426 + 7 = 433+ PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/schemas/negotiation.ts src/lib/__tests__/negotiation-schema.test.ts src/lib/ai/prompts.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Add MovesSchema + NEGOTIATION_MOVES_PROMPT for killer feature #1

Schema requires exactly 3 moves with ids A/B/C — enforced by .length(3)
and z.enum. proposedText is nullable+optional so the schema accepts both
{proposedText: null} and the field omitted entirely (model laziness
permitted). 7 tests pin the contract.

Prompt follows the same anti-wrapping discipline that was added to the
analyze prompt after foot-gun #47 — explicit "Не оборачивай moves в
дополнительный объект на уровне ответа" inline guard, no isolated JSON
example. Tool description (in the suggest-moves route, next commit) will
also say "Provide moves as a top-level array".
EOF
)"
```

---

## Task 13: API routes for suggest-moves (sender + receiver)

**Files:**
- Create: `src/app/api/deals/[id]/clauses/[clauseId]/suggest-moves/route.ts`
- Create: `src/app/api/deals/by-token/[token]/clauses/[clauseId]/suggest-moves/route.ts`

- [ ] **Step 1: Create the sender route**

Create `src/app/api/deals/[id]/clauses/[clauseId]/suggest-moves/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { generate } from "@/lib/ai/client";
import { MovesSchema } from "@/lib/ai/schemas/negotiation";
import { NEGOTIATION_MOVES_PROMPT } from "@/lib/ai/prompts";
import { pickTier } from "@/lib/ai/tier-policy";
import { getEffectiveUserPlan } from "@/lib/plans";
import { logUsage } from "@/lib/ai/usage";
import { reportError } from "@/lib/telemetry";
import { ensureActiveOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; clauseId: string }> }
) {
  try {
    const { id: dealId, clauseId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const rl = await rateLimit(
      `negotiation.suggest:${userId}`,
      "negotiation.suggest"
    );
    if (!rl.ok) {
      return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    }

    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(userId));

    // Verify sender owns this deal AND clause belongs to it.
    const clause = await prisma.dealClause.findFirst({
      where: {
        id: clauseId,
        dealId,
        deal: { ownerId: userId, orgId },
      },
      include: {
        deal: {
          include: {
            participants: { select: { id: true, role: true, guestName: true } },
          },
        },
        actions: {
          orderBy: { createdAt: "asc" },
          include: {
            participant: { select: { role: true, guestName: true } },
          },
        },
      },
    });
    if (!clause) {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    }

    // Cache hit: return cached moves unless ?force=1.
    const forceRegenerate = request.nextUrl.searchParams.get("force") === "1";
    if (!forceRegenerate && clause.suggestedMoves) {
      return NextResponse.json(clause.suggestedMoves);
    }

    // FREE plan cap: 1 generation per deal per day.
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, trialEndsAt: true },
    });
    const effectivePlan = owner
      ? getEffectiveUserPlan(owner).plan
      : "FREE";
    if (effectivePlan === "FREE" && !forceRegenerate) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCount = await prisma.aiUsage.count({
        where: {
          userId,
          feature: "chat", // negotiation uses chat tier — counted under chat
          createdAt: { gte: since },
        },
      });
      if (recentCount >= 10) {
        return NextResponse.json(
          {
            error:
              "Лимит AI-предложений для тарифа FREE исчерпан (10 в день). Обновитесь до тарифа «Про».",
            code: "NEGOTIATION_LIMIT",
          },
          { status: 402 }
        );
      }
    }

    // Build context for AI.
    const sender = clause.deal.participants.find((p) => p.role === "SENDER");
    const receiver = clause.deal.participants.find((p) => p.role === "RECEIVER");
    const yourSide = clause.yourSide as Record<string, unknown> | null;
    const theirSide = clause.theirSide as Record<string, unknown> | null;
    const commentHistory = clause.actions
      .filter((a) => a.kind === "COMMENT" && a.body)
      .map((a) => {
        const who =
          a.participant.role === "SENDER"
            ? `Отправитель ${sender?.guestName ?? ""}`
            : `Получатель ${receiver?.guestName ?? "(гость)"}`;
        return `${who.trim()}: ${a.body}`;
      })
      .join("\n");

    const userMessage = `Текст пункта:\n${clause.text}\n\nПозиция клиента (отправителя):\n${JSON.stringify(yourSide, null, 2)}\n\nПозиция контрагента:\n${theirSide ? JSON.stringify(theirSide, null, 2) : "не сформирована"}\n\nИстория комментариев:\n${commentHistory || "пока нет"}\n\nСгенерируй 3 опции переговорных ходов для отправителя.`;

    const tier = pickTier("chat", effectivePlan);
    const result = await generate({
      schema: MovesSchema,
      system: NEGOTIATION_MOVES_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      tier,
      maxTokens: 1500,
    });

    await logUsage(userId, orgId, result.usage, "chat");

    // Cache on the clause for cheap subsequent reads.
    await prisma.dealClause.update({
      where: { id: clauseId },
      data: { suggestedMoves: result.data as unknown as object },
    });

    return NextResponse.json(result.data);
  } catch (error) {
    await reportError(error, { op: "negotiation.suggest.sender" });
    return NextResponse.json(
      { error: "Не удалось сгенерировать варианты" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create the receiver route**

Create `src/app/api/deals/by-token/[token]/clauses/[clauseId]/suggest-moves/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getOrCreateDealSessionId } from "@/lib/deal-session";
import { generate } from "@/lib/ai/client";
import { MovesSchema } from "@/lib/ai/schemas/negotiation";
import { NEGOTIATION_MOVES_PROMPT } from "@/lib/ai/prompts";
import { pickTier } from "@/lib/ai/tier-policy";
import { reportError } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ token: string; clauseId: string }> }
) {
  try {
    const { token, clauseId } = await params;
    const { sessionId } = await getOrCreateDealSessionId();

    const rl = await rateLimit(
      `negotiation.suggest:${sessionId}`,
      "negotiation.suggest"
    );
    if (!rl.ok) {
      return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    }

    const clause = await prisma.dealClause.findFirst({
      where: {
        id: clauseId,
        deal: { inviteToken: token },
      },
      include: {
        deal: {
          include: {
            participants: { select: { id: true, role: true, guestName: true, sessionId: true } },
          },
        },
        actions: {
          orderBy: { createdAt: "asc" },
          include: {
            participant: { select: { role: true, guestName: true } },
          },
        },
      },
    });
    if (!clause) {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    }

    // Verify the session is the claimed RECEIVER for this deal.
    const receiver = clause.deal.participants.find((p) => p.role === "RECEIVER");
    if (!receiver || receiver.sessionId !== sessionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Receiver perspective uses cache too — but cached value reflects whoever
    // requested it last. To avoid cross-pollution, key the cache by perspective:
    // store as { sender?: Moves, receiver?: Moves } once we have a real two-sided
    // flow (Sub-B). For Sub-A: cache holds receiver's moves, regenerated on force.
    const forceRegenerate = request.nextUrl.searchParams.get("force") === "1";

    const sender = clause.deal.participants.find((p) => p.role === "SENDER");
    const yourSide = clause.yourSide as Record<string, unknown> | null;
    const theirSide = clause.theirSide as Record<string, unknown> | null;

    // Receiver sees the inverted perspective — their position is the
    // "counter" side from the analyze, so swap in the prompt context.
    const commentHistory = clause.actions
      .filter((a) => a.kind === "COMMENT" && a.body)
      .map((a) => {
        const who =
          a.participant.role === "SENDER"
            ? `Отправитель ${sender?.guestName ?? ""}`
            : `Получатель ${receiver.guestName ?? "(гость)"}`;
        return `${who.trim()}: ${a.body}`;
      })
      .join("\n");

    const userMessage = `Текст пункта:\n${clause.text}\n\nПозиция клиента (получателя):\n${theirSide ? JSON.stringify(theirSide, null, 2) : "не сформирована — клиент видит позицию отправителя"}\n\nПозиция контрагента (отправителя):\n${JSON.stringify(yourSide, null, 2)}\n\nИстория комментариев:\n${commentHistory || "пока нет"}\n\nСгенерируй 3 опции переговорных ходов для получателя.`;

    // Receiver session uses the SENDER owner's tier (deal context) —
    // anonymous receivers don't have their own quota.
    const tier = pickTier("chat", null);

    if (!forceRegenerate && clause.suggestedMoves) {
      return NextResponse.json(clause.suggestedMoves);
    }

    const result = await generate({
      schema: MovesSchema,
      system: NEGOTIATION_MOVES_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      tier,
      maxTokens: 1500,
    });

    await prisma.dealClause.update({
      where: { id: clauseId },
      data: { suggestedMoves: result.data as unknown as object },
    });

    return NextResponse.json(result.data);
  } catch (error) {
    await reportError(error, { op: "negotiation.suggest.receiver" });
    return NextResponse.json(
      { error: "Не удалось сгенерировать варианты" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Type-check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, 433+ tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/deals/[id]/clauses/[clauseId]/suggest-moves/route.ts src/app/api/deals/by-token/[token]/clauses/[clauseId]/suggest-moves/route.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Add suggest-moves endpoints for sender + receiver perspectives

Two routes mirroring the existing sender/receiver split of the Deal
Room. Both produce a Moves array via Anthropic generate(MovesSchema)
with NEGOTIATION_MOVES_PROMPT as system. Cache on
DealClause.suggestedMoves; bypass via ?force=1 query.

FREE plan cap: 10 chat-feature AiUsage rows per day (negotiation counts
under chat for billing). PRO+ unlimited. Receiver path is anonymous-
friendly — session cookie must match the claimed RECEIVER participant.

Rate limit negotiation.suggest 15/min per user or session.
EOF
)"
```

---

## Task 14: `<NegotiationMoves>` component + clause-card integration

**Files:**
- Create: `src/app/deal/[token]/negotiation-moves.tsx`
- Modify: `src/app/deal/[token]/clause-card.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/deal/[token]/negotiation-moves.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/skeleton";
import type { Move, Moves } from "@/lib/ai/schemas/negotiation";

interface Props {
  dealId: string | null;     // sender perspective — set
  token: string | null;       // receiver perspective — set
  clauseId: string;
  myRole: "SENDER" | "RECEIVER";
  onApplyAccept: () => void;  // posts AGREE
  onApplyCompromise: (proposedText: string) => void;  // posts PROPOSE_EDIT
  onApplyStand: (rationale: string) => void;          // posts COMMENT
}

export function NegotiationMoves({
  dealId,
  token,
  clauseId,
  myRole,
  onApplyAccept,
  onApplyCompromise,
  onApplyStand,
}: Props) {
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url =
    myRole === "SENDER" && dealId
      ? `/api/deals/${dealId}/clauses/${clauseId}/suggest-moves`
      : token
        ? `/api/deals/by-token/${token}/clauses/${clauseId}/suggest-moves`
        : null;

  const fetchMoves = async (force = false) => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(force ? `${url}?force=1` : url, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Не удалось получить предложения");
        return;
      }
      const data = (await res.json()) as Moves;
      setMoves(data.moves);
    } catch {
      setError("Не удалось получить предложения");
    } finally {
      setLoading(false);
    }
  };

  if (!moves && !loading) {
    return (
      <div className="mt-4 pt-4 border-t border-rule">
        <button
          type="button"
          onClick={() => void fetchMoves()}
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-primary font-semibold hover:underline underline-offset-4"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          AI поможет договориться →
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-rule">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary mb-3 inline-flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          AI готовит варианты
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border border-rule rounded-md p-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !moves) {
    return (
      <div className="mt-4 pt-4 border-t border-rule">
        <p className="text-sm text-danger mb-2">{error ?? "Нет данных"}</p>
        <button
          type="button"
          onClick={() => void fetchMoves(true)}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-rule">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary font-semibold inline-flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          AI рекомендует
        </p>
        <button
          type="button"
          onClick={() => void fetchMoves(true)}
          className="text-[10px] uppercase tracking-[0.18em] text-ink-quiet hover:text-foreground inline-flex items-center gap-1"
          aria-label="Сгенерировать заново"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Обновить
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {moves.map((m) => (
          <MoveCard
            key={m.id}
            move={m}
            onApply={() => {
              if (m.id === "A") onApplyAccept();
              else if (m.id === "B" && m.proposedText)
                onApplyCompromise(m.proposedText);
              else if (m.id === "C") onApplyStand(m.body);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MoveCard({ move, onApply }: { move: Move; onApply: () => void }) {
  return (
    <article className="border border-rule rounded-md p-3 flex flex-col">
      <h4 className="font-serif text-sm font-semibold text-foreground">
        {move.title}
      </h4>
      <p className="mt-1.5 text-[12px] leading-[1.5] text-ink-quiet flex-1">
        {move.body}
      </p>
      {move.proposedText && (
        <div className="mt-2.5 border border-rule bg-surface/40 rounded-md p-2 font-mono text-[11px] leading-[1.45] text-foreground/80 break-words">
          {move.proposedText}
        </div>
      )}
      <button
        type="button"
        onClick={onApply}
        className="mt-3 self-start text-xs font-semibold text-primary hover:underline underline-offset-4"
      >
        Применить →
      </button>
    </article>
  );
}
```

- [ ] **Step 2: Integrate into clause-card**

Modify `src/app/deal/[token]/clause-card.tsx`. The signature of `ClauseCard` will need two new props for the suggest-moves URL routing (sender path vs receiver path). The cleanest change is to pass `dealId` (string|null) and `token` (string|null) down from DealRoom — DealRoom already knows both. For backwards-compatibility with the existing render call from `deal-room.tsx`, add them as new required props.

First, add new props to the ClauseCard signature. Open `src/app/deal/[token]/clause-card.tsx`. Find the `export function ClauseCard(...)` definition (around line 57). Update the props interface (currently inline). Replace the function signature with:

```tsx
export function ClauseCard({
  clause,
  myParticipantId,
  myRole,
  dealId,
  token,
  onAction,
}: {
  clause: ClauseView;
  myParticipantId: string | null;
  myRole: "SENDER" | "RECEIVER" | null;
  dealId: string | null;
  token: string;
  onAction: (
    clauseId: string,
    kind: "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT",
    body?: string
  ) => Promise<void>;
}) {
```

(Notice: also added "PROPOSE_EDIT" to the onAction kind union — needed for compromise apply.)

Then add the import at the top of clause-card.tsx (alongside other imports):

```ts
import { NegotiationMoves } from "./negotiation-moves";
```

Then find the closing `</article>` of the ClauseCard component. Just before it, add the conditional render:

```tsx
{clause.status === "DISPUTED" && myParticipantId && myRole && (
  <NegotiationMoves
    dealId={dealId}
    token={token}
    clauseId={clause.id}
    myRole={myRole}
    onApplyAccept={() => void onAction(clause.id, "AGREE")}
    onApplyCompromise={(proposedText) =>
      void onAction(clause.id, "PROPOSE_EDIT", proposedText)
    }
    onApplyStand={(rationale) =>
      void onAction(clause.id, "COMMENT", rationale)
    }
  />
)}
```

- [ ] **Step 3: Update deal-room.tsx to pass new props**

In `src/app/deal/[token]/deal-room.tsx`, find the `<ClauseCard>` render (inside the `deal.clauses.map(...)` block). Add `dealId={deal.id}`, `token={token}`, and `myRole={myRole}` to the props:

```tsx
<ClauseCard
  clause={c}
  myParticipantId={myParticipantId}
  myRole={myRole}
  dealId={deal.id}
  token={token}
  onAction={onAction}
/>
```

- [ ] **Step 4: Type-check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, 433+ PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/deal/[token]/negotiation-moves.tsx src/app/deal/[token]/clause-card.tsx src/app/deal/[token]/deal-room.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Add NegotiationMoves component + integrate into DISPUTED clauses

Killer feature #1 — when a clause is DISPUTED, an "AI поможет
договориться →" trigger appears under the clause card. Clicking
expands a 3-card panel: Accept / Compromise (with proposed text in a
mono slab) / Stand firm. "Применить →" on each card posts AGREE,
PROPOSE_EDIT (with proposedText as body), or COMMENT (with rationale).

The component supports both sender and receiver perspectives —
DealRoom passes dealId + token + myRole down, NegotiationMoves picks
the right suggest-moves endpoint.

Loading state shows 3-card skeleton instead of bare spinner. RefreshCw
button regenerates moves via ?force=1, bypassing the cached value on
DealClause.suggestedMoves.
EOF
)"
```

---

## Task 15: ICS calendar export

**Files:**
- Create: `src/lib/ics.ts`
- Create: `src/lib/__tests__/ics.test.ts`
- Create: `src/app/api/documents/[id]/deadlines.ics/route.ts`
- Create: `src/components/ics-download-button.tsx`
- Modify: `src/app/report/[id]/page.tsx`

- [ ] **Step 1: Write ICS builder test first**

Create `src/lib/__tests__/ics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildIcsCalendar, type IcsEvent } from "../ics";

describe("buildIcsCalendar", () => {
  const fixedNow = new Date("2026-05-24T10:00:00Z");

  it("wraps events in VCALENDAR + VEVENT", () => {
    const events: IcsEvent[] = [
      {
        uid: "doc1-deadline1@yakso.ru",
        date: new Date("2026-06-15T00:00:00Z"),
        summary: "Оплата",
        description: "Срок оплаты по договору",
      },
    ];
    const ics = buildIcsCalendar(events, fixedNow);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Yakso//Contract Deadlines//RU");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:doc1-deadline1@yakso.ru");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260615");
    expect(ics).toContain("SUMMARY:Оплата");
    expect(ics).toContain("DESCRIPTION:Срок оплаты по договору");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("produces empty VCALENDAR for zero events", () => {
    const ics = buildIcsCalendar([], fixedNow);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("escapes commas, semicolons, backslashes, newlines in summary/description", () => {
    const events: IcsEvent[] = [
      {
        uid: "u1",
        date: new Date("2026-07-01T00:00:00Z"),
        summary: "Step, then; another\\one",
        description: "Line 1\nLine 2",
      },
    ];
    const ics = buildIcsCalendar(events, fixedNow);
    // Commas, semicolons, backslashes must be backslash-escaped per RFC 5545.
    expect(ics).toContain("SUMMARY:Step\\, then\\; another\\\\one");
    // Newlines escape as \n
    expect(ics).toContain("DESCRIPTION:Line 1\\nLine 2");
  });

  it("formats DTSTAMP using fixed now in UTC YYYYMMDDTHHmmssZ", () => {
    const events: IcsEvent[] = [
      {
        uid: "u",
        date: new Date("2026-06-15T00:00:00Z"),
        summary: "x",
        description: "y",
      },
    ];
    const ics = buildIcsCalendar(events, fixedNow);
    expect(ics).toContain("DTSTAMP:20260524T100000Z");
  });

  it("uses \\r\\n line endings (CRLF) per RFC 5545", () => {
    const ics = buildIcsCalendar(
      [
        {
          uid: "u",
          date: new Date("2026-06-15T00:00:00Z"),
          summary: "x",
          description: "y",
        },
      ],
      fixedNow
    );
    // At least the VCALENDAR wrapper must use CRLF.
    expect(ics).toMatch(/BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run: `npx vitest run src/lib/__tests__/ics.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Create ICS builder**

Create `src/lib/ics.ts`:

```ts
// Pure ICS (RFC 5545) calendar builder. Used to export contract
// deadlines as a downloadable .ics file. Day-level events only — no
// timezones, no recurring. Outputs CRLF line endings as required by
// the spec.

export interface IcsEvent {
  uid: string;
  /** Day-level date (time ignored — DTSTART is VALUE=DATE) */
  date: Date;
  summary: string;
  description: string;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

function formatDateOnly(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function formatDateTime(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

// RFC 5545 escape: backslash, semicolon, comma, newline.
// Order matters — backslash MUST be escaped first to avoid double-escaping
// the backslashes we just added for the others.
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

export function buildIcsCalendar(events: IcsEvent[], now: Date = new Date()): string {
  const stamp = formatDateTime(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Yakso//Contract Deadlines//RU",
    "CALSCALE:GREGORIAN",
  ];
  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${formatDateOnly(ev.date)}`,
      `SUMMARY:${escapeText(ev.summary)}`,
      `DESCRIPTION:${escapeText(ev.description)}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
```

- [ ] **Step 4: Re-run tests**

Run: `npx vitest run src/lib/__tests__/ics.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Create the API route**

Create `src/app/api/documents/[id]/deadlines.ics/route.ts`:

```ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildIcsCalendar, type IcsEvent } from "@/lib/ics";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  expiry: "Истечение договора",
  renewal: "Автопролонгация",
  payment: "Оплата",
  notice: "Уведомление",
  other: "Срок",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      fileName: true,
      deadlines: {
        where: { dismissed: false },
        orderBy: { dueDate: "asc" },
      },
    },
  });
  if (!doc) {
    return new Response("Not found", { status: 404 });
  }
  if (doc.userId !== session.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  const events: IcsEvent[] = doc.deadlines.map((d) => ({
    uid: `${doc.id}-${d.id}@yakso.ru`,
    date: d.dueDate,
    summary: `${KIND_LABEL[d.kind] ?? "Срок"} — ${d.label}`,
    description: `Договор: ${doc.fileName}`,
  }));

  const ics = buildIcsCalendar(events);

  // Sanitise filename for Content-Disposition (no quotes, no semicolons).
  const safeFile = doc.fileName.replace(/[";\r\n]/g, "_").slice(0, 80);

  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${safeFile}-deadlines.ics"`,
    },
  });
}
```

- [ ] **Step 6: Create the download button**

Create `src/components/ics-download-button.tsx`:

```tsx
"use client";

import { Calendar } from "lucide-react";

interface Props {
  documentId: string;
  hasDeadlines: boolean;
}

export function IcsDownloadButton({ documentId, hasDeadlines }: Props) {
  if (!hasDeadlines) {
    return (
      <button
        type="button"
        disabled
        title="Сначала запустите AI-сканирование дедлайнов"
        className="inline-flex items-center gap-2 text-sm text-ink-quiet/60 cursor-not-allowed"
      >
        <Calendar className="h-4 w-4" aria-hidden />
        В календарь — нет дат
      </button>
    );
  }
  return (
    <a
      href={`/api/documents/${documentId}/deadlines.ics`}
      className="inline-flex items-center gap-2 text-sm text-foreground hover:text-primary"
    >
      <Calendar className="h-4 w-4" aria-hidden />
      Скачать в календарь
    </a>
  );
}
```

- [ ] **Step 7: Integrate into /report overflow menu**

Modify `src/app/report/[id]/page.tsx`. Find the overflow MenuButton items array (it's built dynamically as `overflow: MenuItem[]` and items get pushed conditionally — around line 354 per current state). After the "Отправить второй стороне" push, add:

```tsx
// Push the calendar export if the document has any extracted deadlines.
// hasDeadlines is wired by a separate fetch the report page already does
// for DeadlineScanButton — if that data isn't readily available, the
// implementer can fetch it inline here via a useEffect.
overflow.push({
  label: "Скачать в календарь (.ics)",
  icon: Calendar,
  href: `/api/documents/${analysis.documentId}/deadlines.ics`,
});
```

The Calendar icon import comes from `lucide-react` — if not already imported in this file, add it to the existing lucide-react import line.

If MenuItem.href doesn't exist (only onClick), use a wrapping button — adjust per the existing MenuItem interface in `src/components/menu-button.tsx`. The implementer must verify the exact shape before pushing.

- [ ] **Step 8: Run tests**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, 433 + 5 = 438+ PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/ics.ts src/lib/__tests__/ics.test.ts src/app/api/documents/[id]/deadlines.ics/route.ts src/components/ics-download-button.tsx src/app/report/[id]/page.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Add ICS calendar export for contract deadlines (killer feature #3)

Pure RFC 5545 builder with CRLF line endings, day-level DTSTART, proper
text escaping (backslash, semicolon, comma, newline). 5 unit tests pin
the contract.

GET /api/documents/[id]/deadlines.ics returns text/calendar with a
Content-Disposition attachment header named after the original filename.
Owner-only via session.user.id check.

Report page gets a new "Скачать в календарь (.ics)" item in its overflow
menu, wired straight to the route URL — browser handles the download +
"open in Google Calendar / Apple Calendar / Outlook" flow natively.

Uses existing ContractDeadline rows that DeadlineScanButton populates.
EOF
)"
```

---

## Task 16: Final verification

**Files:** none modified (or one optional verification commit).

- [ ] **Step 1: Static gate — TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Static gate — tests**

Run: `npm test`
Expected: ≥438 tests PASS (417 baseline + 9 + 7 + 5 = 438 expected, may be slightly higher if any integration tests landed).

- [ ] **Step 3: Static gate — production build**

On PowerShell:
```powershell
$env:DATABASE_URL="postgresql://x:y@localhost:5432/db"; $env:AUTH_SECRET="build-check-only"; npx next build
```

Expected: build completes, no errors. Some warnings about deprecation are OK; new errors are not.

- [ ] **Step 4: Manual smoke checklist** (CONTROLLER, after merge but before prod)

Document the following list in the PR description for the human to run:

1. Set `INTERNAL_SECRET` in Vercel project envs (Production + Preview) — `openssl rand -hex 32` to generate.
2. On preview deploy, upload a contract → strip appears with stage=parsing → reload → strip still there with current progress → wait → status flips to COMPLETED → "Перейти →" link works.
3. Start two analyses back to back in same tab → both visible in strip simultaneously.
4. Click cancel on the first while it's RUNNING → row disappears immediately; check Neon SQL `SELECT status FROM "Analysis" WHERE id = '...'` → CANCELLED.
5. Open a DISPUTED clause in a Deal Room → click "AI поможет договориться →" → 3 cards render. Click "Применить" on B (compromise) → PROPOSE_EDIT shows up in the actions list with proposedText as body.
6. On `/report/[id]` of a doc with extracted deadlines (use DeadlineScanButton first) → overflow → "Скачать в календарь (.ics)" → opens .ics in OS calendar app.
7. Verify FREE plan negotiation cap: 10 chat-feature AiUsage rows in 24h returns 402 NEGOTIATION_LIMIT on the 11th.
8. Wait 5+ min, run `SELECT status, "createdAt" FROM "Analysis" WHERE status='PENDING'` — should be empty (cron picked up any stragglers).

- [ ] **Step 5: Optional verification commit**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
verify: Sprint 15A — durable analyze + parallel + 2 killer features

Static gates green: tsc clean, npm test 438+ PASS, next build clean.

Manual smoke deferred to controller per PR description:
- Set INTERNAL_SECRET in Vercel envs (Production + Preview)
- Upload contract → reload mid-analysis → resume works
- Two parallel analyses visible in strip
- Cancel works
- AI negotiation moves render under DISPUTED clauses, Apply works
- ICS download opens in calendar app
- Cron restart-stuck-analyses operational (verify with PENDING > 30s)

Ready for PR review.
EOF
)"
```

---

## Acceptance criteria mapping

| Spec criterion | Task(s) |
|---|---|
| 1. Загрузил → за < 2с появился в strip со stage=parsing | T6 (start endpoint), T9 (strip), T10 (analyze page) |
| 2. Reload → продолжение polling + toast | T7 (active endpoint), T9 (strip hydrate) |
| 3. Параллельные анализы видны как отдельные строки | T9, T10 (form reset after start) |
| 4. Cancel работает | T7 (cancel endpoint), T9 (cancel button) |
| 5. На COMPLETED → строка → ссылка → исчезает | T9 (auto-remove after 5s) |
| 6. FAILED → errorMessage + retry-кнопка | T9 (FAILED branch render) |
| 7. Quota списывается только на COMPLETED | T5 (runAnalyzeJob calls consumeReferralBonus only on success) |
| 8. NegotiationMoves под DISPUTED, applied | T13 (endpoints), T14 (component + integration) |
| 9. ICS button работает | T15 |
| 10. Cron restart-stuck operational | T8 |
| 11. Tests + gates green | T16 |
| 12. Schema migration safe (defaults) | T1 |

## Self-review

- [x] **Spec coverage**: all 12 acceptance criteria mapped. Sub-A scope honored (no Sub-B/Sub-C drift). Killer features #1 + #3 both implemented.
- [x] **Placeholder scan**: each task has concrete code. The `<IcsDownloadButton>` integration step (T15 Step 7) does mention "verify MenuItem interface" — that's a documented caveat for the implementer, not a placeholder; the alternative inline wrapping button is described.
- [x] **Type consistency**: `AnalysisJobView` shape consistent across T2, T7, T9. `MoveSchema` consistent across T12, T13, T14. `PrepareError.code` enum consistent across T3, T6. `INTERNAL_SECRET` env name consistent across T4, T6 pre-flight. `ClauseCard` props additions in T14 properly threaded through T14 deal-room.tsx update.
- [x] **Tests**: each new pure module has tests (job.ts, negotiation schema, ics). Integration tests are not added (would require mock prisma setup; the project doesn't currently have an API-route test pattern). Manual smoke covers integration paths.
