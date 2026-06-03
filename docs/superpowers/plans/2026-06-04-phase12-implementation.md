# Яксо Phase 1+2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (- [ ]) syntax.

**Goal:** Ship the 8 buildable, non-blocked roadmap tasks (DR-1, DR-2, DR-3, DR-6, DR-8, GR-1, AI-7, MON-3-cancel) as one Deal Room PR on claude/sprint-8-ui-polish.

**Architecture:** TDD on pure src/lib cores (vitest excludes src/app); routes/pages are thin glue; atomic commit + tsc/test gate per task.

**Tech Stack:** Next.js 16, React 19, Prisma+Neon, vitest, Anthropic Claude 4.x.

---

## EXECUTION ORDER

The eight tasks fall into two physically disjoint file clusters plus a hard dependency chain inside the Deal Room cluster. The driving constraint: **no two tasks in the same wave may write the same file.** I traced every `modify`/`create` path across all eight sections and grouped accordingly. Below, "track" = an independent stream the controller may run concurrently with the other track; "wave" = a synchronization point inside a track where the next task must wait for the prior one's commit.

### The two parallel tracks

- **Track A — Deal Room cluster** (GR-1, DR-2, AI-7, DR-3, DR-1, DR-8). All six write into the shared deal surface: `src/lib/deals.ts`, `src/lib/deal-status.ts`, `src/lib/analytics/server.ts`, `src/app/api/deals/route.ts`, the two action routes, the by-token GET route, `clause-card.tsx`, and `deal-room.tsx`. These MUST be serialized at every shared-file collision (detailed below). Run Track A as one sequential pipeline.
- **Track B — Billing cluster** (MON-3-cancel). Touches only `src/lib/billing/*`, `src/app/api/billing/{cancel,status}/route.ts`, `src/app/billing/page.tsx`. **Zero file overlap** with Track A — verified: MON-3 never touches `deals*`, `analytics/server.ts`, or any `api/deals/**` path; Track A never touches `billing/**`. MON-3 can run start-to-finish in parallel with the entire Track A pipeline.

> The one nuance: both MON-3 (Step 7 route) and DR-2 want to call `captureEvent`. MON-3 uses event `"subscription_cancel_scheduled"`, and its own Step 7 instructs the worker to **drop the `captureEvent` call if the union rejects it** rather than edit `analytics/server.ts`. So MON-3 must NOT add to the `EventName` union — that keeps `analytics/server.ts` exclusively a Track A file and preserves the disjointness. Honor that: MON-3 does not edit `server.ts`.

### Track A waves (strictly sequential — same physical files)

Run in this exact order. Each wave is one task; each task ends with its own `tsc && npm test` gate and atomic commit before the next begins.

- **Wave A1 — GR-1** (counterparty email optional + share-sheet). Run first. It is the only task that edits `src/app/api/deals/route.ts` *body shape* heavily (schema, audit, response) AND `src/lib/deals.ts` (`CreateDealArgs`). DR-2 later only *appends* a `captureEvent` block to `route.ts` after the audit call — putting GR-1 first means DR-2 splices into a route whose audit block has already settled into its final `...(counterpartyEmail ? {email} : {})` form. WHY first: smallest dependency footprint, and it stabilizes the two files (`deals.ts`, `deals/route.ts`) that DR-2 reads next.

- **Wave A2 — AI-7** (apply-fix telemetry). Run before DR-2. WHY: AI-7 and DR-2 both append members to the closed `EventName` union in `src/lib/analytics/server.ts` (AI-7 adds `"analyze.applyfix_unavailable"` under "Document analysis"; DR-2 adds six funnel literals after `"admin_action_performed"`). They append to **different regions** of the union (no logical conflict) but a concurrent edit risks a textual merge conflict on the union block. Sequencing them eliminates it. AI-7 first is arbitrary-but-fixed; its other files (`quote-verify.ts`, `quote-verify.test.ts`, `analyze.ts`) are disjoint from every other task, so it adds no further constraint.

- **Wave A3 — DR-2** (PostHog viral funnel). Run after AI-7 (union) and after GR-1 (`deals/route.ts`). WHY after both: it extends the same union AI-7 just touched, and it inserts a `captureEvent` block into `deals/route.ts` right after the audit block GR-1 finalized. DR-2 also touches the two action routes and the by-token GET — all of which DR-3 and DR-8 edit later, so DR-2 must precede them (see A4/A6).

- **Wave A4 — DR-3** (counter-propose → accept / RESOLVED). Run after DR-2, before DR-8. WHY after DR-2: DR-3 rewrites the `findMany`/`reconcile`/`update` and the `stillOpen` terminal-set in **both** action routes — DR-2 only inserted a trailing `captureEvent` block in those routes, so DR-3 splices into a known post-DR-2 shape. WHY before DR-8: DR-3 changes `reconcileClauseStatus`'s **signature requirement** (`ClauseActionInput` now requires `id`, adds `proposalId`/`body`); DR-8's `mergeDealClauses` and `deal-room.tsx` reconcile map both consume `ClauseActionInput` and must be written against the post-DR-3 shape, not the old 3-field one. DR-3 owns `deal-status.ts`, `schema.prisma`, `clause-card.tsx`, both action routes, plus `deals.test.ts` — all also touched downstream, so it anchors the middle of the pipeline.

- **Wave A5 — DR-1** (receiver→sender CTA). Run after DR-3, before DR-8. The only file DR-1 shares with the cluster is `deal-room.tsx` (it adds the `ReceiverCta` mount + `hasVoted`/`showReceiverCta` derivation). DR-1's `deal-cta.ts` + test + `receiver-cta.tsx` are otherwise disjoint. WHY before DR-8: DR-8's own section declares `dependsOn: DR-1` and states its `deal-room.tsx` anchors (top-of-component `useCallback`/`useEffect`, title-page `<header>`, error-path button) are chosen to NOT collide with DR-1's RECEIVER-only CTA insertions — so DR-1 must land first and DR-8 splices into the post-DR-1 file. Could DR-1 run before DR-3? Yes file-wise (DR-1 doesn't touch `deal-status.ts`/action routes), but DR-1's `deal-room.tsx` edits read `deal.status`/`myRole` types that DR-3 leaves unchanged — so ordering DR-1 after DR-3 is safe and keeps a single linear `deal-room.tsx` edit history (DR-3 does touch `deal-room.tsx` for the `onAction` proposalId threading). **DR-3 → DR-1 → DR-8 is the mandatory `deal-room.tsx` order.**

- **Wave A6 — DR-8** (presence + auto-refresh). Run last in Track A. WHY last: it depends on DR-1 (explicit `dependsOn`), consumes the post-DR-3 `ClauseActionInput` shape in `mergeDealClauses`, and edits the by-token GET route (`route.ts` participants map) that DR-2 already instrumented — so all three predecessors must be committed first. DR-8's two pure modules (`deal-presence.ts`, `deal-merge.ts`) are conflict-free; only its `deal-room.tsx` and by-token-route edits carry sequencing weight.

**Track A linear order: GR-1 → AI-7 → DR-2 → DR-3 → DR-1 → DR-8.**
**Track B (parallel): MON-3-cancel, standalone.**

### What is genuinely parallel-safe

- Track B (MON-3) ∥ all of Track A — fully disjoint file sets.
- Within Track A, nothing is parallel-safe: every task collides with at least one neighbor on `analytics/server.ts`, `deals/route.ts`, an action route, `clause-card.tsx`, `deal-status.ts`, or `deal-room.tsx`. The pipeline is strictly sequential by construction.

---

## Self-review — cross-task collisions reconciled

Every shared type, helper name, EventName member, and shared-file anchor I had to order or de-conflict, exhaustively:

**1. `EventName` union (`src/lib/analytics/server.ts`) — shared by AI-7 + DR-2 (and dodged by MON-3).**
- AI-7 inserts `"analyze.applyfix_unavailable"` inside the **"Document analysis"** group (after `"ocr_used"`).
- DR-2 inserts six literals — `"deal_created"`, `"deal_link_opened"`, `"receiver_identified"`, `"clause_agreed"`, `"clause_disputed"`, `"deal_agreed_complete"` — as a **new "Deal Room funnel (DR-2)" group after `"admin_action_performed"`** (the current closing member).
- Different insertion regions ⇒ no logical conflict, but same-file ⇒ serialize. **Order fixed: AI-7 → DR-2.** Either order is logically fine; I pin AI-7 first so DR-2's diff lands against a union that already has its Document-analysis addition.
- MON-3 references event `"subscription_cancel_scheduled"`, which is **NOT** in the union. Its Step 7 says to drop that `captureEvent` if the union rejects it. **Reconciliation: MON-3 must NOT add to the union** — that keeps `server.ts` a Track-A-only file and the two tracks disjoint. The audit row (`billing.subscription_canceled`, already in `AuditAction` + `ACTION_LABELS`) is the durable record; the analytics event is optional.

**2. `ClauseActionInput` type (`src/lib/deal-status.ts`, re-exported from `deals.ts`) — owned by DR-3, consumed by DR-8 + DR-1-adjacent code.**
- Pre-DR-3 shape: `{ participantId, kind, createdAt }` with `kind ∈ AGREE|DISAGREE|COMMENT|PROPOSE_EDIT`.
- DR-3 widens it to require `id: string`, add optional `body?: string|null`, add optional `proposalId?: string|null`, and extend `kind` with `"ACCEPT_PROPOSAL"`. It also patches the legacy `acts(...)` helper and inline literals in `deals.test.ts` to carry `id`.
- DR-8's `mergeDealClauses` builds `ClauseActionInput[]` via `reconcileClauseStatus`, and `deal-room.tsx`'s reconcile map builds the same. Both must include `id` and (DR-3-added) `proposalId`. **Reconciliation: DR-3 before DR-8** so DR-8 is authored against the 5-field shape. If DR-8 ran first it would compile against a 3-field type that DR-3 then breaks.

**3. `reconcileClauseStatus` signature + new exports `latestOpenProposal` / `latestAcceptedProposalText` (`deal-status.ts`).**
- DR-3 adds `latestOpenProposal` (clause-card redline selector) and lifts `latestAcceptedProposalText` into the pure module (Step 9a, preferred) so both action routes import one copy instead of duplicating a Prisma-free helper. Re-export block in `deals.ts` must list: `reconcileClauseStatus, latestOpenProposal, latestAcceptedProposalText, type ClauseActionInput, type ClauseStatus`.
- DR-8 imports `reconcileClauseStatus` + `ClauseStatus` from `./deal-status` (in `deal-merge.ts`). **Reconciliation:** DR-8's `MergeClause.status: ClauseStatus` and `MergeAction.kind: string` are structurally compatible with the DR-3-widened types (DR-8 keeps `kind: string`, looser, so the `ACCEPT_PROPOSAL` addition can't break it). No signature clash — but DR-3 must land first so `ClauseStatus` already includes `"RESOLVED"` (DR-8 tests/merge rely on the four-member status type).

**4. `src/app/deal/[token]/deal-room.tsx` — written by DR-3, DR-1, DR-8 (three tasks, one file). Mandatory order DR-3 → DR-1 → DR-8.**
- DR-3 edits: `onAction` signature (adds `ACCEPT_PROPOSAL` kind + `proposalId` arg), optimistic action object (adds `proposalId`), reconcile map (adds `id`+`proposalId`), POST body (`{ kind, body, proposalId }`).
- DR-1 edits: imports `ReceiverCta`/`shouldShowReceiverCta`; derives `hasVoted`/`showReceiverCta` after the `chipTone` const; mounts CTA inline (after clauses block) + colophon (before `<footer>`).
- DR-8 edits: imports `formatLastSeen`/`isOnline`/`mergeDealClauses`; extends `DealView.participants[]` with `lastSeenAt`; derives presence after `chipTone`; renders presence line in `<header>`; adds `pollDeal` `useCallback` + visibility-gated `useEffect`; swaps the error-path `window.location.reload()` for `setErrorState(null); void fetchDeal()`.
- **Anchor de-confliction:** DR-1 inserts its `hasVoted`/`showReceiverCta` derivation **after `chipTone`**; DR-8 inserts its presence derivation **also after `chipTone`**. These are additive sibling blocks in the same region — DR-1 first means DR-8 appends after DR-1's block, both before `return (`. DR-1's mounts are in the clauses/footer region; DR-8's edits are in the header `<p>`/error-button/top-of-component regions — physically separated. DR-3's `onAction`/optimistic edits are at the top callback region, untouched by DR-1, and DR-8's `pollDeal` is inserted *after* the existing `fetchDeal` `useCallback` which DR-3 modified — so DR-8 reads the post-DR-3 `onAction`. All three orderings are consistent with **DR-3 → DR-1 → DR-8**.

**5. `src/app/api/deals/route.ts` — GR-1 + DR-2.**
- GR-1 rewrites: `CreateSchema` (email optional), invite-email `if (counterpartyEmail)` guard, audit payload `...(counterpartyEmail ? {email} : {})`, response `+emailSent`.
- DR-2 appends: import of `captureEvent`/`DEAL_FUNNEL_EVENTS`, and a `void captureEvent(... dealCreated ...)` block **immediately after the `logAudit({action:"deal.created"})` block**.
- **Reconciliation: GR-1 before DR-2.** DR-2's insertion anchor ("after the logAudit block, before the return") is exactly the region GR-1 reshapes (it edits both the audit payload AND the return). Running GR-1 first means the audit block + return are in final form when DR-2 splices its `captureEvent` between them. No collision on the actual lines — GR-1 owns audit+return, DR-2 inserts a new block between them.

**6. Two action routes (`.../deals/[id]/.../actions/route.ts` + `.../by-token/[token]/.../actions/route.ts`) — DR-2 + DR-3.**
- DR-2 appends a trailing `captureEvent`/`clauseEventFor` block after the `logAudit`/`updateMany` and before the final `return`, reading `newStatus`/`desiredStatus`/`me`/`sessionId`/`clause.deal.ownerId` (all pre-existing in-scope vars).
- DR-3 rewrites the action schema (`+ACCEPT_PROPOSAL`, `+proposalId`), adds the ACCEPT_PROPOSAL guard, the `clauseAction.create` (`+proposalId`), the `findMany` select (`+id,body,proposalId`) → `reconciled` map → `reconcileClauseStatus` → `dealClause.update` (`+agreedText`), and the `stillOpen` count terminal-set (`notIn: ["AGREED","RESOLVED"]`).
- **Reconciliation: DR-2 before DR-3.** DR-2's `captureEvent` block keys off `newStatus`/`desiredStatus`, which DR-3 preserves (it still computes `newStatus` via `reconcileClauseStatus` and `desiredStatus` for promote/demote). DR-3 reshapes the reconcile region *above* DR-2's appended analytics block, leaving DR-2's `clauseEventFor(newStatus)` call valid (RESOLVED maps to `null` in `clauseEventFor`, so a resolved clause simply emits no per-clause funnel event — correct). Ordering DR-2 first means DR-3 splices the richer `findMany`/`update` into a route that already carries the analytics tail; the tail still type-checks because `newStatus`/`desiredStatus` remain in scope.

**7. By-token GET route (`.../deals/by-token/[token]/route.ts`) — DR-2 + DR-8.**
- DR-2 inserts a `deal_link_opened` `captureEvent` before the final `return`, using `isOwner`/`myRole`/`myParticipantId`/`deal.ownerId`/`deal.orgId`.
- DR-8 edits the participants response map to add `lastSeenAt: p.lastSeenAt?.toISOString() ?? null`.
- **Reconciliation: DR-2 before DR-8** (consistent with overall A3 < A6). Different regions (DR-2 = pre-return analytics; DR-8 = participants map inside the response object), no line overlap. Foot-gun #50 preserved by both: neither adds `rawText`/`owner.email`/`recommendedText`; DR-8 adds only the counterparty's own `lastSeenAt` timestamp.

**8. `clause-card.tsx` — DR-3 only (within these eight).** DR-3 widens `onAction`, extends `ClauseView.actions[]` with `proposalId: string|null`, derives `openProposal`/`canAcceptProposal` via `latestOpenProposal`, renders the redline + "Принять формулировку" button. No other task in this set touches it — no collision, listed for completeness because `ClauseView` is imported by `deal-room.tsx` (DR-1/DR-8 consumers): DR-3's `+proposalId` on `ClauseView.actions[]` flows into `deal-room.tsx` automatically, and DR-8's `mergeDealClauses<C extends MergeClause>` generic accepts the richer `ClauseView` unchanged. **Reconciliation:** DR-3 before DR-1/DR-8 guarantees `ClauseView.actions[].proposalId` exists when DR-8's merge passes `ClauseView` through.

**9. `deals.test.ts` — DR-3 only (extends import block + `acts` helper + appends RESOLVED/`latestOpenProposal`/`latestAcceptedProposalText` describes).** GR-1 creates a *separate* `deals-share.test.ts`; DR-1 a *separate* `deal-cta.test.ts`; DR-8 *separate* presence/merge tests. No shared test file beyond `deals.test.ts` (DR-3 sole owner). No collision.

**10. `prisma/schema.prisma` — DR-3 only (within these eight):** adds nullable `DealClause.agreedText` + `ClauseAction.proposalId`, both additive ⇒ `db push` safe. No other task in this set migrates the schema, so no migration ordering conflict. (DR-7/DR-4/DR-5 from the roadmap would collide here, but they are out of this Phase-1+2 subset.)

**11. Shared helper *names* introduced — checked for cross-task collision:** `buildShareLinks` (GR-1, `deals-share.ts`), `isOverFreeChatCap`/`FREE_CHAT_CAP` (DR-6 — **note: DR-6 is in the task list but the section text appears under GR-1's array entry; treat DR-6's `free-cap.ts` as a disjoint create**), `DEAL_FUNNEL_EVENTS`/`clauseEventFor`/`dealFunnelDistinctId` (DR-2, `deal-funnel.ts`), `shouldShowReceiverCta`/`ReceiverCtaState` (DR-1, `deal-cta.ts`), `formatLastSeen`/`isOnline`/`mergeDealClauses` (DR-8), `canCancelSubscription`/`resolveExpiryDowngrade` (MON-3, `cancel.ts`), `latestOpenProposal`/`latestAcceptedProposalText` (DR-3). **All names are unique across the eight tasks — no namespace collision.**

**12. DR-6 placement note.** DR-6 (receiver suggest-moves FREE-cap) creates `src/lib/ai/free-cap.ts` + test and edits the two `suggest-moves` routes — **none** of which any other task in this set touches (the suggest-moves routes are distinct from the action routes DR-2/DR-3 edit). **Reconciliation: DR-6 is file-disjoint from the entire pipeline** and could run as a third parallel track, OR slot anywhere in Track A. I place it at the head of Track A (before GR-1) as a clean warm-up since it has zero shared files — but it is equally valid as a Track B sibling. It must NOT be confused with DR-3's action-route edits: `free-cap.ts` + `suggest-moves/route.ts` ≠ `deal-status.ts` + `actions/route.ts`.

---

## Task sections (per-file)

- [GR-1 — Optional counterparty email + share-sheet (copy-link/Telegram/WhatsApp)](phase12/GR-1.md)
- [DR-6 — Receiver suggest-moves: owner FREE-cap + correct tier (close unmetered-spend hole)](phase12/DR-6.md)
- [DR-2 — PostHog instrumentation of the viral funnel](phase12/DR-2.md)
- [AI-7 — Apply-fix telemetry — fire analyze.applyfix_unavailable on the paraphrase null branch (no fuzzy fallback)](phase12/AI-7.md)
- [DR-1 — Receiver→sender conversion CTA at peak intent](phase12/DR-1.md)
- [DR-8 — Lightweight presence + auto-refresh (polling-first, no new infra)](phase12/DR-8.md)
- [DR-3 — Counter-propose → accept loop (make AI Compromise actually RESOLVE)](phase12/DR-3.md)
- [MON-3 — Self-serve subscription cancel (cancel-half only; auto-renew deferred to YooKassa)](phase12/MON-3.md)
