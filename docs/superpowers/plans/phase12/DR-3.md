### Task DR-3: Counter-propose → accept loop (make AI Compromise actually RESOLVE)

Make the `NegotiationMoves` "Компромисс" move (move B) actually settle a dispute. Today move B posts a `PROPOSE_EDIT` that `reconcileClauseStatus` filters out, and `RESOLVED` (type/label/accent already wired) is **never emitted** — a DISPUTED clause can only reach AGREED on the *original* text. This task closes the generative half that already shipped (`MovesSchema.proposedText`).

The work: add a new String `ClauseAction.kind = "ACCEPT_PROPOSAL"` carrying a `proposalId` (additive nullable column, **no enum migration**), render the latest open `PROPOSE_EDIT` in the clause card as a redline with an "Принять формулировку" button for the **counterparty**, extend `reconcileClauseStatus` so `PROPOSE_EDIT` + a matching counterparty `ACCEPT_PROPOSAL` → `RESOLVED` and snapshot the accepted text into a new nullable `DealClause.agreedText`, and update the deal-status promote/demote query in **both** action routes so `RESOLVED` counts as terminal-agreed alongside `AGREED`.

**Files**
- create: (none)
- modify: `src/lib/deal-status.ts`, `src/lib/__tests__/deals.test.ts`, `prisma/schema.prisma`, `src/app/deal/[token]/clause-card.tsx`, `src/app/deal/[token]/deal-room.tsx`, `src/app/api/deals/[id]/clauses/[clauseId]/actions/route.ts`, `src/app/api/deals/by-token/[token]/clauses/[clauseId]/actions/route.ts`
- test: `src/lib/__tests__/deals.test.ts`

**Test constraint.** `vitest.config.ts` excludes `src/app` entirely, so the two action routes, `clause-card.tsx`, and `deal-room.tsx` get **no unit test**. All testable logic — the extended `reconcileClauseStatus` *and* the new pure "latest open proposal" selector — lives in `src/lib/deal-status.ts` and is TDD'd in `src/lib/__tests__/deals.test.ts` (which imports through the `../deals` re-export). The routes/components are thin glue: they call the pure functions and render. Steps that touch `src/app/**` are flagged "(untestable — verified by `tsc` + manual smoke)".

**Foot-guns respected.** #11 (deal-status promote/demote is org/User-agnostic here — no plan write). #26 (no audit field changes that pass `undefined`). Schema additive **nullable only** → `prisma db push` safe, zero backfill. Both action routes share the promote/demote block — RESOLVED must land in **both** or `deal.status` desyncs (roadmap line 103/254). Optimistic id prefix `optimistic-` already distinguishes synthetic actions (#DR-8 reconciliation note) — the new `ACCEPT_PROPOSAL` optimistic action follows the same shape.

---

#### Step 1 — Failing test: extend `ClauseActionInput` + new RESOLVED transition (red)

- [ ] Append the new `RESOLVED`/proposal tests to `src/lib/__tests__/deals.test.ts`. These reference an extended `kind` union (`"ACCEPT_PROPOSAL"`) and `proposalId` on `ClauseActionInput`, plus the new pure selector `latestOpenProposal`, none of which exist yet → compile + run fail.

Add this `import` change at the top of `src/lib/__tests__/deals.test.ts` — replace the existing import block (lines 2-6):

```ts
import {
  generateInviteToken,
  reconcileClauseStatus,
  latestOpenProposal,
  type ClauseActionInput,
} from "../deals";
```

Then append a new `describe` block at the END of the file (after the closing `});` of the existing `reconcileClauseStatus` describe):

```ts
describe("reconcileClauseStatus — counter-propose → accept (RESOLVED)", () => {
  // Full action shape including proposal linkage. `id` is needed so an
  // ACCEPT_PROPOSAL can point back at the PROPOSE_EDIT it accepts.
  const at = (ms: number) => new Date(ms);

  it("RESOLVED when one side PROPOSE_EDITs and the OTHER side ACCEPT_PROPOSALs it", () => {
    const actions: ClauseActionInput[] = [
      { id: "a1", participantId: "sender", kind: "DISAGREE", createdAt: at(0) },
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Новый текст", createdAt: at(1000) },
      { id: "x1", participantId: "receiver", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
    ];
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("RESOLVED");
  });

  it("does NOT resolve when a party accepts its OWN proposal (self-accept ignored)", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Новый текст", createdAt: at(1000) },
      { id: "x1", participantId: "sender", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
    ];
    // Self-accept is not a meeting of the minds → falls through to vote logic → PENDING.
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("PENDING");
  });

  it("does NOT resolve when the ACCEPT_PROPOSAL references an unknown proposalId", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Новый текст", createdAt: at(1000) },
      { id: "x1", participantId: "receiver", kind: "ACCEPT_PROPOSAL", proposalId: "ghost", createdAt: at(2000) },
    ];
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("PENDING");
  });

  it("a later DISAGREE after acceptance demotes RESOLVED back to DISPUTED", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Новый текст", createdAt: at(1000) },
      { id: "x1", participantId: "receiver", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
      { id: "d1", participantId: "receiver", kind: "DISAGREE", createdAt: at(3000) },
    ];
    // A fresh DISAGREE outranks a stale acceptance → dispute reopens.
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("DISPUTED");
  });

  it("accepts the LATEST proposal — an older accepted proposal does not resolve a newer one", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Текст 1", createdAt: at(1000) },
      { id: "x1", participantId: "receiver", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
      { id: "p2", participantId: "sender", kind: "PROPOSE_EDIT", body: "Текст 2", createdAt: at(3000) },
    ];
    // p2 is the latest open proposal and is NOT yet accepted → not resolved.
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("PENDING");
  });
});

describe("latestOpenProposal", () => {
  const at = (ms: number) => new Date(ms);

  it("returns null when there are no PROPOSE_EDIT actions", () => {
    const actions: ClauseActionInput[] = [
      { id: "a1", participantId: "sender", kind: "AGREE", createdAt: at(0) },
    ];
    expect(latestOpenProposal(actions)).toBeNull();
  });

  it("returns the most recent PROPOSE_EDIT not yet accepted", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Старый", createdAt: at(1000) },
      { id: "p2", participantId: "sender", kind: "PROPOSE_EDIT", body: "Новый", createdAt: at(2000) },
    ];
    expect(latestOpenProposal(actions)?.id).toBe("p2");
  });

  it("returns null when the latest proposal has already been accepted by the counterparty", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Текст", createdAt: at(1000) },
      { id: "x1", participantId: "receiver", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
    ];
    expect(latestOpenProposal(actions)).toBeNull();
  });
});
```

#### Step 2 — Run to fail

- [ ] Run the suite and confirm it fails to compile / run (no `latestOpenProposal`, `kind` union lacks `ACCEPT_PROPOSAL`, `ClauseActionInput` lacks `id`/`proposalId`/`body`):

```
npx vitest run src/lib/__tests__/deals.test.ts
```

Expect: import/type errors on `latestOpenProposal`, `ACCEPT_PROPOSAL`, and the `id`/`proposalId`/`body` fields, plus assertion failures.

#### Step 3 — Minimal impl: extend `reconcileClauseStatus` + add `latestOpenProposal` (green)

- [ ] Replace the entire contents of `src/lib/deal-status.ts` with the version below. Changes vs. current: `ClauseActionInput` gains `id`, optional `body`, optional `proposalId`, and the `kind` union gains `"ACCEPT_PROPOSAL"`; `reconcileClauseStatus` now emits `RESOLVED` when the latest open proposal has a counterparty acceptance that is not outranked by a fresher vote; new exported pure `latestOpenProposal` selector.

```ts
// Pure clause-status reconciliation logic, extracted from src/lib/deals.ts
// so the client bundle can import it without dragging in Prisma. Used by
// the Deal Room optimistic UI to predict the new status of a clause
// immediately after a local action, before the server round-trip
// canonicalises everything.
//
// Status rules, in priority order:
//   1. The most recent AGREE/DISAGREE/ACCEPT_PROPOSAL per participant is
//      that participant's standing "vote".
//   2. A PROPOSE_EDIT accepted by the COUNTERPARTY (ACCEPT_PROPOSAL whose
//      proposalId points at it) settles the clause on the new text →
//      RESOLVED, unless a fresher DISAGREE outranks the acceptance.
//   3. Otherwise: any DISAGREE → DISPUTED; both AGREE → AGREED; else PENDING.
// COMMENT and bare PROPOSE_EDIT (without a counterparty acceptance) never
// move the status on their own.

export interface ClauseActionInput {
  id: string;
  participantId: string;
  kind: "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT" | "ACCEPT_PROPOSAL";
  // PROPOSE_EDIT carries the proposed replacement text in `body`.
  body?: string | null;
  // ACCEPT_PROPOSAL references the PROPOSE_EDIT action it accepts.
  proposalId?: string | null;
  createdAt: Date;
}

export type ClauseStatus = "PENDING" | "AGREED" | "DISPUTED" | "RESOLVED";

// The most recent unaccepted PROPOSE_EDIT in the action log, or null. A
// proposal is "open" until any later ACCEPT_PROPOSAL references its id.
// Used by the clause card to render the redline + accept button, and by
// reconcileClauseStatus to detect settlement.
export function latestOpenProposal(
  actions: ClauseActionInput[]
): ClauseActionInput | null {
  const accepted = new Set(
    actions
      .filter((a) => a.kind === "ACCEPT_PROPOSAL" && a.proposalId)
      .map((a) => a.proposalId as string)
  );
  const open = actions
    .filter((a) => a.kind === "PROPOSE_EDIT" && !accepted.has(a.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return open[0] ?? null;
}

export function reconcileClauseStatus(
  actions: ClauseActionInput[],
  senderId: string,
  receiverId: string
): ClauseStatus {
  // Latest standing vote per participant. AGREE / DISAGREE only — an
  // ACCEPT_PROPOSAL is handled separately as settlement, not as a vote.
  const latestVote = (participantId: string): "AGREE" | "DISAGREE" | null => {
    const votes = actions
      .filter((a) => a.participantId === participantId)
      .filter((a) => a.kind === "AGREE" || a.kind === "DISAGREE")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return (votes[0]?.kind as "AGREE" | "DISAGREE" | undefined) ?? null;
  };

  // Settlement: find the most recent ACCEPT_PROPOSAL whose target proposal
  // exists and was authored by the OTHER party (no self-accept). If the
  // accepting party then casts a DISAGREE that is newer than the
  // acceptance, the settlement is stale and the dispute reopens.
  const byId = new Map(actions.map((a) => [a.id, a]));
  const settlement = actions
    .filter((a) => a.kind === "ACCEPT_PROPOSAL" && a.proposalId)
    .map((a) => ({ accept: a, proposal: byId.get(a.proposalId as string) }))
    .filter(
      (x) =>
        x.proposal !== undefined &&
        x.proposal.kind === "PROPOSE_EDIT" &&
        x.proposal.participantId !== x.accept.participantId
    )
    .sort((a, b) => b.accept.createdAt.getTime() - a.accept.createdAt.getTime())[0];

  if (settlement) {
    const acceptedAt = settlement.accept.createdAt.getTime();
    const fresherDisagree = actions.some(
      (a) => a.kind === "DISAGREE" && a.createdAt.getTime() > acceptedAt
    );
    if (!fresherDisagree) return "RESOLVED";
  }

  const senderVote = latestVote(senderId);
  const receiverVote = latestVote(receiverId);

  if (senderVote === "DISAGREE" || receiverVote === "DISAGREE") return "DISPUTED";
  if (senderVote === "AGREE" && receiverVote === "AGREE") return "AGREED";
  return "PENDING";
}
```

- [ ] Re-export the new selector from `src/lib/deals.ts` so the test import (`from "../deals"`) and the client component resolve it. Replace the existing re-export block (lines 11-15) with:

```ts
export {
  reconcileClauseStatus,
  latestOpenProposal,
  type ClauseActionInput,
  type ClauseStatus,
} from "./deal-status";
```

#### Step 4 — Run to pass + fix the existing optimistic call sites

- [ ] Run the suite:

```
npx vitest run src/lib/__tests__/deals.test.ts
```

Expect: all `reconcileClauseStatus` + `latestOpenProposal` tests green. Note: the **existing** helper `acts(...)` in the file builds actions WITHOUT an `id` field — `ClauseActionInput` now requires `id`. Patch the existing `acts` helper (around line 26) to add a synthetic id so the legacy tests still typecheck:

```ts
  const acts = (pairs: Array<[string, "AGREE" | "DISAGREE"]>): ClauseActionInput[] =>
    pairs.map(([p, k], i) => ({ id: `a${i}`, participantId: p, kind: k, createdAt: new Date() }));
```

Also patch the two inline `ClauseActionInput[]` literals further down (the COMMENT/PROPOSE_EDIT and "AGREE wins over later COMMENT" and "uses the LATEST action" tests) to include an `id` on each object (e.g. `id: "s1"`, `id: "r1"`, …) — `tsc` will pinpoint each. Re-run until green.

#### Step 5 — Commit the pure core

- [ ] Gate and commit:

```
npx tsc --noEmit && npm test
```

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Emit RESOLVED when a counter-proposal is accepted by the other party

reconcileClauseStatus now settles a clause on new text: a PROPOSE_EDIT
accepted by the counterparty (ACCEPT_PROPOSAL referencing it) yields
RESOLVED, unless a fresher DISAGREE outranks the acceptance. Adds a pure
latestOpenProposal selector for the clause-card redline. This is the
missing half of the Sprint 15A negotiation moves — move B's proposedText
was posted but its status edge was a no-op.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

#### Step 6 — Schema: additive nullable `agreedText` + document `ACCEPT_PROPOSAL`/`proposalId` (db-push safe)

- [ ] In `prisma/schema.prisma`, in `model DealClause` add `agreedText` after the `suggestedMoves` field (currently line 1028). Insert before the blank line preceding `deal    Deal`:

```prisma
  // Snapshot of the accepted counter-proposal text once a DISPUTED clause
  // is RESOLVED via the propose→accept loop (DR-3). Null until settlement.
  agreedText  String?
```

- [ ] In `model ClauseAction`, update the `kind` comment and add a nullable `proposalId` after `body`. Replace the `kind` comment (line 1040) and the `body` block (lines 1042-1044) with:

```prisma
  // "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT" | "ACCEPT_PROPOSAL"
  kind          String
  // Free-text body. Empty for AGREE/DISAGREE/ACCEPT_PROPOSAL, required for
  // COMMENT and PROPOSE_EDIT (the latter carries the proposed new text).
  body          String?
  // Set only on ACCEPT_PROPOSAL — references the ClauseAction.id of the
  // PROPOSE_EDIT being accepted. Plain nullable String, not an FK, so
  // `prisma db push` stays additive and safe (foot-gun #2/#38 pattern).
  proposalId    String?
```

- [ ] Apply with the project's safe push (no `--accept-data-loss`; both columns nullable so it is a clean additive change):

```
npx prisma db push
```

- [ ] Regenerate the client and confirm types compile:

```
npx prisma generate && npx tsc --noEmit
```

(No unit test — schema is data definition; correctness verified by `tsc` against the route changes in Steps 8-9 and manual smoke.)

#### Step 7 — Commit the schema

- [ ] Commit:

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Add DealClause.agreedText + ClauseAction.proposalId for the accept loop

Additive nullable columns only — db-push safe, zero backfill. agreedText
snapshots the accepted counter-proposal; proposalId links an
ACCEPT_PROPOSAL action back to the PROPOSE_EDIT it settles. ACCEPT_PROPOSAL
is a plain String kind, no enum migration.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

#### Step 8 — Sender action route: accept ACCEPT_PROPOSAL, snapshot agreedText, RESOLVED is terminal (untestable — `src/app`, verified by `tsc` + smoke)

- [ ] In `src/app/api/deals/[id]/clauses/[clauseId]/actions/route.ts`, extend the action schema (lines 11-14) to accept the new kind + optional `proposalId`:

```ts
const ActionSchema = z.object({
  kind: z.enum(["AGREE", "DISAGREE", "COMMENT", "PROPOSE_EDIT", "ACCEPT_PROPOSAL"]),
  body: z.string().trim().max(2000).optional(),
  proposalId: z.string().trim().max(64).optional(),
});
```

- [ ] After the `safeParse` guard, require `proposalId` on ACCEPT_PROPOSAL. Replace the existing body-required guard (lines 50-52) with:

```ts
    if ((parsed.data.kind === "COMMENT" || parsed.data.kind === "PROPOSE_EDIT") && !parsed.data.body) {
      return NextResponse.json({ error: "Комментарий не может быть пустым" }, { status: 400 });
    }
    if (parsed.data.kind === "ACCEPT_PROPOSAL" && !parsed.data.proposalId) {
      return NextResponse.json({ error: "Не указано принимаемое предложение" }, { status: 400 });
    }
```

- [ ] Persist `proposalId` on the inserted action. Replace the `prisma.clauseAction.create` block (lines 77-84) with:

```ts
    await prisma.clauseAction.create({
      data: {
        clauseId,
        participantId: sender.id,
        kind: parsed.data.kind,
        body: parsed.data.body ?? null,
        proposalId: parsed.data.proposalId ?? null,
      },
    });
```

- [ ] Pull the full action shape needed by the pure reconciler (id/body/proposalId), recompute status, and snapshot `agreedText` when the clause settles. Replace the `findMany` + `reconcileClauseStatus` + `dealClause.update` block (lines 86-102) with:

```ts
    const allActions = await prisma.clauseAction.findMany({
      where: { clauseId },
      select: { id: true, participantId: true, kind: true, body: true, proposalId: true, createdAt: true },
    });
    const reconciled = allActions.map((a) => ({
      id: a.id,
      participantId: a.participantId,
      kind: a.kind as ClauseActionInput["kind"],
      body: a.body,
      proposalId: a.proposalId,
      createdAt: a.createdAt,
    }));
    const newStatus = reconcileClauseStatus(reconciled, sender.id, receiver.id);
    // When the clause settles on a counter-proposal, snapshot its text so
    // the final document (DR-5) can export the agreed wording. Otherwise
    // leave any prior agreedText untouched.
    const settledText =
      newStatus === "RESOLVED" ? (latestAcceptedProposalText(reconciled) ?? undefined) : undefined;
    await prisma.dealClause.update({
      where: { id: clauseId },
      data: { status: newStatus, ...(settledText !== undefined ? { agreedText: settledText } : {}) },
    });
```

- [ ] Make `RESOLVED` count as terminal-agreed in the promote/demote query. Replace the `stillOpen` count (lines 108-110) with:

```ts
    const stillOpen = await prisma.dealClause.count({
      where: { dealId, status: { notIn: ["AGREED", "RESOLVED"] } },
    });
```

- [ ] Add the imports + a tiny local helper. Update the import on line 7 and add the helper near the top of the file (after the imports, before `ActionSchema`):

```ts
import { reconcileClauseStatus, latestOpenProposal, type ClauseActionInput } from "@/lib/deals";
```

```ts
// Text of the proposal accepted by the most recent ACCEPT_PROPOSAL. Used
// to snapshot agreedText when a clause resolves. Mirrors the settlement
// rule in reconcileClauseStatus (counterparty acceptance of an open edit).
function latestAcceptedProposalText(actions: ClauseActionInput[]): string | null {
  const byId = new Map(actions.map((a) => [a.id, a]));
  const accept = actions
    .filter((a) => a.kind === "ACCEPT_PROPOSAL" && a.proposalId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!accept) return null;
  const proposal = byId.get(accept.proposalId as string);
  return proposal?.kind === "PROPOSE_EDIT" ? (proposal.body ?? null) : null;
}
```

Note: `latestOpenProposal` is imported here for symmetry/future use by GET payload shaping, but if unused at this point remove it to satisfy `tsc` no-unused — keep only `reconcileClauseStatus` + `ClauseActionInput` if the helper above is self-contained. (The clause-card consumes `latestOpenProposal` via the client bundle, not this route.) Run `npx tsc --noEmit` and drop any unused import it flags.

#### Step 9 — Receiver (by-token) action route: mirror the sender changes exactly (untestable — `src/app`, verified by `tsc` + smoke)

- [ ] In `src/app/api/deals/by-token/[token]/clauses/[clauseId]/actions/route.ts`, apply the **same** four edits, mirrored for the receiver participant. Update the schema (lines 11-14):

```ts
const ActionSchema = z.object({
  kind: z.enum(["AGREE", "DISAGREE", "COMMENT", "PROPOSE_EDIT", "ACCEPT_PROPOSAL"]),
  body: z.string().trim().max(2000).optional(),
  proposalId: z.string().trim().max(64).optional(),
});
```

- [ ] Add the ACCEPT_PROPOSAL guard after the body guard (lines 33-35):

```ts
    if ((parsed.data.kind === "COMMENT" || parsed.data.kind === "PROPOSE_EDIT") && !parsed.data.body) {
      return NextResponse.json({ error: "Комментарий не может быть пустым" }, { status: 400 });
    }
    if (parsed.data.kind === "ACCEPT_PROPOSAL" && !parsed.data.proposalId) {
      return NextResponse.json({ error: "Не указано принимаемое предложение" }, { status: 400 });
    }
```

- [ ] Persist `proposalId` (lines 60-67):

```ts
    await prisma.clauseAction.create({
      data: {
        clauseId,
        participantId: receiver.id,
        kind: parsed.data.kind,
        body: parsed.data.body ?? null,
        proposalId: parsed.data.proposalId ?? null,
      },
    });
```

- [ ] Replace the `findMany` + reconcile + clause update block (lines 69-85) with the richer select + agreedText snapshot:

```ts
    const allActions = await prisma.clauseAction.findMany({
      where: { clauseId },
      select: { id: true, participantId: true, kind: true, body: true, proposalId: true, createdAt: true },
    });
    const reconciled = allActions.map((a) => ({
      id: a.id,
      participantId: a.participantId,
      kind: a.kind as ClauseActionInput["kind"],
      body: a.body,
      proposalId: a.proposalId,
      createdAt: a.createdAt,
    }));
    const newStatus = reconcileClauseStatus(reconciled, sender.id, receiver.id);
    const settledText =
      newStatus === "RESOLVED" ? (latestAcceptedProposalText(reconciled) ?? undefined) : undefined;
    await prisma.dealClause.update({
      where: { id: clauseId },
      data: { status: newStatus, ...(settledText !== undefined ? { agreedText: settledText } : {}) },
    });
```

- [ ] Make RESOLVED terminal in the promote/demote count (lines 90-92):

```ts
    const stillOpen = await prisma.dealClause.count({
      where: { dealId: clause.dealId, status: { notIn: ["AGREED", "RESOLVED"] } },
    });
```

- [ ] Update the import (line 6) and add the **same** `latestAcceptedProposalText` helper near the top (after imports). Both routes need an identical copy — they cannot share a Prisma-importing helper without poisoning the client bundle, but `latestAcceptedProposalText` is Prisma-free, so optionally lift it into `src/lib/deal-status.ts` and export it instead of duplicating (preferred — single source, and it gets unit-test coverage for free):

```ts
import { reconcileClauseStatus, latestAcceptedProposalText, type ClauseActionInput } from "@/lib/deals";
```

If lifting into `deal-status.ts`, add this exported function there (and re-export from `deals.ts`), plus a quick test in Step 1's `latestOpenProposal` describe — see Step 9a.

#### Step 9a — (Preferred) lift `latestAcceptedProposalText` into the pure module + test it (red→green)

- [ ] In `src/lib/__tests__/deals.test.ts`, add to the `latestOpenProposal` describe block:

```ts
  it("latestAcceptedProposalText returns the body of the accepted proposal", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Согласованный текст", createdAt: at(1000) },
      { id: "x1", participantId: "receiver", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
    ];
    expect(latestAcceptedProposalText(actions)).toBe("Согласованный текст");
  });

  it("latestAcceptedProposalText returns null with no acceptance", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Текст", createdAt: at(1000) },
    ];
    expect(latestAcceptedProposalText(actions)).toBeNull();
  });
```

- [ ] Add `latestAcceptedProposalText` to the import at the top of the test, and to the `../deals` re-export. Add the function to `src/lib/deal-status.ts`:

```ts
// Body text of the proposal accepted by the most recent ACCEPT_PROPOSAL,
// or null. Snapshotted into DealClause.agreedText on settlement.
export function latestAcceptedProposalText(
  actions: ClauseActionInput[]
): string | null {
  const byId = new Map(actions.map((a) => [a.id, a]));
  const accept = actions
    .filter((a) => a.kind === "ACCEPT_PROPOSAL" && a.proposalId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!accept) return null;
  const proposal = byId.get(accept.proposalId as string);
  return proposal?.kind === "PROPOSE_EDIT" ? (proposal.body ?? null) : null;
}
```

- [ ] `npx vitest run src/lib/__tests__/deals.test.ts` → green. Remove the duplicated local helpers from both routes and import the shared one instead.

#### Step 10 — Clause card: render the redline + "Принять формулировку" for the counterparty (untestable — `src/app`, verified by `tsc` + smoke)

- [ ] In `src/app/deal/[token]/clause-card.tsx`, widen the `onAction` prop type to include the new kind + an optional `proposalId`. Replace the `onAction` signature in the props (lines 71-75):

```ts
  onAction: (
    clauseId: string,
    kind: "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT" | "ACCEPT_PROPOSAL",
    body?: string,
    proposalId?: string
  ) => Promise<void>;
```

- [ ] Import the pure selector and compute the open proposal. Add the import at the top:

```ts
import { latestOpenProposal, type ClauseActionInput } from "@/lib/deals";
```

Inside the component body, after `const comments = ...` (line 85), derive the redline. Map `clause.actions` into the pure input shape (the card's `ClauseView.actions` lacks `proposalId`, so add it — see next bullet):

```ts
  // Latest counter-proposal awaiting acceptance. Only the OTHER party may
  // accept (you cannot accept your own edit). Mirrors the settlement rule
  // in reconcileClauseStatus.
  const proposalActions: ClauseActionInput[] = clause.actions.map((a) => ({
    id: a.id,
    participantId: a.participant.id,
    kind: a.kind as ClauseActionInput["kind"],
    body: a.body,
    proposalId: a.proposalId ?? null,
    createdAt: new Date(a.createdAt),
  }));
  const openProposal = latestOpenProposal(proposalActions);
  const canAcceptProposal =
    !!openProposal &&
    !!myParticipantId &&
    openProposal.participantId !== myParticipantId;
```

- [ ] Extend `ClauseView.actions[]` to carry `proposalId` so the card can read it. In the `ClauseView` interface (lines 21-31), add `proposalId: string | null;` to the action object:

```ts
  actions: Array<{
    id: string;
    kind: string;
    body: string | null;
    proposalId: string | null;
    createdAt: string;
    participant: {
      id: string;
      role: "SENDER" | "RECEIVER";
      guestName: string | null;
    };
  }>;
```

- [ ] Render the redline card. Insert this block inside the action row, just after the comments `<ul>` (after line 226, before the comment-input block at line 228):

```tsx
          {openProposal && (
            <div className="mt-4 border-l-2 border-accent/60 bg-accent/[0.04] pl-4 pr-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-accent">
                Предложена новая формулировка
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-foreground whitespace-pre-line">
                {openProposal.body}
              </p>
              {canAcceptProposal && (
                <button
                  type="button"
                  onClick={() =>
                    void onAction(clause.id, "ACCEPT_PROPOSAL", undefined, openProposal.id)
                  }
                  className={`${buttonClass({ variant: "primary", size: "sm" })} mt-2.5`}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Принять формулировку
                </button>
              )}
            </div>
          )}
```

(The `Check` icon is already imported on line 4.)

#### Step 11 — Deal room: thread `proposalId` through `onAction` + optimistic action (untestable — `src/app`, verified by `tsc` + smoke)

- [ ] In `src/app/deal/[token]/deal-room.tsx`, widen the `onAction` signature (lines 106-111) to accept the new kind + `proposalId`:

```ts
  const onAction = useCallback(
    async (
      clauseId: string,
      kind: "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT" | "ACCEPT_PROPOSAL",
      body?: string,
      proposalId?: string
    ) => {
```

- [ ] Carry `proposalId` on the optimistic action so the local reconcile can settle immediately. Update the `optimistic` object (lines 120-130) to include it:

```ts
      const optimistic = {
        id: `optimistic-${Date.now()}`,
        kind,
        body: body ?? null,
        proposalId: proposalId ?? null,
        createdAt: new Date().toISOString(),
        participant: {
          id: myParticipantId,
          role: myRole ?? ("RECEIVER" as const),
          guestName: null,
        },
      };
```

- [ ] Map `proposalId` into the reconcile input. Update the `reconciled` map (lines 147-151):

```ts
          const reconciled: ClauseActionInput[] = newActions.map((a) => ({
            id: a.id,
            participantId: a.participant.id,
            kind: a.kind as ClauseActionInput["kind"],
            proposalId: a.proposalId ?? null,
            createdAt: new Date(a.createdAt),
          }));
```

- [ ] Send `proposalId` in the POST body (lines 165-170):

```ts
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, body, proposalId }),
      });
```

- [ ] Verify the `ClauseView` type used by `deal-room.tsx`'s `setDeal`/state includes `proposalId` on actions (it imports `ClauseView` from `clause-card.tsx`, already extended in Step 10) — `npx tsc --noEmit` will flag any remaining gap in the GET payload mapping. The by-token GET already includes the full `actions` rows (route.ts:38-50 `include.actions`), so `proposalId` flows through automatically once the column exists; no GET route change is required for this task.

#### Step 12 — Full gate + manual smoke

- [ ] Run the full gate:

```
npx tsc --noEmit && npm test
```

- [ ] Build:

```
npx next build
```

(Needs `DATABASE_URL` + `AUTH_SECRET` per CLAUDE.md opening prompt.)

- [ ] Manual smoke (no automated coverage on the routes/UI): on a deal with a DISPUTED clause, the proposing side runs `NegotiationMoves` move B (Компромисс) → a `PROPOSE_EDIT` lands → the **counterparty** sees the redline card + "Принять формулировку" → click → clause flips to RESOLVED (sage "Решено" label), `DealClause.agreedText` is set in the DB, and when it is the last open clause `deal.status` promotes to AGREED. Verify in Neon:

```sql
SELECT id, status, "agreedText" FROM "DealClause" WHERE "dealId" = '<dealId>';
SELECT kind, "proposalId", body FROM "ClauseAction" WHERE "clauseId" = '<clauseId>' ORDER BY "createdAt";
```

#### Step 13 — Commit the route + UI wiring

- [ ] Commit:

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Wire the counter-propose accept loop through routes and clause card

Both action routes accept ACCEPT_PROPOSAL with a proposalId, snapshot the
agreed text into DealClause.agreedText on settlement, and count RESOLVED as
terminal-agreed in the deal-status promote/demote query (kept identical in
both routes so status never desyncs). The clause card renders the latest
open counter-proposal as a redline with an accept button shown only to the
counterparty; deal-room threads proposalId through the optimistic action.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**Sequencing note for the controller.** This task shares `src/lib/deal-status.ts`, both action routes, `clause-card.tsx`, `deal-room.tsx`, and `prisma/schema.prisma` with sibling Deal Room tasks (DR-8 touches `deal-room.tsx` + by-token GET; DR-7 touches both action routes' promote/demote block + `schema.prisma`; DR-4 touches `clause-card.tsx` + schema). **Land DR-3 before DR-7** — DR-7 adds DECLINED/EXPIRED to the very same `status: { notIn: [...] }` terminal-set in both routes, so they must be edited in agreed order to avoid a clobbered guard. **Land DR-3 before DR-5** — DR-5 exports `agreedText`, which only exists after this task. No dependency on DR-1/DR-2/DR-6/GR-1.