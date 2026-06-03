### Task DR-2: PostHog instrumentation of the viral funnel

**Files**
- Create: `src/lib/analytics/deal-funnel.ts` (pure tested core: typed event-name const map + distinctId resolver)
- Create: `src/lib/analytics/__tests__/deal-funnel.test.ts` (failing test first)
- Modify: `src/lib/analytics/server.ts` (extend closed `EventName` union — **SHARED with AI-7, see sequencing note**)
- Modify (route glue, NO unit test — `src/app/**` is excluded by `vitest.config.ts` L11): `src/app/api/deals/route.ts`, `src/app/api/deals/by-token/[token]/route.ts`, `src/app/api/deals/by-token/[token]/identify/route.ts`, `src/app/api/deals/[id]/clauses/[clauseId]/actions/route.ts`, `src/app/api/deals/by-token/[token]/clauses/[clauseId]/actions/route.ts`

**Sequencing note (shared file):** `src/lib/analytics/server.ts` is also edited by **AI-7** (which adds `'analyze.applyfix_unavailable'` to the same `EventName` union). Both tasks append distinct members to the union — no logical conflict, but a textual merge conflict is possible if they touch the same closing lines. Controller: run DR-2 and AI-7 **serially** (either order), not concurrently, on the union edit. All other DR-2 files are disjoint from AI-7.

**Test constraint:** vitest excludes `src/app/**`, so the routes get NO unit test. The testable core (the event-name map and the PII-safe distinctId resolver) lives in `src/lib/analytics/deal-funnel.ts` and is fully red-green-refactor TDD'd. The six route edits are thin `void captureEvent(...)` glue with no unit test — each such step is explicitly flagged below.

---

#### Step 1 — Failing test for the deal-funnel event map + distinctId resolver

- [ ] Create `src/lib/analytics/__tests__/deal-funnel.test.ts` with this VERBATIM content:

```ts
import { describe, it, expect } from "vitest";
import {
  DEAL_FUNNEL_EVENTS,
  dealFunnelDistinctId,
} from "../deal-funnel";

describe("DEAL_FUNNEL_EVENTS", () => {
  it("exposes the six viral-funnel event names as a const map", () => {
    expect(DEAL_FUNNEL_EVENTS).toEqual({
      dealCreated: "deal_created",
      dealLinkOpened: "deal_link_opened",
      receiverIdentified: "receiver_identified",
      clauseAgreed: "clause_agreed",
      clauseDisputed: "clause_disputed",
      dealAgreedComplete: "deal_agreed_complete",
    });
  });

  it("maps a reconciled clause status to its funnel event, or null", () => {
    expect(clauseEventFor("AGREED")).toBe("clause_agreed");
    expect(clauseEventFor("DISPUTED")).toBe("clause_disputed");
    expect(clauseEventFor("PENDING")).toBeNull();
    expect(clauseEventFor("RESOLVED")).toBeNull();
  });
});

describe("dealFunnelDistinctId", () => {
  it("prefers the owner cuid when present", () => {
    expect(dealFunnelDistinctId({ ownerId: "user_123", sessionId: "sess_abc" })).toBe(
      "user_123"
    );
  });

  it("falls back to the session id for anonymous receivers", () => {
    expect(dealFunnelDistinctId({ ownerId: null, sessionId: "sess_abc" })).toBe(
      "sess_abc"
    );
  });

  it("never returns null and never returns an email-like value", () => {
    const id = dealFunnelDistinctId({ ownerId: null, sessionId: null });
    expect(id).toBe("anonymous");
    // PII guard: the resolver only ever sees opaque ids, never an email.
    expect(id).not.toContain("@");
  });
});

// Imported below the describe blocks so the first failing run reports the
// missing export rather than a syntax error.
import { clauseEventFor } from "../deal-funnel";
```

> Note: `clauseEventFor` is imported at the bottom intentionally — hoisting makes the import resolve at module load, so a missing export fails the whole file cleanly on first run.

#### Step 2 — Run the test, watch it fail (module does not exist yet)

- [ ] Run:

```
npm test -- src/lib/analytics/__tests__/deal-funnel.test.ts
```

- [ ] Confirm it FAILS with a resolution error (`Cannot find module '../deal-funnel'`). This is the red state.

#### Step 3 — Minimal implementation of the pure core

- [ ] Create `src/lib/analytics/deal-funnel.ts` with this VERBATIM content:

```ts
// Pure core for DR-2 viral-funnel instrumentation. Keeping the event
// names and the distinctId resolver here (not in route handlers) lets us
// unit-test them — `src/app/**` is excluded from vitest. The routes are
// thin glue that call captureEvent with these values.

import type { EventName } from "./server";

/**
 * The six funnel stages, invite → open → engage → AGREED. Values are the
 * exact PostHog event strings; they are a subset of the closed EventName
 * union in server.ts, so a typo here is a compile error.
 */
export const DEAL_FUNNEL_EVENTS = {
  dealCreated: "deal_created",
  dealLinkOpened: "deal_link_opened",
  receiverIdentified: "receiver_identified",
  clauseAgreed: "clause_agreed",
  clauseDisputed: "clause_disputed",
  dealAgreedComplete: "deal_agreed_complete",
} as const satisfies Record<string, EventName>;

/**
 * Map a reconciled clause status to its funnel event. Only AGREED and
 * DISPUTED are funnel-meaningful; PENDING (no decision yet) and RESOLVED
 * (a future DR-3 terminal state) emit nothing.
 */
export function clauseEventFor(
  status: string
): "clause_agreed" | "clause_disputed" | null {
  if (status === "AGREED") return DEAL_FUNNEL_EVENTS.clauseAgreed;
  if (status === "DISPUTED") return DEAL_FUNNEL_EVENTS.clauseDisputed;
  return null;
}

/**
 * Resolve the PostHog distinctId for a deal-funnel event. Owner cuid wins
 * (sender / authenticated owner path); the anonymous receiver's opaque
 * session id is the fallback; "anonymous" is the last resort. Both inputs
 * are opaque ids by construction — this resolver must never be handed an
 * email or name (foot-gun: distinctId must be PII-free, never null+PII).
 */
export function dealFunnelDistinctId(args: {
  ownerId: string | null;
  sessionId: string | null;
}): string {
  return args.ownerId ?? args.sessionId ?? "anonymous";
}
```

#### Step 4 — Run the test, watch it pass

- [ ] Run:

```
npm test -- src/lib/analytics/__tests__/deal-funnel.test.ts
```

- [ ] Confirm all assertions PASS (green). The `satisfies Record<string, EventName>` line still references the *old* union — `tsc` may flag the new string literals as not assignable to `EventName` until Step 5. That is expected; tests run fine because vitest does not typecheck. Do **not** commit yet.

#### Step 5 — Extend the closed `EventName` union (SHARED FILE)

- [ ] In `src/lib/analytics/server.ts`, locate the end of the `EventName` union (currently ends at the `admin_action_performed` member, ~L96-97):

```ts
  // Admin
  | "admin_action_performed";
```

- [ ] Replace it with VERBATIM (adds a new `// Deal Room funnel (DR-2)` group before the closing semicolon):

```ts
  // Admin
  | "admin_action_performed"
  // Deal Room funnel (DR-2)
  | "deal_created"
  | "deal_link_opened"
  | "receiver_identified"
  | "clause_agreed"
  | "clause_disputed"
  | "deal_agreed_complete";
```

- [ ] Run `npx tsc --noEmit` — the `satisfies Record<string, EventName>` constraint in `deal-funnel.ts` now resolves; expect zero errors.

#### Step 6 — Run-to-pass gate + commit the tested core + union

- [ ] Run the full gate:

```
npx tsc --noEmit
npm test
```

- [ ] Confirm `tsc` clean and all tests pass (existing suite + 3 new `deal-funnel` describe blocks).
- [ ] Commit (atomic, why-not-what):

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Add typed deal-funnel event map and PII-safe distinctId resolver

DR-2 instrumentation needs a testable core: vitest excludes src/app, so
the event names and the owner-or-session distinctId rule live in
src/lib/analytics/deal-funnel.ts where they can be unit-tested. Extends the
closed EventName union with the six funnel stages so tsc pins the contract."
```

---

#### Step 7 — Wire `deal_created` (ROUTE GLUE — no unit test)

> `src/app/api/deals/route.ts` is excluded from vitest. The values it passes are already tested in Step 1-3.

- [ ] In `src/app/api/deals/route.ts`, add the import alongside the other `@/lib` imports (after the `reportError` import, ~L12):

```ts
import { captureEvent } from "@/lib/analytics/server";
import { DEAL_FUNNEL_EVENTS } from "@/lib/analytics/deal-funnel";
```

- [ ] In the `POST` handler, immediately after the existing `await logAudit({ action: "deal.created", ... })` block (after L113, before the `return NextResponse.json({ dealId... })`), insert VERBATIM:

```ts
    // Fire-and-forget funnel event. distinctId is the owner cuid (PII-free);
    // clauseCount lets us measure share-readiness per deal.
    void captureEvent({
      userId: me,
      orgId,
      event: DEAL_FUNNEL_EVENTS.dealCreated,
      properties: { clauseCount },
    });
```

#### Step 8 — Wire `deal_link_opened` (ROUTE GLUE — no unit test)

> `src/app/api/deals/by-token/[token]/route.ts` is excluded from vitest.

- [ ] Add the imports after the existing `reportError` import (~L6):

```ts
import { captureEvent } from "@/lib/analytics/server";
import { DEAL_FUNNEL_EVENTS } from "@/lib/analytics/deal-funnel";
import { dealFunnelDistinctId } from "@/lib/analytics/deal-funnel";
```

- [ ] In the `GET` handler, immediately before the final `return NextResponse.json({ deal: {...}, myParticipantId, myRole })` (before L113), insert VERBATIM:

```ts
    // Funnel: fire once we have resolved the viewer's role. distinctId is
    // the owner cuid for the sender/owner path, else the anonymous
    // receiver's opaque session id — never null+PII (foot-gun: PII-free
    // distinctId). `claimed` distinguishes a first-time receiver claim
    // from a returning visit so the open→engage step is measurable.
    void captureEvent({
      userId: dealFunnelDistinctId({
        ownerId: isOwner ? deal.ownerId : null,
        sessionId: myRole === "RECEIVER" ? myParticipantId : null,
      }),
      orgId: deal.orgId,
      event: DEAL_FUNNEL_EVENTS.dealLinkOpened,
      properties: { role: myRole ?? "anonymous" },
    });
```

> Rationale for `sessionId: myParticipantId`: the receiver's session id is httpOnly and not surfaced into a local var here, but `myParticipantId` (a server cuid) is an equally opaque, PII-free per-receiver identifier and is the value already in scope. It satisfies the "never null+PII" rule. If a strictly session-keyed distinctId is wanted later, lift `sessionId` out of the `getOrCreateDealSessionId()` call in the anonymous branch — out of scope for DR-2.

#### Step 9 — Wire `receiver_identified` (ROUTE GLUE — no unit test)

> `src/app/api/deals/by-token/[token]/identify/route.ts` is excluded from vitest. `sessionId` is already in scope here (from `getOrCreateDealSessionId()` at L20).

- [ ] Add the imports after the existing `reportError` import (~L6):

```ts
import { captureEvent } from "@/lib/analytics/server";
import { DEAL_FUNNEL_EVENTS } from "@/lib/analytics/deal-funnel";
```

- [ ] In the `POST` handler, immediately after the `await prisma.dealParticipant.update({ ... guestName ... })` block (after L59), before the `return NextResponse.json({ ok: true })`, insert VERBATIM:

```ts
    // Funnel: receiver put a name to the slot — the strongest pre-register
    // engagement signal. distinctId is the opaque session id (PII-free);
    // we attribute the spend/cohort to the deal owner's org. We never put
    // the guest name in properties (it is PII).
    void captureEvent({
      userId: sessionId,
      orgId: deal.ownerId,
      event: DEAL_FUNNEL_EVENTS.receiverIdentified,
    });
```

> Note: `deal.ownerId` is available here — `prisma.deal.findUnique` (L34) returns all scalar deal fields by default. Passing it as `orgId` keeps the group attribution on the owner; if a stricter `orgId` is desired, change the `findUnique` select to include `orgId` and pass that instead. `orgId` accepts any opaque cuid string, so this is type-safe and PII-free either way. (Controller may prefer to add `orgId: true` to the include — left as a non-blocking refinement.)

#### Step 10 — Wire sender clause events + `deal_agreed_complete` (ROUTE GLUE — no unit test)

> `src/app/api/deals/[id]/clauses/[clauseId]/actions/route.ts` is excluded from vitest. The status→event mapping is tested via `clauseEventFor` in Step 1.

- [ ] Add the imports after the existing `reportError` import (~L9):

```ts
import { captureEvent } from "@/lib/analytics/server";
import { DEAL_FUNNEL_EVENTS, clauseEventFor } from "@/lib/analytics/deal-funnel";
```

- [ ] In the `POST` handler, immediately after the `await logAudit({ action: "deal.clause_action", ... })` block (after L122), before the `return NextResponse.json({ ok: true, clauseStatus: newStatus })`, insert VERBATIM:

```ts
    // Funnel: per-clause resolution (AGREED/DISPUTED only) + deal-level
    // completion. distinctId is the sender's user cuid (PII-free).
    const clauseEvent = clauseEventFor(newStatus);
    if (clauseEvent) {
      void captureEvent({
        userId: me,
        orgId,
        event: clauseEvent,
        properties: { role: "SENDER" },
      });
    }
    if (desiredStatus === "AGREED") {
      void captureEvent({
        userId: me,
        orgId,
        event: DEAL_FUNNEL_EVENTS.dealAgreedComplete,
        properties: { role: "SENDER" },
      });
    }
```

> `desiredStatus` is already computed at L111 (`stillOpen === 0 ? "AGREED" : "ACTIVE"`), so the completion check reuses it without a new query.

#### Step 11 — Wire receiver clause events + `deal_agreed_complete` (ROUTE GLUE — no unit test)

> `src/app/api/deals/by-token/[token]/clauses/[clauseId]/actions/route.ts` is excluded from vitest.

- [ ] Add the imports after the existing `reportError` import (~L7):

```ts
import { captureEvent } from "@/lib/analytics/server";
import { DEAL_FUNNEL_EVENTS, clauseEventFor } from "@/lib/analytics/deal-funnel";
```

- [ ] In the `POST` handler, immediately after the `await prisma.deal.updateMany({ ... desiredStatus ... })` block (after L97), before the `return NextResponse.json({ ok: true, clauseStatus: newStatus })`, insert VERBATIM:

```ts
    // Funnel: per-clause resolution + deal completion, receiver side.
    // distinctId is the opaque session id (PII-free); spend/cohort is
    // attributed to the deal owner so the anonymous side stays unmetered
    // against the right org (foot-gun #60 — anonymous endpoints credit the
    // owner, not null).
    const clauseEvent = clauseEventFor(newStatus);
    if (clauseEvent) {
      void captureEvent({
        userId: sessionId,
        orgId: clause.deal.ownerId,
        event: clauseEvent,
        properties: { role: "RECEIVER" },
      });
    }
    if (desiredStatus === "AGREED") {
      void captureEvent({
        userId: sessionId,
        orgId: clause.deal.ownerId,
        event: DEAL_FUNNEL_EVENTS.dealAgreedComplete,
        properties: { role: "RECEIVER" },
      });
    }
```

> `clause.deal.ownerId` is available — the `findFirst` at L37 uses `include: { deal: { include: { participants: ... } } }`, so all scalar `deal` fields (including `ownerId`) are returned. `sessionId` and `desiredStatus` are both already in scope (L22, L93).

#### Step 12 — Final gate + commit the route glue

- [ ] Run the full gate:

```
npx tsc --noEmit
npm test
```

- [ ] Confirm `tsc` clean (all six routes typecheck against the extended union) and the full test suite passes unchanged.
- [ ] Commit (atomic, why-not-what):

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Instrument the deal viral funnel with PostHog events

Wire fire-and-forget captureEvent at the six funnel joints — deal_created
(clauseCount), deal_link_opened, receiver_identified, clause_agreed/
clause_disputed, deal_agreed_complete — so invite->open->engage->AGREED has
per-stage drop-off. distinctId is owner cuid or session id, never null+PII;
anonymous receiver events attribute the org to the deal owner."
```

---

**Acceptance for DR-2**
- `src/lib/analytics/deal-funnel.ts` unit-tested (event map shape, `clauseEventFor`, `dealFunnelDistinctId` PII-safety) — green.
- `EventName` union carries the six new members; `tsc --noEmit` clean.
- All six route joints emit fire-and-forget `void captureEvent(...)` with no awaited side effects in the response path.
- No PII in any distinctId or properties payload (no email/name/rawText); anonymous events keyed by session id, attributed to the owner's org.
- Foot-guns honored: #26 (no `email:undefined` passed — none added), #60 (anonymous events credit `deal.ownerId`), distinctId never null+PII.