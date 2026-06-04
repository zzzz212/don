### Task DR-1: Receiver→sender conversion CTA at peak intent

**Files**
- create: `src/lib/deal-cta.ts` (pure peak-intent decision logic — TESTED), `src/lib/__tests__/deal-cta.test.ts` (failing test first), `src/app/deal/[token]/receiver-cta.tsx` (presentational card — UNTESTED, lives under `src/app` which vitest excludes)
- modify: `src/app/deal/[token]/deal-room.tsx` (mount the card at two peaks — UNTESTED glue under `src/app`)
- test: `src/lib/__tests__/deal-cta.test.ts`

**Context grounding (verified against real code):**
- `deal-room.tsx` already holds `myRole` in state (line 72, set at line 93). `DealView.clauses[].actions[].participant.id` is the per-action participant (see `ClauseView` in `clause-card.tsx` lines 21-31). `myParticipantId` is state at `deal-room.tsx:71`.
- The CTA pattern to mirror is `/r/[token]` `page.tsx` lines 242-256: an editorial warm-minimalism card linking to `/sample-report` and `/register`.
- HARD constraint: `vitest.config.ts:11` excludes `src/app/**`. So the card + the mount are glue with no unit test; the **decision logic** must be a pure `src/lib` module with full red-green-refactor TDD. Test style (`src/lib/__tests__/deals.test.ts:1`): `import { describe, it, expect } from "vitest"`, import from `../<module>`.
- Pure navigation only — NO AI / schema / endpoint (sidesteps foot-gun #60). Do NOT link to `/analyze` (behind `<AppShell>`, 401 for anon — roadmap DR-1 foot-gun).
- NOTE: `deal-room.tsx` is a sharedFile with DR-8 (which also edits this file + the by-token GET payload). Sequence DR-1 and DR-8 to avoid a merge conflict on `deal-room.tsx`.

---

#### Step 1 — RED: failing test for the pure peak-intent decision

- [ ] Create `src/lib/__tests__/deal-cta.test.ts` with this VERBATIM content:

```ts
import { describe, it, expect } from "vitest";
import { shouldShowReceiverCta, type ReceiverCtaState } from "../deal-cta";

// The CTA is the network-first pivot's loop-closer: only the RECEIVER
// sees it, and only at peak intent — once they have cast at least one
// vote, or once the whole deal is AGREED. Senders never see it; a
// receiver who has not yet engaged does not see it either.

const base: ReceiverCtaState = {
  myRole: "RECEIVER",
  hasVoted: false,
  dealStatus: "ACTIVE",
};

describe("shouldShowReceiverCta", () => {
  it("hides for the sender even after voting on an AGREED deal", () => {
    expect(
      shouldShowReceiverCta({
        ...base,
        myRole: "SENDER",
        hasVoted: true,
        dealStatus: "AGREED",
      })
    ).toBe(false);
  });

  it("hides for an anonymous viewer with no role", () => {
    expect(
      shouldShowReceiverCta({ ...base, myRole: null, hasVoted: true })
    ).toBe(false);
  });

  it("hides for a receiver who has not yet voted on an active deal", () => {
    expect(shouldShowReceiverCta(base)).toBe(false);
  });

  it("shows for a receiver after their first vote", () => {
    expect(shouldShowReceiverCta({ ...base, hasVoted: true })).toBe(true);
  });

  it("shows for a receiver once the deal is AGREED, even with no vote", () => {
    expect(
      shouldShowReceiverCta({ ...base, hasVoted: false, dealStatus: "AGREED" })
    ).toBe(true);
  });
});
```

#### Step 2 — Run to fail

- [ ] Run `npm test -- deal-cta` and confirm it fails because `../deal-cta` does not exist (module-not-found). This proves the test runs and is red for the right reason.

#### Step 3 — GREEN: minimal pure implementation

- [ ] Create `src/lib/deal-cta.ts` with this VERBATIM content:

```ts
// Pure decision logic for the receiver→sender conversion CTA. Kept out
// of the page component so the client bundle stays thin and the logic is
// unit-testable (vitest excludes src/app). The CTA closes the network-
// first loop: a contractor who just dissected a real contract is at peak
// intent — show them the door to analysing their own, but only the
// RECEIVER and only once they have engaged.

export interface ReceiverCtaState {
  myRole: "SENDER" | "RECEIVER" | null;
  /** True once this participant has cast at least one AGREE/DISAGREE. */
  hasVoted: boolean;
  dealStatus: "ACTIVE" | "AGREED";
}

export function shouldShowReceiverCta(state: ReceiverCtaState): boolean {
  if (state.myRole !== "RECEIVER") return false;
  return state.hasVoted || state.dealStatus === "AGREED";
}
```

#### Step 4 — Run to pass

- [ ] Run `npm test -- deal-cta` and confirm all 5 assertions pass.

#### Step 5 — COMMIT the tested core

- [ ] Gate: `npx tsc --noEmit && npm test`
- [ ] Commit:

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" \
  commit -am "Add pure peak-intent logic for the receiver→sender CTA

The network-first pivot promises every sent deal pulls a warm
contractor into Яксо's orbit, but the live deal room has zero
conversion touchpoints — the receiver dissects a real contract,
votes, reaches AGREED, and leaves. shouldShowReceiverCta encodes
when to surface the loop-closer: RECEIVER only, at peak intent
(after first vote, or once the deal is AGREED). Pure module so it
carries a unit test (src/app is excluded from vitest)."
```

---

#### Step 6 — Presentational card (UNTESTED — under src/app)

- [ ] Create `src/app/deal/[token]/receiver-cta.tsx`. This is presentational glue under `src/app`, so it gets **no unit test** (vitest excludes the dir); all branching logic already lives in the tested `shouldShowReceiverCta`. Mirrors the `/r/[token]` CTA (`page.tsx:242-256`) in warm-minimalism / editorial voice. VERBATIM content:

```tsx
import Link from "next/link";
import { buttonClass } from "@/components/button";

// Editorial conversion card shown to the RECEIVER at peak intent — see
// shouldShowReceiverCta in src/lib/deal-cta.ts for the when. Pure
// navigation: links to /sample-report (value-first) or /register. No
// AI, no endpoint — sidesteps foot-gun #60 and keeps the page anon-safe.
// Never link to /analyze: it sits behind <AppShell> and 401s for anons.

export function ReceiverCta({ variant }: { variant: "inline" | "colophon" }) {
  return (
    <aside
      className={`rounded-2xl border border-primary/25 bg-primary-light/30 px-6 py-7 text-center ${
        variant === "colophon" ? "mt-12" : "mt-8"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-primary">
        Ваш ход
      </p>
      <p className="mt-2 font-serif text-xl font-semibold tracking-tight text-foreground">
        Понравилось, как Яксо разобрал этот договор?
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-quiet">
        Загрузите свой — без логина, за пару минут. Увидите риски и что
        исправить до подписания.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link href="/register" className={buttonClass({ size: "md" })}>
          Разобрать свой договор
        </Link>
        <Link
          href="/sample-report"
          className="text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
        >
          Сначала посмотреть пример →
        </Link>
      </div>
    </aside>
  );
}
```

#### Step 7 — Mount at two peaks in deal-room.tsx (UNTESTED — under src/app)

- [ ] Edit `src/app/deal/[token]/deal-room.tsx`. This file is under `src/app` (excluded from vitest) — it is thin glue; the decision is delegated to the tested helper.

- [ ] Add the imports. Find the existing import block (lines 7-14) and add after the `buttonClass` import line:

```tsx
import { ReceiverCta } from "./receiver-cta";
import { shouldShowReceiverCta } from "@/lib/deal-cta";
```

- [ ] Derive the flags in the render body, right after the perspective-chip block (after `const chipTone = ...` near line 250, before the `return (`). Add VERBATIM:

```tsx
  // Has the local receiver cast at least one AGREE/DISAGREE on any clause?
  // Drives the post-vote CTA peak (see src/lib/deal-cta.ts).
  const hasVoted = myParticipantId
    ? deal.clauses.some((c) =>
        c.actions.some(
          (a) =>
            a.participant.id === myParticipantId &&
            (a.kind === "AGREE" || a.kind === "DISAGREE")
        )
      )
    : false;
  const showReceiverCta = shouldShowReceiverCta({
    myRole,
    hasVoted,
    dealStatus: deal.status,
  });
```

- [ ] Mount the inline (post-vote) instance: place it directly after the clauses `<div className="space-y-10">…</div>` block closes (after line 333, before the closing colophon `<footer>` at line 337). Insert VERBATIM:

```tsx
        {showReceiverCta && deal.status !== "AGREED" && (
          <ReceiverCta variant="inline" />
        )}
```

- [ ] Mount the colophon (AGREED) instance: replace the existing closing `<footer>` block (lines 337-347) so the CTA precedes the printer's-mark colophon when the deal is fully agreed. Replace VERBATIM:

```tsx
        {/* Closing colophon — tiny brand mark at the bottom of the
            document, like a printer's mark on a legal opinion. */}
        <footer className="mt-20 text-center">
```

with:

```tsx
        {showReceiverCta && deal.status === "AGREED" && (
          <ReceiverCta variant="colophon" />
        )}

        {/* Closing colophon — tiny brand mark at the bottom of the
            document, like a printer's mark on a legal opinion. */}
        <footer className="mt-20 text-center">
```

(Mounting is mutually exclusive by `deal.status`: inline shows on ACTIVE-after-vote, colophon shows on AGREED — never both.)

#### Step 8 — Verify the glue compiles and nothing regressed

- [ ] Gate: `npx tsc --noEmit && npm test` (full suite — confirms the new pure test passes and the deal-room edits typecheck against the real `DealView` shape: `deal.status` is `"ACTIVE" | "AGREED"`, `myRole` is `"SENDER" | "RECEIVER" | null`, both already matching `ReceiverCtaState`).

#### Step 9 — COMMIT the presentational wiring

- [ ] Commit:

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" \
  commit -am "Mount receiver→sender CTA at peak intent in the deal room

Surfaces the editorial conversion card only for myRole===RECEIVER
at two peaks: inline after the receiver's first vote on an active
deal, and on the colophon once the deal is AGREED. Pure navigation
to /register and /sample-report (mirrors the /r/[token] card) — no
AI, no endpoint, so it sidesteps foot-gun #60 and stays anon-safe.
Never links to /analyze (it 401s for anons behind AppShell). The
when lives in the tested shouldShowReceiverCta; this is thin glue."
```

---

**Testability note (per the hard constraint):** the only branching logic — RECEIVER-gate + peak-intent (post-vote OR AGREED) — is isolated in `src/lib/deal-cta.ts` and covered by full red-green-refactor TDD in `src/lib/__tests__/deal-cta.test.ts` (5 cases: sender-hidden, no-role-hidden, receiver-no-vote-hidden, receiver-post-vote-shown, receiver-AGREED-shown). The card (`receiver-cta.tsx`) and the mount (`deal-room.tsx`) are presentational/glue under `src/app`, which vitest excludes — they carry no unit test by design, and they contain no logic beyond rendering and delegating to the tested helper.

**Sequencing note for the controller:** `src/app/deal/[token]/deal-room.tsx` is also edited by DR-8 (presence + auto-refresh, which additionally touches the by-token GET payload). These two tasks share that file — run them sequentially (either order) rather than in parallel to avoid a conflict. No other overlap.