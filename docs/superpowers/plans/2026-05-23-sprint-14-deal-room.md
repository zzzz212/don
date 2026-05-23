# Sprint 14 — Deal Room MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the receiver-first Deal Room MVP — two-party contract negotiation with one-sided Counter-AI, anonymous receiver flow via `/deal/[token]`, agree/disagree/comment per-clause mechanics, and invite email.

**Architecture:** Four new Prisma models (`Deal`, `DealParticipant`, `DealClause`, `ClauseAction`) extending the existing `Document` + `Analysis` chain. A new `counterPerspective` field on `AnalysisRiskSchema` (`.optional()` for backward compat). Six new API routes — three sender-authed, three receiver-anonymous (session-cookie identity). One new page `/deal/[token]` with two-column layout, served outside AppShell. Email invite via existing Resend infra. Sprint 14 does NOT touch sidebar/landing/pricing/realtime — those land in Sprint 15/16.

**Tech Stack:** Next.js 16 (App Router), Prisma + Neon Postgres, vitest, NextAuth v5 beta, Resend, Tailwind 4, zod.

**Spec reference:** `docs/superpowers/specs/2026-05-23-sprint-14-deal-room-design.md`

**Branch strategy:** Sprint 14 work happens on `claude/sprint-8-ui-polish` (the active branch — PR #7 still open). New branch `claude/sprint-14-deal-room` only created if PR #7 merges before Sprint 14 starts.

---

## Task 1: Prisma schema — Deal models

**Files:**
- Modify: `prisma/schema.prisma` (append new models, add relations to `User` and `Document`)

- [ ] **Step 1: Add four new models at end of `prisma/schema.prisma`**

Append after the existing `WorkspaceMessage` model (last block in file):

```prisma
// ── Deal Room (Sprint 14) ─────────────────────────────────────────
// Two-party contract negotiation space. A Deal binds a Document to a
// pair of participants (one SENDER + one RECEIVER in Sprint 14;
// multi-party deferred to Sprint 17+). Receiver opens via inviteToken
// without logging in — session-cookie identity, stored as guestName
// on DealParticipant.
model Deal {
  id          String   @id @default(cuid())
  ownerId     String
  orgId       String
  documentId  String
  title       String
  // ACTIVE — at least one participant still has unresolved clauses.
  // AGREED — every clause has AGREED status from both participants.
  // Sprint 15 adds DECLINED and EXPIRED.
  status      String   @default("ACTIVE")
  // 192-bit hex (48 chars) used as the public `/deal/[token]` URL.
  // Uniqueness enforced in application code (foot-gun #38 — nullable
  // unique on Postgres trips Prisma db push), backed by @@index.
  inviteToken String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  owner        User           @relation("DealOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  organization Organization   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  document     Document       @relation(fields: [documentId], references: [id], onDelete: Cascade)
  participants DealParticipant[]
  clauses      DealClause[]

  @@index([ownerId])
  @@index([orgId])
  @@index([documentId])
}

model DealParticipant {
  id          String    @id @default(cuid())
  dealId      String
  // "SENDER" | "RECEIVER" — Sprint 14 invariant: exactly one of each.
  role        String
  // Set when the participant is a logged-in user (always for SENDER,
  // optional for RECEIVER if they sign in mid-flow).
  userId      String?
  // Set for anonymous RECEIVER via session cookie. Either userId OR
  // sessionId is non-null on any RECEIVER row.
  sessionId   String?
  // Display name the receiver enters in the identify modal. Falls back
  // to "Гость" if blank.
  guestName   String?
  guestEmail  String?
  joinedAt    DateTime  @default(now())
  lastSeenAt  DateTime  @default(now())

  deal    Deal              @relation(fields: [dealId], references: [id], onDelete: Cascade)
  user    User?             @relation("DealParticipantUser", fields: [userId], references: [id], onDelete: SetNull)
  actions ClauseAction[]

  @@unique([dealId, role])
  @@index([sessionId])
  @@index([userId])
}

model DealClause {
  id          String   @id @default(cuid())
  dealId      String
  ord         Int
  // Raw text of the clause from the analysed contract. Mirrors
  // AnalysisRisk.originalText for clauses corresponding to risks; for
  // neutral clauses, taken from preSigningChecklist or document body.
  text        String
  // "critical" | "medium" | "low" | "none" — mirrors the analyze schema.
  riskLevel   String   @default("none")
  // Snapshot of the analyze output for the sender's side, JSON-encoded.
  // Shape matches AnalysisRiskSchema (description, consequence,
  // recommendation, legalReference).
  yourSide    Json
  // Counter-AI inference: what the other party gains from this clause.
  // Optional because not every clause has a meaningful counter-position
  // (e.g. boilerplate). Shape: { theirGain: string, compromise?: string }.
  theirSide   Json?
  // PENDING — no action yet, or only partial action.
  // AGREED — both participants AGREE'd this clause.
  // DISPUTED — at least one DISAGREE recorded.
  // RESOLVED — was DISPUTED, now both participants AGREE.
  status      String   @default("PENDING")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  deal    Deal           @relation(fields: [dealId], references: [id], onDelete: Cascade)
  actions ClauseAction[]

  @@index([dealId, ord])
}

model ClauseAction {
  id            String   @id @default(cuid())
  clauseId      String
  participantId String
  // "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT"
  kind          String
  // Free-text body. Empty for AGREE/DISAGREE, required for COMMENT and
  // PROPOSE_EDIT.
  body          String?
  createdAt     DateTime @default(now())

  clause      DealClause      @relation(fields: [clauseId], references: [id], onDelete: Cascade)
  participant DealParticipant @relation(fields: [participantId], references: [id], onDelete: Cascade)

  @@index([clauseId, createdAt])
  @@index([participantId])
}
```

- [ ] **Step 2: Add User relations**

Open `prisma/schema.prisma`, find the `User` model (around line 12), add to the relations block (after `workspaceMessages WorkspaceMessage[]` line around line 103):

```prisma
  // Deal Room (Sprint 14).
  dealsOwned          Deal[]            @relation("DealOwner")
  dealParticipations  DealParticipant[] @relation("DealParticipantUser")
```

- [ ] **Step 3: Add Organization relation**

Find the `Organization` model (search for `model Organization {`). Add to its relations block:

```prisma
  deals Deal[]
```

- [ ] **Step 4: Add Document relation**

Find `model Document {` (line 399). Add to its relations block (after `publicShares PublicShare[]`):

```prisma
  deals Deal[]
```

- [ ] **Step 5: Run `prisma db push`**

Run: `npx prisma db push`

Expected: confirmation that 4 new tables are created, no warning about data loss. If push refuses citing data-loss risk, DO NOT add `--accept-data-loss` — investigate and adjust schema (foot-gun: project rule, CLAUDE.md commit policy).

- [ ] **Step 6: Regenerate Prisma client**

Run: `npx prisma generate`

Expected: client regenerated with new `Deal`, `DealParticipant`, `DealClause`, `ClauseAction` types.

- [ ] **Step 7: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: zero errors. New Prisma types are available via `prisma.deal`, `prisma.dealParticipant`, etc.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "Add Deal Room schema — Deal, DealParticipant, DealClause, ClauseAction"
```

---

## Task 2: Counter-AI schema extension

**Files:**
- Modify: `src/lib/ai/schemas/analyze.ts`
- Test: `src/lib/__tests__/analyze-schema.test.ts` (new file — no existing test for analyze schema; add one)

- [ ] **Step 1: Write failing test for back-compat parsing**

Create `src/lib/__tests__/analyze-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { AnalysisResultSchema, AnalysisRiskSchema } from "../ai/schemas/analyze";

describe("AnalysisRiskSchema with counterPerspective", () => {
  const baseRisk = {
    clauseNumber: "1.2",
    clauseTitle: "Срок поставки",
    level: "critical" as const,
    description: "Штраф 0.5%/день",
    legalReference: "ст. 333 ГК РФ",
    originalText: "Срок поставки — 30 дней",
    recommendedText: "Срок поставки — 45 дней",
    recommendation: "Увеличить срок",
  };

  it("accepts a risk without counterPerspective (back-compat)", () => {
    const result = AnalysisRiskSchema.safeParse(baseRisk);
    expect(result.success).toBe(true);
  });

  it("accepts a risk with counterPerspective", () => {
    const withCP = {
      ...baseRisk,
      counterPerspective: {
        theirGain: "Регулярный денежный поток при просрочке",
        compromise: "0.1%, потолок 5%",
      },
    };
    const result = AnalysisRiskSchema.safeParse(withCP);
    expect(result.success).toBe(true);
  });

  it("accepts counterPerspective without compromise (optional inside optional)", () => {
    const withTheirGainOnly = {
      ...baseRisk,
      counterPerspective: { theirGain: "Жёсткая защита от просрочки" },
    };
    const result = AnalysisRiskSchema.safeParse(withTheirGainOnly);
    expect(result.success).toBe(true);
  });

  it("rejects counterPerspective without theirGain", () => {
    const broken = {
      ...baseRisk,
      counterPerspective: { compromise: "0.1%" },
    };
    const result = AnalysisRiskSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run: `npx vitest run src/lib/__tests__/analyze-schema.test.ts`

Expected: 4 tests, "accepts a risk with counterPerspective" and the next two fail because `counterPerspective` is not in the schema yet.

- [ ] **Step 3: Add `CounterPerspectiveSchema` and field**

Edit `src/lib/ai/schemas/analyze.ts`. After `RegistrationSchema` (around line 36), add:

```ts
// Counter-AI: what the other side of the contract gains from a risky
// clause, and an optional compromise wording. One-sided inference in
// Sprint 14 — the AI simulates the other party; real two-sided input
// lands in Sprint 17+. Both fields are stored as JSON on DealClause so
// they survive even if analyze schema changes later.
export const CounterPerspectiveSchema = z.object({
  theirGain: z.string(),
  compromise: z.string().optional(),
});
export type CounterPerspective = z.infer<typeof CounterPerspectiveSchema>;
```

Then modify `AnalysisRiskSchema` (around line 12) to add the field:

```ts
export const AnalysisRiskSchema = z.object({
  clauseNumber: z.string(),
  clauseTitle: z.string(),
  level: RiskLevelSchema,
  description: z.string(),
  consequence: z.string().optional(),
  legalReference: z.string(),
  originalText: z.string(),
  recommendedText: z.string(),
  recommendation: z.string(),
  // Counter-AI (Sprint 14). Optional so analyses persisted before this
  // field existed still parse cleanly — same back-compat treatment as
  // `consequence`.
  counterPerspective: CounterPerspectiveSchema.optional(),
});
```

- [ ] **Step 4: Run test — expect pass**

Run: `npx vitest run src/lib/__tests__/analyze-schema.test.ts`

Expected: 4 tests pass.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `npm test`

Expected: 389 + 4 = 393 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/schemas/analyze.ts src/lib/__tests__/analyze-schema.test.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "Extend analyze schema with Counter-AI counterPerspective field"
```

---

## Task 3: Counter-AI prompt update

**Files:**
- Modify: `src/lib/ai/prompts.ts`

- [ ] **Step 1: Find the analyze prompt's risk-output instructions**

Open `src/lib/ai/prompts.ts`. Search for `ANALYZE_BASE` (top of file). Find the section that defines the per-risk output format — it'll be after the CRITICAL/MEDIUM/LOW lists, where the prompt describes what JSON fields each risk should have.

- [ ] **Step 2: Append Counter-AI instruction to the risk-output spec**

Add the following block to the section where the prompt describes risk fields (look for where `consequence`, `recommendedText`, `recommendation` are described):

```
═══ COUNTER-AI (for every risk) ═══
Для каждого риска добавь поле `counterPerspective` — что выигрывает
ВТОРАЯ сторона договора от этого пункта. Одна короткая строка, без
оценок «плохо/хорошо», просто механика: «жёсткий штраф 0.5%/день
гарантирует им стабильный денежный поток при просрочке».

Если очевиден компромиссный вариант — добавь `counterPerspective.compromise`:
одна формулировка, балансирующая обе стороны. Если компромисс не
очевиден (например, требование императивной нормы) — оставь
compromise пустым (поле опционально).

ПРИМЕР:
{
  "counterPerspective": {
    "theirGain": "Регулярный денежный поток при любой просрочке оплаты",
    "compromise": "Снизить до 0.1%/день, ограничить общий штраф 5% от суммы"
  }
}

НЕ выдумывай compromise если нет реального баланса — оставь пустым.
```

- [ ] **Step 3: Run typecheck and tests**

Run: `npx tsc --noEmit && npm test`

Expected: zero errors, 393 tests pass. Prompt is a string constant — no schema impact unless test mocks it.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/prompts.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "Tell analyze prompt to generate counterPerspective per risk"
```

---

## Task 4: Deal service layer

**Files:**
- Create: `src/lib/deals.ts`
- Test: `src/lib/__tests__/deals.test.ts`

- [ ] **Step 1: Write failing test for token generation**

Create `src/lib/__tests__/deals.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  generateInviteToken,
  reconcileClauseStatus,
  type ClauseActionInput,
} from "../deals";

describe("generateInviteToken", () => {
  it("produces a 48-char hex string (192 bits)", () => {
    const token = generateInviteToken();
    expect(token).toMatch(/^[0-9a-f]{48}$/);
  });

  it("is different across consecutive calls", () => {
    const tokens = new Set([
      generateInviteToken(),
      generateInviteToken(),
      generateInviteToken(),
    ]);
    expect(tokens.size).toBe(3);
  });
});

describe("reconcileClauseStatus", () => {
  // Helper: produce a ClauseActionInput[] from terse [participantId, kind] pairs.
  const acts = (pairs: Array<[string, "AGREE" | "DISAGREE"]>): ClauseActionInput[] =>
    pairs.map(([p, k]) => ({ participantId: p, kind: k, createdAt: new Date() }));

  it("returns PENDING when there are no actions", () => {
    expect(reconcileClauseStatus(acts([]), "sender", "receiver")).toBe("PENDING");
  });

  it("returns PENDING when only one side has acted", () => {
    expect(reconcileClauseStatus(acts([["sender", "AGREE"]]), "sender", "receiver"))
      .toBe("PENDING");
  });

  it("returns AGREED when both sides AGREE", () => {
    expect(
      reconcileClauseStatus(
        acts([["sender", "AGREE"], ["receiver", "AGREE"]]),
        "sender",
        "receiver"
      )
    ).toBe("AGREED");
  });

  it("returns DISPUTED when at least one side DISAGREEs", () => {
    expect(
      reconcileClauseStatus(
        acts([["sender", "AGREE"], ["receiver", "DISAGREE"]]),
        "sender",
        "receiver"
      )
    ).toBe("DISPUTED");
  });

  it("uses the LATEST action per participant (overrides earlier votes)", () => {
    expect(
      reconcileClauseStatus(
        acts([
          ["sender", "AGREE"],
          ["receiver", "DISAGREE"],
          ["receiver", "AGREE"], // newer
        ]),
        "sender",
        "receiver"
      )
    ).toBe("AGREED");
  });
});
```

- [ ] **Step 2: Run — expect fail (module missing)**

Run: `npx vitest run src/lib/__tests__/deals.test.ts`

Expected: fail with "Cannot find module '../deals'".

- [ ] **Step 3: Create `src/lib/deals.ts`**

```ts
import { randomBytes } from "crypto";

// 192-bit (24 bytes → 48 hex chars) unguessable token used as the
// public `/deal/[token]` URL. Uniqueness is enforced by the DB schema's
// @@unique constraint; callers should wrap creation in a retry loop on
// the rare collision (same pattern as referralCode — foot-gun #38).
export function generateInviteToken(): string {
  return randomBytes(24).toString("hex");
}

export interface ClauseActionInput {
  participantId: string;
  kind: "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT";
  createdAt: Date;
}

export type ClauseStatus = "PENDING" | "AGREED" | "DISPUTED" | "RESOLVED";

// Given the full action history for a single clause and the two
// participant IDs (sender + receiver), determine the clause status.
//
// Rule: take each participant's most recent AGREE/DISAGREE (ignoring
// COMMENT and PROPOSE_EDIT actions). If both AGREE → AGREED. If at
// least one DISAGREE → DISPUTED. Otherwise → PENDING.
//
// RESOLVED is reserved for clauses that were DISPUTED but later both
// AGREE'd — the reconciliation produces AGREED for that case; the
// `RESOLVED` distinction is tracked separately in Sprint 15 (history).
export function reconcileClauseStatus(
  actions: ClauseActionInput[],
  senderId: string,
  receiverId: string
): ClauseStatus {
  const latestVote = (participantId: string): "AGREE" | "DISAGREE" | null => {
    const votes = actions
      .filter((a) => a.participantId === participantId)
      .filter((a) => a.kind === "AGREE" || a.kind === "DISAGREE")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return (votes[0]?.kind as "AGREE" | "DISAGREE" | undefined) ?? null;
  };

  const senderVote = latestVote(senderId);
  const receiverVote = latestVote(receiverId);

  if (senderVote === "DISAGREE" || receiverVote === "DISAGREE") return "DISPUTED";
  if (senderVote === "AGREE" && receiverVote === "AGREE") return "AGREED";
  return "PENDING";
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/__tests__/deals.test.ts`

Expected: 7 tests pass.

- [ ] **Step 5: Add `createDealFromDocument` helper (DB-touching, integration test deferred)**

Append to `src/lib/deals.ts`:

```ts
import { prisma } from "./db";
import type { AnalysisRisk } from "./ai/schemas/analyze";

export interface CreateDealArgs {
  ownerId: string;
  orgId: string;
  documentId: string;
  counterpartyEmail: string;
  counterpartyName?: string;
  title?: string;
}

export interface CreateDealResult {
  deal: { id: string; inviteToken: string };
  clauseCount: number;
}

// Create a Deal from an already-analysed Document. Materialises one
// DealClause per AnalysisRisk (clauses without risks aren't tracked —
// only the contentious points need negotiation). Also creates the
// SENDER and RECEIVER DealParticipant rows. The RECEIVER row starts
// blank (no sessionId, no userId) — it gets filled in when the
// receiver first opens /deal/[token].
//
// Throws if the document has no Analysis (caller must wait for analyze
// to finish). Sprint 14 keeps this synchronous for simplicity; if it
// becomes a perf issue, Sprint 15 promotes to background job.
export async function createDealFromDocument(
  args: CreateDealArgs
): Promise<CreateDealResult> {
  const doc = await prisma.document.findFirst({
    where: { id: args.documentId, userId: args.ownerId },
    include: { analysis: true },
  });
  if (!doc) throw new Error("Document not found or not owned by sender");
  if (!doc.analysis) throw new Error("Document has not been analysed yet");

  // Analysis.risks is a JSON string column. Parse and treat as risks[].
  let parsedRisks: AnalysisRisk[];
  try {
    parsedRisks = JSON.parse(doc.analysis.risks) as AnalysisRisk[];
  } catch {
    throw new Error("Analysis.risks is malformed JSON");
  }

  // Unique inviteToken via retry. Collisions on 192-bit are
  // astronomically unlikely but the @@unique constraint will catch it.
  let token = generateInviteToken();
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await prisma.deal.findUnique({
      where: { inviteToken: token },
    });
    if (!existing) break;
    token = generateInviteToken();
  }

  const result = await prisma.$transaction(async (tx) => {
    const deal = await tx.deal.create({
      data: {
        ownerId: args.ownerId,
        orgId: args.orgId,
        documentId: args.documentId,
        title: args.title ?? doc.fileName,
        inviteToken: token,
        participants: {
          create: [
            { role: "SENDER", userId: args.ownerId },
            { role: "RECEIVER", guestEmail: args.counterpartyEmail, guestName: args.counterpartyName },
          ],
        },
        clauses: {
          create: parsedRisks.map((risk, idx) => ({
            ord: idx,
            text: risk.originalText,
            riskLevel: risk.level,
            yourSide: {
              description: risk.description,
              consequence: risk.consequence ?? null,
              recommendation: risk.recommendation,
              recommendedText: risk.recommendedText,
              legalReference: risk.legalReference,
            },
            theirSide: risk.counterPerspective ?? null,
          })),
        },
      },
      select: { id: true, inviteToken: true, _count: { select: { clauses: true } } },
    });
    return deal;
  });

  return {
    deal: { id: result.id, inviteToken: result.inviteToken },
    clauseCount: result._count.clauses,
  };
}
```

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc --noEmit`

Expected: zero errors. (No unit test for `createDealFromDocument` — it's DB-touching, covered indirectly via API route tests in Task 6.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/deals.ts src/lib/__tests__/deals.test.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "Add Deal service layer: token gen, status reconciliation, deal creation"
```

---

## Task 5: Anonymous receiver session identity

**Files:**
- Create: `src/lib/deal-session.ts`
- Test: `src/lib/__tests__/deal-session.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/__tests__/deal-session.test.ts
import { describe, it, expect } from "vitest";
import { generateDealSessionId, DEAL_SESSION_COOKIE } from "../deal-session";

describe("generateDealSessionId", () => {
  it("returns a 32-char hex string (128 bits)", () => {
    const id = generateDealSessionId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is different across calls", () => {
    expect(generateDealSessionId()).not.toBe(generateDealSessionId());
  });
});

describe("DEAL_SESSION_COOKIE", () => {
  it("exports the expected cookie name", () => {
    expect(DEAL_SESSION_COOKIE).toBe("yakso_deal_session");
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/lib/__tests__/deal-session.test.ts`

Expected: module-not-found.

- [ ] **Step 3: Implement `src/lib/deal-session.ts`**

```ts
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

// Cookie name for the anonymous receiver session. Scoped to /deal/
// paths in the route handlers (Next 16 cookie API). 128 bits is enough
// for an opaque session id — not used for authentication, only to bind
// repeat actions on the same DealParticipant.
export const DEAL_SESSION_COOKIE = "yakso_deal_session";

export function generateDealSessionId(): string {
  return randomBytes(16).toString("hex");
}

// Read the deal session id from cookies, creating a new one if absent.
// MUST be called from a route handler or server action (Next 16 cookies
// API requires async access). Returns the sessionId and a flag
// indicating whether a new id was just minted (caller may want to set
// the cookie on the response in that case).
export async function getOrCreateDealSessionId(): Promise<{
  sessionId: string;
  isNew: boolean;
}> {
  const jar = await cookies();
  const existing = jar.get(DEAL_SESSION_COOKIE)?.value;
  if (existing && /^[0-9a-f]{32}$/.test(existing)) {
    return { sessionId: existing, isNew: false };
  }
  const sessionId = generateDealSessionId();
  jar.set(DEAL_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/deal",
    // 90 days — long enough for a multi-week negotiation, short enough
    // that abandoned sessions eventually expire.
    maxAge: 60 * 60 * 24 * 90,
    secure: process.env.NODE_ENV === "production",
  });
  return { sessionId, isNew: true };
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/lib/__tests__/deal-session.test.ts`

Expected: 3 tests pass. (We only test the pure-logic generator and constant; the `cookies()` integration is exercised via the API route in later tasks.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/deal-session.ts src/lib/__tests__/deal-session.test.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "Add anonymous deal session identity (cookie-based)"
```

---

## Task 6: Sender API — POST /api/deals + GET /api/deals + GET /api/deals/[id]

**Files:**
- Create: `src/app/api/deals/route.ts`
- Create: `src/app/api/deals/[id]/route.ts`

(Note: rate-limit `deals.create` and `deals.action` reuse the existing `src/lib/rate-limit.ts` infrastructure — no schema change needed there.)

- [ ] **Step 1: Inspect existing rate-limit config**

Run: `grep -n "deals\." src/lib/rate-limit.ts; grep -n "network\." src/lib/rate-limit.ts | head -3`

Expected: no `deals.*` entries; `network.*` entries exist. Pattern is to add a new key to the config map.

- [ ] **Step 2: Add `deals.create` and `deals.action` rate-limit keys**

Open `src/lib/rate-limit.ts`. Find the config block (likely an object literal mapping names → { limit, windowSeconds }). Add:

```ts
  "deals.create": { limit: 10, windowSeconds: 60 },
  "deals.action": { limit: 60, windowSeconds: 60 },
```

If the existing structure uses a different shape, mirror that shape — DO NOT restructure the file.

- [ ] **Step 3: Create `src/app/api/deals/route.ts` (POST + GET)**

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg } from "@/lib/org";
import { rateLimit } from "@/lib/rate-limit";
import { createDealFromDocument } from "@/lib/deals";
import { sendEmail } from "@/lib/email";
import { buildDealInviteEmail } from "@/lib/email/templates/deal-invite";
import { BRAND } from "@/lib/legal-info";
import { logAudit } from "@/lib/audit";
import { reportError } from "@/lib/telemetry";

const CreateSchema = z.object({
  documentId: z.string().min(1),
  counterpartyEmail: z.string().email(),
  counterpartyName: z.string().trim().max(120).optional(),
  message: z.string().trim().max(500).optional(),
});

// POST /api/deals — create a Deal Room from an analysed document and
// send the invite email.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;

    const orgId = await ensureActiveOrg(me);
    if (!orgId) {
      return NextResponse.json({ error: "Нет активной организации" }, { status: 400 });
    }

    const rl = await rateLimit({ key: `deals.create:${me}`, bucket: "deals.create" });
    if (!rl.ok) {
      return NextResponse.json({ error: "Слишком много deals подряд. Подождите минуту." }, { status: 429 });
    }

    const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    const { documentId, counterpartyEmail, counterpartyName, message } = parsed.data;

    const { deal, clauseCount } = await createDealFromDocument({
      ownerId: me,
      orgId,
      documentId,
      counterpartyEmail,
      counterpartyName,
    });

    // Fire-and-forget invite email — failures land in Sentry via
    // sendEmail's internal handler.
    void sendEmail(
      buildDealInviteEmail({
        to: counterpartyEmail,
        fromName: session.user.name ?? session.user.email ?? "Пользователь",
        documentName: deal.id, // overwritten below — fetch title
        dealUrl: `${BRAND.publicUrl}/deal/${deal.inviteToken}`,
        message,
      })
    );

    await logAudit({
      action: "deal.created",
      userId: me,
      orgId,
      payload: { dealId: deal.id, counterpartyEmail, clauseCount },
    });

    return NextResponse.json({
      dealId: deal.id,
      inviteToken: deal.inviteToken,
      url: `${BRAND.publicUrl}/deal/${deal.inviteToken}`,
    });
  } catch (error) {
    await reportError(error, { op: "deals.create" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать сделку" },
      { status: 500 }
    );
  }
}

// GET /api/deals — list deals owned by the viewer's active org.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const orgId = await ensureActiveOrg(session.user.id);
    if (!orgId) return NextResponse.json({ deals: [] });

    const deals = await prisma.deal.findMany({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
      include: {
        participants: {
          where: { role: "RECEIVER" },
          select: { guestName: true, guestEmail: true, lastSeenAt: true },
        },
        _count: { select: { clauses: true } },
      },
    });

    return NextResponse.json({
      deals: deals.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        clauseCount: d._count.clauses,
        receiver: d.participants[0] ?? null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (error) {
    await reportError(error, { op: "deals.list" });
    return NextResponse.json({ error: "Не удалось загрузить сделки" }, { status: 500 });
  }
}
```

**NB**: After this step, the `documentName: deal.id` line is wrong — we need the actual document name. Fix in next step.

- [ ] **Step 4: Fix `documentName` lookup in POST route**

The `createDealFromDocument` result doesn't include the document title. Refactor: after `createDealFromDocument`, fetch `prisma.deal.findUnique({ where: { id: deal.id }, include: { document: { select: { fileName: true } } } })` and use that for the email. Update the POST handler:

```ts
    const fullDeal = await prisma.deal.findUnique({
      where: { id: deal.id },
      select: { title: true, inviteToken: true },
    });

    void sendEmail(
      buildDealInviteEmail({
        to: counterpartyEmail,
        fromName: session.user.name ?? session.user.email ?? "Пользователь",
        documentName: fullDeal?.title ?? "Договор",
        dealUrl: `${BRAND.publicUrl}/deal/${deal.inviteToken}`,
        message,
      })
    );
```

- [ ] **Step 5: Create `src/app/api/deals/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg } from "@/lib/org";
import { reportError } from "@/lib/telemetry";

// GET /api/deals/[id] — full Deal Room state from the sender's
// perspective (clauses, actions, participants).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const orgId = await ensureActiveOrg(session.user.id);
    if (!orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const deal = await prisma.deal.findFirst({
      where: { id, orgId },
      include: {
        participants: true,
        clauses: {
          orderBy: { ord: "asc" },
          include: {
            actions: {
              orderBy: { createdAt: "asc" },
              include: { participant: { select: { id: true, role: true, guestName: true } } },
            },
          },
        },
        document: { select: { fileName: true, rawText: true } },
      },
    });
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ deal });
  } catch (error) {
    await reportError(error, { op: "deals.get" });
    return NextResponse.json({ error: "Ошибка загрузки сделки" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Audit action type addition**

Open `src/lib/audit.ts`. Find the `AuditAction` union type. Add `"deal.created"` and `"deal.clause_action"` to the union (foot-gun #24).

Open `src/app/settings/organization/audit/page.tsx`. Find the `ACTION_LABELS` map. Add:

```ts
  "deal.created": "Создана сделка",
  "deal.clause_action": "Действие в сделке",
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`

Expected: zero errors. (Routes are exercised via manual smoke test in Task 11 — no integration test framework yet.)

- [ ] **Step 8: Commit**

```bash
git add src/app/api/deals src/lib/rate-limit.ts src/lib/audit.ts src/app/settings/organization/audit/page.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "Add sender API: POST /api/deals, GET /api/deals, GET /api/deals/[id]"
```

---

## Task 7: Sender clause-action endpoint

**Files:**
- Create: `src/app/api/deals/[id]/clauses/[clauseId]/actions/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg } from "@/lib/org";
import { rateLimit } from "@/lib/rate-limit";
import { reconcileClauseStatus } from "@/lib/deals";
import { logAudit } from "@/lib/audit";
import { reportError } from "@/lib/telemetry";

const ActionSchema = z.object({
  kind: z.enum(["AGREE", "DISAGREE", "COMMENT", "PROPOSE_EDIT"]),
  body: z.string().trim().max(2000).optional(),
});

// POST /api/deals/[id]/clauses/[clauseId]/actions — sender posts an
// action (agree / disagree / comment / propose edit) on a clause.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; clauseId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    const orgId = await ensureActiveOrg(me);
    if (!orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: dealId, clauseId } = await params;

    const rl = await rateLimit({ key: `deals.action:${me}`, bucket: "deals.action" });
    if (!rl.ok) {
      return NextResponse.json({ error: "Слишком много действий подряд." }, { status: 429 });
    }

    const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    if ((parsed.data.kind === "COMMENT" || parsed.data.kind === "PROPOSE_EDIT") && !parsed.data.body) {
      return NextResponse.json({ error: "Комментарий не может быть пустым" }, { status: 400 });
    }

    // Verify the clause belongs to a deal owned by sender's org, and
    // locate the SENDER participant in one go.
    const clause = await prisma.dealClause.findFirst({
      where: { id: clauseId, dealId, deal: { orgId } },
      include: {
        deal: {
          include: {
            participants: { select: { id: true, role: true, userId: true } },
          },
        },
      },
    });
    if (!clause) return NextResponse.json({ error: "Clause not found" }, { status: 404 });

    const sender = clause.deal.participants.find((p) => p.role === "SENDER" && p.userId === me);
    const receiver = clause.deal.participants.find((p) => p.role === "RECEIVER");
    if (!sender || !receiver) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Insert action, then recompute clause.status from full action history.
    await prisma.clauseAction.create({
      data: {
        clauseId,
        participantId: sender.id,
        kind: parsed.data.kind,
        body: parsed.data.body ?? null,
      },
    });

    const allActions = await prisma.clauseAction.findMany({
      where: { clauseId },
      select: { participantId: true, kind: true, createdAt: true },
    });
    const newStatus = reconcileClauseStatus(
      allActions.map((a) => ({ ...a, kind: a.kind as "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT" })),
      sender.id,
      receiver.id
    );
    await prisma.dealClause.update({
      where: { id: clauseId },
      data: { status: newStatus },
    });

    // If every clause in the deal is AGREED, flip deal.status.
    const stillOpen = await prisma.dealClause.count({
      where: { dealId, status: { not: "AGREED" } },
    });
    if (stillOpen === 0) {
      await prisma.deal.update({ where: { id: dealId }, data: { status: "AGREED" } });
    }

    await logAudit({
      action: "deal.clause_action",
      userId: me,
      orgId,
      payload: { dealId, clauseId, kind: parsed.data.kind, role: "SENDER" },
    });

    return NextResponse.json({ ok: true, clauseStatus: newStatus });
  } catch (error) {
    await reportError(error, { op: "deals.clause_action.sender" });
    return NextResponse.json({ error: "Ошибка действия" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/deals/[id]/clauses
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "Add sender clause-action endpoint"
```

---

## Task 8: Receiver API — public-by-token endpoints

**Files:**
- Create: `src/app/api/deals/by-token/[token]/route.ts` (GET — full deal state)
- Create: `src/app/api/deals/by-token/[token]/identify/route.ts` (POST — set guest name)
- Create: `src/app/api/deals/by-token/[token]/clauses/[clauseId]/actions/route.ts` (POST — receiver action)

- [ ] **Step 1: Create GET /api/deals/by-token/[token]**

```ts
// src/app/api/deals/by-token/[token]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getOrCreateDealSessionId } from "@/lib/deal-session";
import { reportError } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

// GET /api/deals/by-token/[token] — anonymous receiver opens a Deal
// Room. First visit creates/binds a DealParticipant to the session
// cookie; subsequent visits update lastSeenAt. If the requester is
// authenticated AND owns the deal, returns the SENDER's participantId
// instead — same page reused for both roles in Sprint 14.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const session = await auth();

    const deal = await prisma.deal.findUnique({
      where: { inviteToken: token },
      include: {
        participants: { include: { user: { select: { name: true } } } },
        clauses: {
          orderBy: { ord: "asc" },
          include: {
            actions: {
              orderBy: { createdAt: "asc" },
              include: {
                participant: {
                  select: { id: true, role: true, guestName: true, user: { select: { name: true } } },
                },
              },
            },
          },
        },
        document: { select: { fileName: true, rawText: true } },
        owner: { select: { name: true, email: true } },
      },
    });
    if (!deal) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

    // Authenticated owner of this deal → sender perspective.
    const isOwner = !!session?.user?.id && deal.ownerId === session.user.id;
    const sender = deal.participants.find((p) => p.role === "SENDER");
    let myParticipantId: string | null = null;
    let myRole: "SENDER" | "RECEIVER" | null = null;

    if (isOwner && sender) {
      myParticipantId = sender.id;
      myRole = "SENDER";
      await prisma.dealParticipant.update({
        where: { id: sender.id },
        data: { lastSeenAt: new Date() },
      });
    } else {
      // Anonymous receiver path — bind session to RECEIVER participant.
      const { sessionId } = await getOrCreateDealSessionId();
      const receiver = deal.participants.find((p) => p.role === "RECEIVER");
      if (receiver && !receiver.sessionId && !receiver.userId) {
        await prisma.dealParticipant.update({
          where: { id: receiver.id },
          data: { sessionId, lastSeenAt: new Date() },
        });
        myParticipantId = receiver.id;
        myRole = "RECEIVER";
      } else if (receiver && receiver.sessionId === sessionId) {
        await prisma.dealParticipant.update({
          where: { id: receiver.id },
          data: { lastSeenAt: new Date() },
        });
        myParticipantId = receiver.id;
        myRole = "RECEIVER";
      }
      // Sprint 14 invariant: one receiver per deal. Other sessions get
      // read-only view (myParticipantId stays null).
    }

    return NextResponse.json({
      deal: {
        id: deal.id,
        title: deal.title,
        status: deal.status,
        owner: deal.owner,
        document: deal.document,
        participants: deal.participants.map((p) => ({
          id: p.id,
          role: p.role,
          name: p.guestName ?? p.user?.name ?? null,
        })),
        clauses: deal.clauses,
      },
      myParticipantId,
      myRole,
    });
  } catch (error) {
    await reportError(error, { op: "deals.by_token.get" });
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create POST /api/deals/by-token/[token]/identify**

```ts
// src/app/api/deals/by-token/[token]/identify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateDealSessionId } from "@/lib/deal-session";
import { reportError } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

const IdentifySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { sessionId } = await getOrCreateDealSessionId();

    const parsed = IdentifySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Имя обязательно" }, { status: 400 });
    }

    const deal = await prisma.deal.findUnique({
      where: { inviteToken: token },
      include: { participants: { where: { role: "RECEIVER" } } },
    });
    if (!deal) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    const receiver = deal.participants[0];
    if (!receiver) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

    // Receiver can identify themselves if (a) the session matches OR
    // (b) the receiver row was never claimed.
    const canIdentify =
      receiver.sessionId === sessionId ||
      (!receiver.sessionId && !receiver.userId);
    if (!canIdentify) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.dealParticipant.update({
      where: { id: receiver.id },
      data: {
        sessionId,
        guestName: parsed.data.name,
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportError(error, { op: "deals.by_token.identify" });
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create POST /api/deals/by-token/[token]/clauses/[clauseId]/actions**

```ts
// src/app/api/deals/by-token/[token]/clauses/[clauseId]/actions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateDealSessionId } from "@/lib/deal-session";
import { rateLimit } from "@/lib/rate-limit";
import { reconcileClauseStatus } from "@/lib/deals";
import { reportError } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

const ActionSchema = z.object({
  kind: z.enum(["AGREE", "DISAGREE", "COMMENT", "PROPOSE_EDIT"]),
  body: z.string().trim().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; clauseId: string }> }
) {
  try {
    const { token, clauseId } = await params;
    const { sessionId } = await getOrCreateDealSessionId();

    const rl = await rateLimit({ key: `deals.action:${sessionId}`, bucket: "deals.action" });
    if (!rl.ok) {
      return NextResponse.json({ error: "Слишком много действий подряд." }, { status: 429 });
    }

    const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    if ((parsed.data.kind === "COMMENT" || parsed.data.kind === "PROPOSE_EDIT") && !parsed.data.body) {
      return NextResponse.json({ error: "Комментарий не может быть пустым" }, { status: 400 });
    }

    const clause = await prisma.dealClause.findFirst({
      where: { id: clauseId, deal: { inviteToken: token } },
      include: {
        deal: {
          include: {
            participants: { select: { id: true, role: true, sessionId: true, userId: true } },
          },
        },
      },
    });
    if (!clause) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

    const receiver = clause.deal.participants.find(
      (p) => p.role === "RECEIVER" && p.sessionId === sessionId
    );
    const sender = clause.deal.participants.find((p) => p.role === "SENDER");
    if (!receiver || !sender) {
      return NextResponse.json({ error: "Сессия не привязана к сделке. Откройте ссылку заново." }, { status: 403 });
    }

    await prisma.clauseAction.create({
      data: {
        clauseId,
        participantId: receiver.id,
        kind: parsed.data.kind,
        body: parsed.data.body ?? null,
      },
    });

    const allActions = await prisma.clauseAction.findMany({
      where: { clauseId },
      select: { participantId: true, kind: true, createdAt: true },
    });
    const newStatus = reconcileClauseStatus(
      allActions.map((a) => ({ ...a, kind: a.kind as "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT" })),
      sender.id,
      receiver.id
    );
    await prisma.dealClause.update({
      where: { id: clauseId },
      data: { status: newStatus },
    });

    const stillOpen = await prisma.dealClause.count({
      where: { dealId: clause.dealId, status: { not: "AGREED" } },
    });
    if (stillOpen === 0) {
      await prisma.deal.update({ where: { id: clause.dealId }, data: { status: "AGREED" } });
    }

    return NextResponse.json({ ok: true, clauseStatus: newStatus });
  } catch (error) {
    await reportError(error, { op: "deals.by_token.clause_action" });
    return NextResponse.json({ error: "Ошибка действия" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add `/deal/` to robots.txt Disallow**

Open `src/app/robots.ts`. Find the existing Disallow array. Add `"/deal/"` to it (foot-gun: token-protected paths need noindex — same pattern as `/r/`, `/workspace/`).

- [ ] **Step 5: Typecheck and test**

Run: `npx tsc --noEmit && npm test`

Expected: zero TS errors, 393 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/deals/by-token src/app/robots.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "Add receiver API: anonymous /deal/[token] endpoints"
```

---

## Task 9: Invite email template

**Files:**
- Create: `src/lib/email/templates/deal-invite.ts`

- [ ] **Step 1: Create the template**

```ts
// src/lib/email/templates/deal-invite.ts
// Sent to a counterparty (receiver) when a sender creates a Deal Room
// and wants them to review/negotiate the contract. The receiver opens
// the link and lands in /deal/[token] without needing to sign up.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND } from "@/lib/legal-info";

interface DealInviteOptions {
  to: string;
  /** Display name of the sender. */
  fromName: string;
  /** Document title (typically the file name). */
  documentName: string;
  /** Full absolute URL of the /deal/[token] page. */
  dealUrl: string;
  /** Optional personal note from the sender. */
  message?: string;
}

export function buildDealInviteEmail(opts: DealInviteOptions): EmailMessage {
  const who = opts.fromName.trim() || "Пользователь";
  const subject = `${who} хочет согласовать с вами договор — ${BRAND.name}`;

  const noteBlock = opts.message
    ? `
      <p style="margin: 0 0 16px 0; padding: 14px 16px; background: #FAF3E6; border-left: 3px solid #C2613F; border-radius: 4px;">
        <em>«${escape(opts.message)}»</em>
      </p>
    `
    : "";

  const html = renderEmailHtml({
    preview: `${who} отправил вам договор «${opts.documentName}» для согласования.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; line-height: 1.3;">
        Договор для согласования
      </p>
      <p style="margin: 0 0 16px 0;">
        <strong>${escape(who)}</strong> хочет согласовать с вами договор
        <strong>«${escape(opts.documentName)}»</strong>.
      </p>
      ${noteBlock}
      <p style="margin: 0 0 16px 0;">
        Откройте ссылку — Яксо покажет вам разбор договора с вашей стороны
        и где можно поторговаться. Логин не требуется.
      </p>
    `,
    cta: { label: "Открыть договор", url: opts.dealUrl },
  });

  const text = renderEmailText(
    [
      "Договор для согласования",
      `${who} хочет согласовать с вами договор "${opts.documentName}" на сервисе ${BRAND.name}.`,
      opts.message ? `Сообщение: "${opts.message}"` : "",
      "Откройте ссылку — Яксо покажет вам разбор. Логин не требуется.",
    ].filter(Boolean),
    { label: "Открыть договор", url: opts.dealUrl }
  );

  return { to: opts.to, subject, html, text, tag: "deal-invite" };
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: zero errors. (Email is exercised via Noop provider in dev and Resend in prod — no unit test, matches existing template pattern.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/templates/deal-invite.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "Add Deal invite email template"
```

---

## Task 10: Deal Room page UI

**Files:**
- Create: `src/app/deal/[token]/page.tsx`
- Create: `src/app/deal/[token]/deal-room.tsx` (client component)
- Create: `src/app/deal/[token]/clause-card.tsx` (client component)
- Create: `src/app/deal/[token]/identify-modal.tsx` (client component)
- Create: `src/app/deal/[token]/status-bar.tsx` (client component)

(NB: Page is a public route. MUST NOT use `<AppShell>` — that breaks the auth-vs-public chrome rule, foot-gun #44. Page renders raw, then mounts the client `<DealRoom>` component.)

- [ ] **Step 1: Page shell — `src/app/deal/[token]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { DealRoom } from "./deal-room";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Согласование договора",
  robots: { index: false, follow: false },
};

export default async function DealPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // The page deliberately fetches nothing server-side — DealRoom client
  // component owns the initial GET so the session cookie can be set
  // (cookies() in route handler vs page boundary differ in Next 16).
  if (!token || !/^[0-9a-f]{48}$/.test(token)) notFound();

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <Logo />
          <span className="text-sm text-muted">Согласование договора</span>
        </div>
      </header>
      <DealRoom token={token} />
    </div>
  );
}
```

- [ ] **Step 2: `<DealRoom>` client component — `src/app/deal/[token]/deal-room.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { ClauseCard, type ClauseView } from "./clause-card";
import { IdentifyModal } from "./identify-modal";
import { StatusBar } from "./status-bar";

interface DealView {
  id: string;
  title: string;
  status: "ACTIVE" | "AGREED";
  owner: { name: string | null; email: string };
  document: { fileName: string; rawText: string };
  participants: Array<{ id: string; role: "SENDER" | "RECEIVER"; name: string | null }>;
  clauses: ClauseView[];
}

interface DealResponse {
  deal: DealView;
  myParticipantId: string | null;
  myRole: "SENDER" | "RECEIVER" | null;
}

export function DealRoom({ token }: { token: string }) {
  const [deal, setDeal] = useState<DealView | null>(null);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<"SENDER" | "RECEIVER" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsIdentify, setNeedsIdentify] = useState(false);

  const fetchDeal = useCallback(async () => {
    const res = await fetch(`/api/deals/by-token/${token}`, { credentials: "include" });
    if (!res.ok) {
      setError("Не удалось загрузить договор");
      return;
    }
    const data = (await res.json()) as DealResponse;
    setDeal(data.deal);
    setMyParticipantId(data.myParticipantId);
    setMyRole(data.myRole);
    // Identify modal only for anonymous receiver who hasn't named yet.
    if (data.myRole === "RECEIVER") {
      const me = data.deal.participants.find((p) => p.id === data.myParticipantId);
      if (me && !me.name) setNeedsIdentify(true);
    }
  }, [token]);

  useEffect(() => {
    void fetchDeal();
  }, [fetchDeal]);

  const onAction = useCallback(
    async (clauseId: string, kind: "AGREE" | "DISAGREE" | "COMMENT", body?: string) => {
      const url =
        myRole === "SENDER" && deal
          ? `/api/deals/${deal.id}/clauses/${clauseId}/actions`
          : `/api/deals/by-token/${token}/clauses/${clauseId}/actions`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Не удалось сохранить действие");
        return;
      }
      await fetchDeal();
    },
    [token, fetchDeal, myRole, deal]
  );

  if (error) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-center">{error}</div>;
  }
  if (!deal) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-center text-muted">Загрузка…</div>;
  }

  const sender = deal.participants.find((p) => p.role === "SENDER");
  const counterpartName = sender?.name ?? deal.owner.name ?? deal.owner.email;

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{deal.title}</h1>
          <p className="text-sm text-muted">От: {counterpartName}</p>
        </div>
        <div className="space-y-4">
          {deal.clauses.map((c) => (
            <ClauseCard
              key={c.id}
              clause={c}
              myParticipantId={myParticipantId}
              onAction={onAction}
            />
          ))}
        </div>
      </div>
      <StatusBar clauses={deal.clauses} status={deal.status} />
      {needsIdentify && myParticipantId && (
        <IdentifyModal
          token={token}
          onDone={() => {
            setNeedsIdentify(false);
            void fetchDeal();
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: `<ClauseCard>` — `src/app/deal/[token]/clause-card.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/button";

export interface ClauseView {
  id: string;
  ord: number;
  text: string;
  riskLevel: "critical" | "medium" | "low" | "none";
  yourSide: { description: string; consequence?: string | null; recommendation: string; legalReference: string } | null;
  theirSide: { theirGain: string; compromise?: string } | null;
  status: "PENDING" | "AGREED" | "DISPUTED" | "RESOLVED";
  actions: Array<{
    id: string;
    kind: string;
    body: string | null;
    createdAt: string;
    participant: { id: string; role: "SENDER" | "RECEIVER"; guestName: string | null };
  }>;
}

const STATUS_STYLES: Record<ClauseView["status"], string> = {
  PENDING: "border-border bg-card",
  AGREED: "border-green-700/30 bg-green-50/40",
  DISPUTED: "border-rose-700/30 bg-rose-50/40",
  RESOLVED: "border-green-700/30 bg-green-50/40",
};

export function ClauseCard({
  clause,
  myParticipantId,
  onAction,
}: {
  clause: ClauseView;
  myParticipantId: string | null;
  onAction: (
    clauseId: string,
    kind: "AGREE" | "DISAGREE" | "COMMENT",
    body?: string
  ) => Promise<void>;
}) {
  const [commentDraft, setCommentDraft] = useState("");
  const myActions = myParticipantId
    ? clause.actions.filter((a) => a.participant.id === myParticipantId)
    : [];
  const lastVote = myActions
    .filter((a) => a.kind === "AGREE" || a.kind === "DISAGREE")
    .at(-1)?.kind;

  return (
    <div className={`rounded-lg border p-5 ${STATUS_STYLES[clause.status]}`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">
            Пункт {clause.ord + 1}
          </div>
          <p className="text-sm leading-relaxed">{clause.text}</p>
        </div>
        <div className="space-y-3 text-sm">
          {clause.yourSide && (
            <div>
              <div className="font-medium text-primary mb-1">Ваша сторона</div>
              <p className="text-muted">{clause.yourSide.description}</p>
              {clause.yourSide.consequence && (
                <p className="text-xs text-muted mt-1">⚠ {clause.yourSide.consequence}</p>
              )}
            </div>
          )}
          {clause.theirSide && (
            <div>
              <div className="font-medium text-sage mb-1">Другая сторона</div>
              <p className="text-muted">{clause.theirSide.theirGain}</p>
              {clause.theirSide.compromise && (
                <p className="text-xs mt-1">💡 Компромисс: {clause.theirSide.compromise}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant={lastVote === "AGREE" ? "primary" : "ghost"}
          onClick={() => onAction(clause.id, "AGREE")}
          disabled={!myParticipantId}
        >
          ✓ Согласен
        </Button>
        <Button
          size="sm"
          variant={lastVote === "DISAGREE" ? "primary" : "ghost"}
          onClick={() => onAction(clause.id, "DISAGREE")}
          disabled={!myParticipantId}
        >
          ✗ Не согласен
        </Button>
      </div>

      {clause.actions.filter((a) => a.kind === "COMMENT").length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {clause.actions
            .filter((a) => a.kind === "COMMENT")
            .map((a) => (
              <li key={a.id} className="text-muted">
                <strong>{a.participant.guestName ?? a.participant.role}:</strong> {a.body}
              </li>
            ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={commentDraft}
          onChange={(e) => setCommentDraft(e.target.value)}
          placeholder="Оставить комментарий…"
          className="flex-1 rounded border border-border bg-bg px-2 py-1 text-sm"
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={!commentDraft.trim() || !myParticipantId}
          onClick={async () => {
            await onAction(clause.id, "COMMENT", commentDraft);
            setCommentDraft("");
          }}
        >
          Отправить
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `<IdentifyModal>` — `src/app/deal/[token]/identify-modal.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/button";

export function IdentifyModal({
  token,
  onDone,
}: {
  token: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/deals/by-token/${token}/identify`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Не удалось сохранить имя");
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 className="font-serif text-xl font-semibold tracking-tight mb-2">
          Представьтесь
        </h2>
        <p className="text-sm text-muted mb-4">
          Чтобы вторая сторона видела, кто прокомментировал, введите своё имя.
          Email не нужен.
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ваше имя"
          autoFocus
          className="w-full rounded border border-border bg-bg px-3 py-2 mb-2"
        />
        {error && <p className="text-rose-700 text-sm mb-2">{error}</p>}
        <Button
          variant="primary"
          onClick={submit}
          disabled={!name.trim() || submitting}
          className="w-full"
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `<StatusBar>` — `src/app/deal/[token]/status-bar.tsx`**

```tsx
"use client";

import type { ClauseView } from "./clause-card";

export function StatusBar({
  clauses,
  status,
}: {
  clauses: ClauseView[];
  status: "ACTIVE" | "AGREED";
}) {
  const counts = clauses.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const total = clauses.length;
  const agreed = counts.AGREED ?? 0;
  const disputed = counts.DISPUTED ?? 0;
  const pending = total - agreed - disputed;

  return (
    <div className="sticky bottom-0 border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-3 text-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-medium">
            {agreed}/{total} согласовано
          </span>
          {disputed > 0 && <span className="text-rose-700">{disputed} спорных</span>}
          {pending > 0 && <span className="text-muted">{pending} не тронуто</span>}
        </div>
        {status === "AGREED" && (
          <span className="text-green-700 font-medium">✓ Договор согласован</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`

Expected: zero errors. If `text-muted`, `text-sage`, `bg-bg` are not in the Tailwind config, swap to the actual token names from `src/app/globals.css` (`text-muted-foreground`, `text-foreground`, `bg-background`, etc.) — DO NOT add new tokens.

- [ ] **Step 7: Commit**

```bash
git add src/app/deal
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "Add Deal Room page UI: two-column layout, clause cards, identify modal, status bar"
```

---

## Task 11: Integrate Deal creation into existing screens

**Files:**
- Modify: `src/app/analyze/page.tsx` (or wherever the post-analysis CTA renders — see Step 1)
- Modify: `src/app/(app)/dashboard/page.tsx` (add Active Deals section)
- Create: `src/components/send-as-deal.tsx` (modal for creating a Deal)

- [ ] **Step 1: Locate the post-analysis screen**

Run: `grep -rn "Скачать DOCX\|export.*docx" src/app --include="*.tsx" | head -5`

The result tells you which page renders the "Скачать DOCX" button after analyze — that's where the "Отправить второй стороне" button goes next to it. Typically `src/app/report/page.tsx` or a component imported into it.

- [ ] **Step 2: Create `<SendAsDeal>` modal component**

```tsx
// src/components/send-as-deal.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/button";

export function SendAsDeal({
  documentId,
  onClose,
}: {
  documentId: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documentId,
        counterpartyEmail: email.trim(),
        counterpartyName: name.trim() || undefined,
        message: message.trim() || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Не удалось создать сделку");
      return;
    }
    const data = (await res.json()) as { url: string };
    setResult({ url: data.url });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        {!result ? (
          <>
            <h2 className="font-serif text-xl font-semibold tracking-tight mb-2">
              Отправить второй стороне
            </h2>
            <p className="text-sm text-muted mb-4">
              Контрагент откроет договор без регистрации. Он увидит ваш разбор и сможет согласовать пункты или предложить правки.
            </p>
            <label className="block mb-3">
              <span className="text-sm">Email контрагента</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                autoFocus
              />
            </label>
            <label className="block mb-3">
              <span className="text-sm">Имя (необязательно)</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
              />
            </label>
            <label className="block mb-4">
              <span className="text-sm">Сообщение (необязательно)</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 resize-none"
              />
            </label>
            {error && <p className="text-rose-700 text-sm mb-2">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={onClose}>Отмена</Button>
              <Button
                variant="primary"
                onClick={submit}
                disabled={!email.trim() || submitting}
              >
                {submitting ? "Отправляем…" : "Отправить"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-serif text-xl font-semibold tracking-tight mb-2">
              Сделка создана
            </h2>
            <p className="text-sm text-muted mb-2">
              Письмо отправлено. Также вы можете скопировать ссылку:
            </p>
            <div className="rounded border border-border bg-bg px-3 py-2 text-sm break-all mb-4 font-mono">
              {result.url}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="primary"
                onClick={() => {
                  navigator.clipboard.writeText(result.url);
                }}
              >
                Скопировать ссылку
              </Button>
              <Button variant="ghost" onClick={onClose}>Закрыть</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire the button on the report page**

In the file from Step 1 (the analyze report screen):

1. Add `"use client"` if not already present.
2. Import: `import { SendAsDeal } from "@/components/send-as-deal";`
3. Add state: `const [dealOpen, setDealOpen] = useState(false);`
4. Add button next to "Скачать DOCX": `<Button variant="primary" onClick={() => setDealOpen(true)}>Отправить второй стороне</Button>`
5. Mount modal at end of JSX: `{dealOpen && <SendAsDeal documentId={documentId} onClose={() => setDealOpen(false)} />}`

(If the existing button bar uses MenuButton from Sprint 12, add as a new MenuButton item instead.)

- [ ] **Step 4: Add Active Deals section to dashboard**

Open `src/app/(app)/dashboard/page.tsx` (or wherever the dashboard server component is). Find where it fetches user documents. Add a parallel deals fetch:

```ts
const activeDeals = await prisma.deal.findMany({
  where: { orgId, status: "ACTIVE" },
  orderBy: { updatedAt: "desc" },
  take: 5,
  include: {
    participants: { where: { role: "RECEIVER" }, select: { guestName: true, lastSeenAt: true } },
    _count: { select: { clauses: true } },
  },
});
```

Above the existing documents grid, render a section:

```tsx
{activeDeals.length > 0 && (
  <section className="mb-8">
    <h2 className="font-serif text-xl font-semibold tracking-tight mb-3">Активные сделки</h2>
    <ul className="space-y-2">
      {activeDeals.map((d) => (
        <li key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <div>
            <div className="font-medium">{d.title}</div>
            <div className="text-xs text-muted">
              Контрагент: {d.participants[0]?.guestName ?? "ожидает открытия"}
            </div>
          </div>
          <Link href={`/deal/${d.inviteToken}/view`} className="text-sm text-primary hover:underline">
            Открыть →
          </Link>
        </li>
      ))}
    </ul>
  </section>
)}
```

NB: `/deal/[token]/view` doesn't exist — sender opens the deal via the same `/deal/[token]` URL since they're authed. The receiver-binding logic in the GET-by-token route skips re-binding if the deal already has a sender perspective. **Acceptable workaround for Sprint 14**: sender opens via the same token URL; in Sprint 15 we add a proper `/deals/[id]` sender UI. For Sprint 14, the link goes to `/deal/${d.inviteToken}` and the sender sees the same view as the receiver (read-only-ish, agree/disagree from sender side via separate API).

Update the Link href accordingly: `<Link href={\`/deal/\${d.inviteToken}\`}>`. Add a select for `inviteToken` in the prisma query.

- [ ] **Step 5: Update prisma include in dashboard fetch**

```ts
const activeDeals = await prisma.deal.findMany({
  where: { orgId, status: "ACTIVE" },
  orderBy: { updatedAt: "desc" },
  take: 5,
  select: {
    id: true,
    title: true,
    inviteToken: true,
    updatedAt: true,
    participants: {
      where: { role: "RECEIVER" },
      select: { guestName: true, lastSeenAt: true },
    },
    _count: { select: { clauses: true } },
  },
});
```

- [ ] **Step 6: Typecheck + tests**

Run: `npx tsc --noEmit && npm test`

Expected: zero TS errors, 393 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/send-as-deal.tsx src/app/analyze src/app/report src/app/\(app\)/dashboard
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "Wire Deal creation into analyze report + dashboard"
```

---

## Task 12: End-to-end verification (Sprint 14 acceptance)

**Files:** none — manual verification.

This task is mandatory: TypeScript and unit tests prove code correctness; this task proves *feature correctness*. Use `superpowers:verification-before-completion` before marking Sprint 14 done.

- [ ] **Step 1: Static gates**

Run all three:

```bash
npx tsc --noEmit
npm test
DATABASE_URL="postgresql://x:y@localhost:5432/db" AUTH_SECRET="build-check-only-not-a-real-secret" npx next build
```

Expected: all three pass.

- [ ] **Step 2: Manual smoke — sender flow**

1. `npm run dev`
2. Log in as test user.
3. Upload a .docx contract (use any existing test file in repo, e.g. one from `__tests__/fixtures/`).
4. Wait for analyze to finish. Verify each risk now shows a "Counter-AI" or counterPerspective block (or that the field is at least present in the API response — UI is wired in step 11).
5. Click "Отправить второй стороне" → fill modal with a real email → submit.
6. Confirm: response contains `url: "/deal/<48-hex>"`.
7. Check the dev console — Noop email provider logged the invite email body. The URL in the body matches the response.

- [ ] **Step 3: Manual smoke — receiver flow**

1. Copy the `/deal/<token>` URL.
2. Open in an incognito window (fresh session, no cookies).
3. Verify: two-column Deal Room renders, clauses shown, Counter-AI visible per clause, identify modal pops up.
4. Enter name "Тест Получатель", submit.
5. Click "✓ Согласен" on 2 clauses, "✗ Не согласен" on 1.
6. Leave a comment on 1 clause.
7. Verify: status bar at bottom shows correct counts (2 agreed, 1 disputed, rest pending).

- [ ] **Step 4: Manual smoke — sender sees updates**

1. Return to the original sender tab.
2. Refresh dashboard.
3. Click into the deal from "Активные сделки" section.
4. Verify: the receiver's votes are visible. Receiver's name "Тест Получатель" shown.

- [ ] **Step 5: AGREED transition**

1. In sender tab, open the deal via "Активные сделки" → `/deal/[token]`. Confirm UI shows the deal in sender mode (your name in participants, no identify modal).
2. As sender, click AGREE on every clause where the receiver also AGREE'd.
3. Switch back to incognito (receiver) tab, refresh.
4. AGREE on any clauses where sender already AGREE'd but receiver hadn't.
5. Verify: deal status flips to AGREED, status bar shows "✓ Договор согласован" in both tabs after refresh.

- [ ] **Step 6: Document outcome**

Capture in PR description / commit summary:
- Total commits in Sprint 14 (12 atomic, per this plan)
- Lines of code added (approx — from `git diff --stat <branch>`)
- Tests added: ~10 new (4 schema, 5 reconciliation, 3 session, plus token helpers)
- Manual smoke results above

- [ ] **Step 7: Open PR**

NOT this plan's responsibility — user opens PR after Sprint 14 ships. Use `superpowers:finishing-a-development-branch` skill at that point.

---

## Summary of files touched

**New files (15):**
- `prisma/schema.prisma` (modified, 4 new models)
- `src/lib/ai/schemas/analyze.ts` (modified, +CounterPerspectiveSchema)
- `src/lib/ai/prompts.ts` (modified, Counter-AI instruction)
- `src/lib/deals.ts` (new)
- `src/lib/deal-session.ts` (new)
- `src/lib/rate-limit.ts` (modified, 2 new keys)
- `src/lib/audit.ts` (modified, 2 new actions)
- `src/app/api/deals/route.ts` (new)
- `src/app/api/deals/[id]/route.ts` (new)
- `src/app/api/deals/[id]/clauses/[clauseId]/actions/route.ts` (new)
- `src/app/api/deals/by-token/[token]/route.ts` (new)
- `src/app/api/deals/by-token/[token]/identify/route.ts` (new)
- `src/app/api/deals/by-token/[token]/clauses/[clauseId]/actions/route.ts` (new)
- `src/app/deal/[token]/page.tsx` (new) + 4 sub-components
- `src/lib/email/templates/deal-invite.ts` (new)
- `src/components/send-as-deal.tsx` (new)
- `src/app/robots.ts` (modified, +/deal/)
- `src/app/(app)/dashboard/page.tsx` (modified, +Active Deals section)
- `src/app/report/page.tsx` or analogous (modified, +Send to counterparty button)
- `src/app/settings/organization/audit/page.tsx` (modified, +action labels)

**Test files (3 new):**
- `src/lib/__tests__/analyze-schema.test.ts`
- `src/lib/__tests__/deals.test.ts`
- `src/lib/__tests__/deal-session.test.ts`

**Estimated total**: ~15-20 new unit tests, ~1500 lines of new code.

## Sprint 14 acceptance checklist

- [ ] All 12 tasks complete
- [ ] `npx tsc --noEmit` — passes
- [ ] `npm test` — 389 + 15-20 new = ~405-410 tests pass
- [ ] `npx next build` — passes
- [ ] Manual smoke flow (sender → receiver → AGREED transition) verified
- [ ] PR opened with summary linking to spec + plan
