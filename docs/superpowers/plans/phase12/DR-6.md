### Task DR-6: Receiver suggest-moves: owner FREE-cap + correct tier (close unmetered-spend hole)

**Problem (grounded in real code).** The receiver route `src/app/api/deals/by-token/[token]/clauses/[clauseId]/suggest-moves/route.ts` correctly attributes spend to `deal.ownerId` via `logUsage` (foot-gun #60, line 116) but — unlike the sender route — does **NOT** check the owner's FREE daily-cap before `generate()` (only a 15/min rate-limit, line 24). It also hardcodes `pickTier("chat", null)` (line 100) → always Haiku, ignoring a PRO owner's tier. `?force=1` amplifies each "Обновить" press. The sender route `src/app/api/deals/[id]/clauses/[clauseId]/suggest-moves/route.ts` already has the cap block (lines 80-107) but as an inline magic-`10`/`>=` literal — so the two routes can silently diverge.

**Approach.** Extract the pure cap decision into `src/lib/ai/free-cap.ts` (`FREE_CHAT_CAP = 10` + `isOverFreeChatCap(plan, used)`), unit-test it red→green (the only way to get a CI gate since `vitest.config.ts` excludes `src/app`). Then refactor BOTH routes to import it: sender replaces its inline literal, receiver adds the gate. Receiver also resolves the owner's effective plan via `getEffectiveUserPlan` and passes it into `pickTier` (so PRO owners get Sonnet) while still `logUsage(deal.ownerId)`. `?force=1` stays cache-bypass ONLY (#59) — the cap is enforced regardless of `force`.

**Foot-guns respected.** #59 (force never bypasses cap — the cap check sits AFTER the cache-hit short-circuit but is NOT guarded by `!forceRegenerate`); #60 (receiver still `logUsage(deal.ownerId)`); #11 is N/A (we only read `User.plan`, no writes). The `aiUsage.count` DB query stays in the route (untestable glue, `src/app` excluded); the pure threshold decision lives in `free-cap.ts`.

**Files**
- create: `src/lib/ai/free-cap.ts`, `src/lib/ai/__tests__/free-cap.test.ts`
- modify (route glue, no unit test — `src/app` excluded): `src/app/api/deals/by-token/[token]/clauses/[clauseId]/suggest-moves/route.ts`, `src/app/api/deals/[id]/clauses/[clauseId]/suggest-moves/route.ts`

---

#### Step 1 — Failing test for the pure cap helper

- [ ] Create `src/lib/ai/__tests__/free-cap.test.ts` with this VERBATIM content (imports a module that does not exist yet → red):

```ts
import { describe, it, expect } from "vitest";
import { FREE_CHAT_CAP, isOverFreeChatCap } from "../free-cap";

describe("FREE_CHAT_CAP", () => {
  it("is 10 — matches the documented FREE daily chat-feature cap", () => {
    // Pinned: the negotiation suggest-moves UI promises "10 в день" for FREE.
    expect(FREE_CHAT_CAP).toBe(10);
  });
});

describe("isOverFreeChatCap — only FREE plans are capped", () => {
  it("returns false for paid plans regardless of usage", () => {
    expect(isOverFreeChatCap("PRO_SOLO", 9999)).toBe(false);
    expect(isOverFreeChatCap("PRO_TEAM", 9999)).toBe(false);
    expect(isOverFreeChatCap("BUSINESS", 9999)).toBe(false);
    // legacy "PRO" rows alias to a paid tier — never capped
    expect(isOverFreeChatCap("PRO", 9999)).toBe(false);
  });

  it("caps FREE at the boundary: 9 used is allowed, 10 used is over", () => {
    expect(isOverFreeChatCap("FREE", 0)).toBe(false);
    expect(isOverFreeChatCap("FREE", 9)).toBe(false);
    expect(isOverFreeChatCap("FREE", 10)).toBe(true);
    expect(isOverFreeChatCap("FREE", 11)).toBe(true);
  });

  it("treats an unknown / missing plan as FREE — fail closed, never grant free spend", () => {
    // A typo'd or future plan string must NOT escape the cap.
    expect(isOverFreeChatCap("ENTERPRISE", 10)).toBe(true);
    expect(isOverFreeChatCap(null, 10)).toBe(true);
    expect(isOverFreeChatCap(undefined, 10)).toBe(true);
    expect(isOverFreeChatCap("", 10)).toBe(true);
    // but below the cap an unknown plan is still allowed
    expect(isOverFreeChatCap("ENTERPRISE", 9)).toBe(false);
  });
});
```

#### Step 2 — Run to fail

- [ ] Run `npm test -- free-cap` and confirm it fails with a module-not-found / import error for `../free-cap` (proves the test exercises the right module).

#### Step 3 — Minimal implementation of the pure helper

- [ ] Create `src/lib/ai/free-cap.ts` with this VERBATIM content:

```ts
// Shared FREE-tier daily cap for the negotiation suggest-moves feature.
//
// Both the sender route (.../deals/[id]/.../suggest-moves) and the
// receiver route (.../deals/by-token/[token]/.../suggest-moves) gate on
// this before calling generate(). Keeping the threshold and the decision
// in one place means the two routes can't silently diverge — the receiver
// path used to skip the cap entirely, which let an anonymous receiver run
// unmetered Anthropic spend against the deal owner's plan (foot-gun #60).
//
// Negotiation moves run on the "chat" tier, so they count against the
// owner's FREE chat-feature usage (AiUsage rows with feature="chat" in a
// rolling 24h window). The DB count itself lives in the route (src/app is
// excluded from vitest); this module owns only the pure threshold decision
// so it can be unit-tested.

import { normalizePlan } from "@/lib/plans";

/** Max negotiation suggest-moves a FREE owner may trigger per rolling 24h. */
export const FREE_CHAT_CAP = 10;

/**
 * True when an owner on the FREE tier has hit or exceeded the daily cap and
 * must be refused (HTTP 402). Paid tiers are never capped. Unknown / missing
 * plan codes fail closed — they resolve to FREE rather than granting an
 * uncapped free pass (mirrors pickTier's "never silently spend" stance).
 *
 * `?force=1` is a cache-bypass only (foot-gun #59) — callers MUST evaluate
 * this regardless of force.
 */
export function isOverFreeChatCap(
  plan: string | null | undefined,
  used: number
): boolean {
  if (normalizePlan(plan) !== "FREE") return false;
  return used >= FREE_CHAT_CAP;
}
```

> Note: `normalizePlan` (`src/lib/plans.ts:84`) maps the legacy `"PRO"` alias to `PRO_SOLO` and any unrecognised/falsy string to `DEFAULT_PLAN` ("FREE"), giving us correct fail-closed behaviour for both the alias and unknown-plan cases without re-implementing the mapping.

#### Step 4 — Run to pass

- [ ] Run `npm test -- free-cap` and confirm all assertions pass (green).

#### Step 5 — Gate + commit the pure core

- [ ] Run `npx tsc --noEmit && npm test` — must be clean.
- [ ] Commit:

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Extract FREE chat-cap decision into a shared pure helper

The sender suggest-moves route carried the 10/day FREE cap as an inline
magic literal; the receiver route had no cap at all. Pull the threshold
and the over-cap decision into src/lib/ai/free-cap.ts so both routes
gate on the same logic and can't drift again. Unknown plans fail closed.
"
```

#### Step 6 — Wire the helper into the SENDER route (replace inline literal)

- [ ] This step edits a route under `src/app` — no unit test (vitest excludes `src/app`); covered by `tsc` + the helper's tests + manual smoke. In `src/app/api/deals/[id]/clauses/[clauseId]/suggest-moves/route.ts`, add the import after the existing `getEffectiveUserPlan` import (line 9):

```ts
import { getEffectiveUserPlan } from "@/lib/plans";
import { isOverFreeChatCap, FREE_CHAT_CAP } from "@/lib/ai/free-cap";
```

- [ ] Replace the inline FREE-cap block (lines 88-107, the `if (effectivePlan === "FREE") { ... }` block) VERBATIM from:

```ts
    if (effectivePlan === "FREE") {
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
```

to:

```ts
    // FREE owners are capped at FREE_CHAT_CAP negotiation generations per
    // rolling 24h. The count lives here (DB), the threshold decision in
    // free-cap.ts so sender and receiver routes can't diverge. The cap is
    // enforced regardless of ?force=1 — force is cache-bypass only (#59).
    if (effectivePlan === "FREE") {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCount = await prisma.aiUsage.count({
        where: {
          userId,
          feature: "chat", // negotiation uses chat tier — counted under chat
          createdAt: { gte: since },
        },
      });
      if (isOverFreeChatCap(effectivePlan, recentCount)) {
        return NextResponse.json(
          {
            error: `Лимит AI-предложений для тарифа FREE исчерпан (${FREE_CHAT_CAP} в день). Обновитесь до тарифа «Про».`,
            code: "NEGOTIATION_LIMIT",
          },
          { status: 402 }
        );
      }
    }
```

#### Step 7 — Wire the helper into the RECEIVER route (add the missing gate + real tier)

- [ ] This step edits a route under `src/app` — no unit test (excluded); covered by `tsc` + helper tests + manual smoke. In `src/app/api/deals/by-token/[token]/clauses/[clauseId]/suggest-moves/route.ts`, add two imports after the `pickTier` import (line 8):

```ts
import { pickTier } from "@/lib/ai/tier-policy";
import { getEffectiveUserPlan } from "@/lib/plans";
import { isOverFreeChatCap, FREE_CHAT_CAP } from "@/lib/ai/free-cap";
```

- [ ] Replace the tier/cache/generate region (lines 98-116) VERBATIM from:

```ts
    // Receiver session uses the SENDER owner's tier (deal context) —
    // anonymous receivers don't have their own quota.
    const tier = pickTier("chat", null);

    if (!forceRegenerate && clause.suggestedMoves) {
      return NextResponse.json(clause.suggestedMoves);
    }

    const result = await generate({
      schema: MovesSchema,
      system: NEGOTIATION_MOVES_PROMPT,
      prompt,
      model: tier,
      maxTokens: 1500,
    });

    // Anonymous receiver — log usage against the deal owner (sender) so the
    // spend shows in /admin and is attributed to the sender's plan.
    await logUsage(clause.deal.ownerId, clause.deal.orgId, result.usage, "chat");
```

to:

```ts
    // Cache hit short-circuits before any quota work — a cached read is
    // free. ?force=1 skips the cache (cache-bypass only, #59) but still
    // falls through to the FREE-cap check below.
    if (!forceRegenerate && clause.suggestedMoves) {
      return NextResponse.json(clause.suggestedMoves);
    }

    // Anonymous receivers have no quota of their own — this AI call is
    // metered against the deal owner (sender). Resolve the owner's
    // effective plan so a FREE owner is capped (foot-gun #60: the receiver
    // path previously skipped this, allowing unmetered spend) and a paid
    // owner gets their real tier instead of always-Haiku.
    const owner = await prisma.user.findUnique({
      where: { id: clause.deal.ownerId },
      select: { plan: true, trialEndsAt: true },
    });
    const effectivePlan = owner ? getEffectiveUserPlan(owner).plan : "FREE";

    if (effectivePlan === "FREE") {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCount = await prisma.aiUsage.count({
        where: {
          userId: clause.deal.ownerId,
          feature: "chat", // negotiation uses chat tier — counted under chat
          createdAt: { gte: since },
        },
      });
      if (isOverFreeChatCap(effectivePlan, recentCount)) {
        return NextResponse.json(
          {
            error: `Лимит AI-предложений для тарифа FREE исчерпан (${FREE_CHAT_CAP} в день). Обновитесь до тарифа «Про».`,
            code: "NEGOTIATION_LIMIT",
          },
          { status: 402 }
        );
      }
    }

    const tier = pickTier("chat", effectivePlan);
    const result = await generate({
      schema: MovesSchema,
      system: NEGOTIATION_MOVES_PROMPT,
      prompt,
      model: tier,
      maxTokens: 1500,
    });

    // Anonymous receiver — log usage against the deal owner (sender) so the
    // spend shows in /admin and is attributed to the sender's plan.
    await logUsage(clause.deal.ownerId, clause.deal.orgId, result.usage, "chat");
```

> Note: this re-orders the cache-hit short-circuit to sit BEFORE the new owner lookup, so a cached read does zero extra DB work. The owner lookup + cap check only run on a real generation (or `?force=1`). The line-77 `forceRegenerate` declaration earlier in the file is unchanged and still in scope.

#### Step 8 — Gate the route changes

- [ ] Run `npx tsc --noEmit && npm test` — both must be clean. (`tsc` validates the route glue compiles against the new helper; the helper's own tests already passed in Step 4.)

#### Step 9 — Commit the route wiring

- [ ] Commit:

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Cap receiver suggest-moves against the owner's FREE plan

The receiver suggest-moves route attributed spend to deal.ownerId but
never checked the owner's FREE daily cap and hardcoded pickTier('chat',
null), so any logged-in receiver could run unmetered Haiku against a
FREE owner and PRO owners silently got Haiku (foot-gun #60). Resolve the
owner's effective plan, gate on the shared isOverFreeChatCap helper
before generate(), and pass the real plan into pickTier. The cap is
enforced even on ?force=1 (cache-bypass only, #59); the sender route now
imports the same helper so the two paths stay in lockstep.
"
```

#### Step 10 — Manual smoke (deferred to preview deploy)

- [ ] On a preview deploy with a FREE owner: open `/deal/[token]` as receiver, on a DISPUTED clause press "Обновить" (sends `?force=1`) 11 times — confirm the 11th returns HTTP 402 with `code: "NEGOTIATION_LIMIT"` (cap not bypassed by force). With a PRO owner, confirm an `AiUsage` row is written with a Sonnet model (not Haiku), attributed to the owner's `userId`.