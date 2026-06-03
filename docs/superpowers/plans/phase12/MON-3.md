### Task MON-3: Self-serve subscription cancel (cancel-half only; auto-renew deferred to YooKassa)

**Files**
- Create: `src/lib/billing/cancel.ts` (pure decision helpers — fully unit-tested), `src/lib/billing/__tests__/cancel.test.ts`, `src/app/api/billing/cancel/route.ts` (thin OWNER-gated glue — NO unit test, `src/app` excluded by vitest)
- Modify: `src/lib/billing/index.ts` (add `cancelSubscriptionAtPeriodEnd` + `applyExpiryDowngrades` impure DB functions), `src/app/billing/page.tsx` (cancel/resume toggle UI — page, NO unit test)
- Shared with other buildable tasks: `src/lib/billing/index.ts`

**Why this shape.** `vitest.config.ts` excludes `src/app`, so the route + page get no unit test. The two *decisions* that carry all the risk — (1) "is this subscription in a state where it can be canceled?" and (2) "should this paid user be downgraded to FREE now because their canceled period ended?" — are extracted into pure functions in `src/lib/billing/cancel.ts` and TDD'd there. The DB writes (impure) live next to the existing dual-write template in `src/lib/billing/index.ts`; the route is thin glue. We do NOT build auto-renew/charge (YooKassa Автоплатежи not activated, untestable end-to-end) — roadmap §MON-3 explicitly splits it out.

Audit note: action `billing.subscription_canceled` ALREADY exists in the `AuditAction` union and in `ACTION_LABELS` (`src/app/settings/organization/audit/page.tsx`), so foot-gun #24 is already satisfied — reuse it, do NOT add new vocab.

---

#### Step 1 — Failing test: `canCancelSubscription` pure decision

- [ ] Create `src/lib/billing/__tests__/cancel.test.ts` with the first describe block:

```ts
import { describe, it, expect } from "vitest";
import {
  canCancelSubscription,
  resolveExpiryDowngrade,
} from "../cancel";

describe("canCancelSubscription", () => {
  it("allows cancelling an ACTIVE subscription not already scheduled to cancel", () => {
    const r = canCancelSubscription({
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
    });
    expect(r).toEqual({ ok: true });
  });

  it("rejects when there is no subscription row", () => {
    const r = canCancelSubscription(null);
    expect(r).toEqual({ ok: false, reason: "NO_SUBSCRIPTION" });
  });

  it("rejects an already-scheduled cancel as a no-op (idempotent UI guard)", () => {
    const r = canCancelSubscription({
      status: "ACTIVE",
      cancelAtPeriodEnd: true,
    });
    expect(r).toEqual({ ok: false, reason: "ALREADY_SCHEDULED" });
  });

  it("rejects a subscription that is not ACTIVE (already CANCELED / PAST_DUE)", () => {
    expect(canCancelSubscription({ status: "CANCELED", cancelAtPeriodEnd: false }))
      .toEqual({ ok: false, reason: "NOT_ACTIVE" });
    expect(canCancelSubscription({ status: "PAST_DUE", cancelAtPeriodEnd: false }))
      .toEqual({ ok: false, reason: "NOT_ACTIVE" });
  });
});
```

- [ ] Run to fail: `npx vitest run src/lib/billing/__tests__/cancel.test.ts` → fails (module `../cancel` does not exist).

#### Step 2 — Minimal impl: `canCancelSubscription`

- [ ] Create `src/lib/billing/cancel.ts`:

```ts
// Pure decision helpers for self-serve subscription cancellation.
//
// Two independent decisions live here so they can be unit-tested without
// a DB (vitest excludes src/app, and these are the only parts of the
// cancel flow that carry real risk):
//
//   1. canCancelSubscription — "is this sub in a state a user may cancel?"
//      Drives the POST /api/billing/cancel guard AND the /billing toggle.
//   2. resolveExpiryDowngrade — "has a canceled paid period elapsed, so
//      the user must drop to FREE now?" Drives the lazy expiry-downgrade
//      that runs on every billing-status read (no renewal-cron yet).
//
// We deliberately DON'T model auto-renew/charging here — YooKassa
// Автоплатежи isn't activated and can't be tested end-to-end, so the
// renew half of MON-3 is deferred (see roadmap §MON-3).

/** Minimal subscription shape the cancel decision needs. */
export interface CancelableSubscription {
  /** "ACTIVE" | "CANCELED" | "PAST_DUE" — see Subscription.status. */
  status: string;
  cancelAtPeriodEnd: boolean;
}

export type CancelRejection =
  | "NO_SUBSCRIPTION"
  | "ALREADY_SCHEDULED"
  | "NOT_ACTIVE";

export type CancelDecision =
  | { ok: true }
  | { ok: false; reason: CancelRejection };

/**
 * Decide whether the owner may schedule a cancel-at-period-end. We only
 * touch ACTIVE subscriptions that aren't already scheduled — the access
 * stays until currentPeriodEnd, so there is nothing to "cancel" on a row
 * that is already CANCELED, and re-scheduling is a no-op the UI should
 * surface as "already scheduled" rather than a spurious success.
 */
export function canCancelSubscription(
  sub: CancelableSubscription | null
): CancelDecision {
  if (!sub) return { ok: false, reason: "NO_SUBSCRIPTION" };
  if (sub.status !== "ACTIVE") return { ok: false, reason: "NOT_ACTIVE" };
  if (sub.cancelAtPeriodEnd) {
    return { ok: false, reason: "ALREADY_SCHEDULED" };
  }
  return { ok: true };
}
```

- [ ] Run to pass: `npx vitest run src/lib/billing/__tests__/cancel.test.ts` → `canCancelSubscription` block green (the `resolveExpiryDowngrade` import is unresolved → file still fails to load; that's fine, next step adds it). If the runner refuses to load the file, temporarily comment the `resolveExpiryDowngrade` import — but prefer to roll straight into Step 3 so the file compiles once.

#### Step 3 — Failing test: `resolveExpiryDowngrade` pure decision

- [ ] Append to `src/lib/billing/__tests__/cancel.test.ts`:

```ts
describe("resolveExpiryDowngrade", () => {
  const NOW = new Date("2026-06-04T12:00:00.000Z");
  const past = new Date("2026-06-01T00:00:00.000Z");
  const future = new Date("2026-07-01T00:00:00.000Z");

  it("downgrades a canceled paid sub whose period has ended", () => {
    const r = resolveExpiryDowngrade(
      { status: "ACTIVE", cancelAtPeriodEnd: true, currentPeriodEnd: past },
      NOW
    );
    expect(r).toEqual({ downgrade: true });
  });

  it("does NOT downgrade when the canceled period is still running", () => {
    const r = resolveExpiryDowngrade(
      { status: "ACTIVE", cancelAtPeriodEnd: true, currentPeriodEnd: future },
      NOW
    );
    expect(r).toEqual({ downgrade: false });
  });

  it("does NOT downgrade an active sub that was never canceled, even past period end (renewal owns it)", () => {
    // Auto-renew isn't built; a non-canceled sub past its end is the
    // renewal-cron's job, NOT the expiry-downgrade's — we must never
    // strip a paying user who simply hasn't been re-charged yet.
    const r = resolveExpiryDowngrade(
      { status: "ACTIVE", cancelAtPeriodEnd: false, currentPeriodEnd: past },
      NOW
    );
    expect(r).toEqual({ downgrade: false });
  });

  it("treats the exact boundary instant as not-yet-expired", () => {
    const r = resolveExpiryDowngrade(
      { status: "ACTIVE", cancelAtPeriodEnd: true, currentPeriodEnd: NOW },
      NOW
    );
    expect(r).toEqual({ downgrade: false });
  });

  it("returns no downgrade for a null subscription", () => {
    expect(resolveExpiryDowngrade(null, NOW)).toEqual({ downgrade: false });
  });

  it("does not re-downgrade an already-CANCELED row (idempotent)", () => {
    // Once applied, status flips to CANCELED. A second pass must be a
    // no-op so we don't churn writes on every status read.
    const r = resolveExpiryDowngrade(
      { status: "CANCELED", cancelAtPeriodEnd: true, currentPeriodEnd: past },
      NOW
    );
    expect(r).toEqual({ downgrade: false });
  });
});
```

- [ ] Run to fail: `npx vitest run src/lib/billing/__tests__/cancel.test.ts` → `resolveExpiryDowngrade` is not exported.

#### Step 4 — Minimal impl: `resolveExpiryDowngrade`

- [ ] Append to `src/lib/billing/cancel.ts`:

```ts
/** Subscription fields the expiry decision reads. */
export interface ExpirableSubscription {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date;
}

export interface ExpiryDecision {
  /** True iff the user must be downgraded to FREE right now. */
  downgrade: boolean;
}

/**
 * Decide whether a canceled subscription's paid period has elapsed and
 * the user should drop to FREE. Pure — `now` injected for deterministic
 * tests, mirrors getEffectivePlan(ctx, now).
 *
 * Guards:
 *   • only ACTIVE rows scheduled to cancel are candidates — a row that
 *     already flipped to CANCELED was downgraded on a previous pass, and
 *     re-evaluating it must be a no-op (idempotent across repeated reads);
 *   • a non-canceled ACTIVE sub past its end is the (future) renewal
 *     cron's job, NEVER ours — we must not strip a paying user who simply
 *     hasn't been re-charged yet;
 *   • the boundary instant counts as not-yet-expired (access through the
 *     last paid moment).
 */
export function resolveExpiryDowngrade(
  sub: ExpirableSubscription | null,
  now: Date = new Date()
): ExpiryDecision {
  if (!sub) return { downgrade: false };
  if (sub.status !== "ACTIVE") return { downgrade: false };
  if (!sub.cancelAtPeriodEnd) return { downgrade: false };
  if (sub.currentPeriodEnd.getTime() > now.getTime()) {
    return { downgrade: false };
  }
  return { downgrade: true };
}
```

- [ ] Run to pass: `npx vitest run src/lib/billing/__tests__/cancel.test.ts` → all green.
- [ ] Gate: `npx tsc --noEmit && npm test`.
- [ ] Commit:

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Add pure cancel + expiry-downgrade decisions for self-serve cancel

Two risk-bearing decisions (may-cancel guard, period-ended downgrade)
extracted as pure helpers so they're testable under vitest, which
excludes src/app. Auto-renew/charge is deliberately out of scope —
YooKassa Автоплатежи isn't activated, so the renew half of MON-3 is
deferred."
```

#### Step 5 — Impure DB layer: `cancelSubscriptionAtPeriodEnd` + `applyExpiryDowngrades` in `src/lib/billing/index.ts`

No unit test — these touch Prisma and live in `src/lib/billing/index.ts` next to the existing dual-write template (`applySucceededPayment`). The tested decision they wrap is already green.

- [ ] In `src/lib/billing/index.ts`, add the import for the pure decisions near the top (after the existing `from "@/lib/db"` import line):

```ts
import { canCancelSubscription, resolveExpiryDowngrade } from "./cancel";
```

- [ ] Append these two functions to `src/lib/billing/index.ts` (after `isBillingConfigured`):

```ts
/**
 * Schedule a cancel-at-period-end for the workspace's subscription. The
 * user keeps full access until currentPeriodEnd; we only flip the flag
 * and stamp canceledAt. No provider call — there is no recurring charge
 * to stop yet (auto-renew is deferred), so cancelling is purely "don't
 * renew when the renewal loop ships". Returns the decision so the route
 * can map it to a precise HTTP status.
 */
export async function cancelSubscriptionAtPeriodEnd(
  orgId: string
): Promise<
  | { ok: true; currentPeriodEnd: string }
  | { ok: false; reason: "NO_SUBSCRIPTION" | "ALREADY_SCHEDULED" | "NOT_ACTIVE" }
> {
  const sub = await prisma.subscription.findUnique({
    where: { orgId },
    select: { status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true },
  });

  const decision = canCancelSubscription(sub);
  if (!decision.ok) return decision;

  const updated = await prisma.subscription.update({
    where: { orgId },
    data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
    select: { currentPeriodEnd: true },
  });

  return { ok: true, currentPeriodEnd: updated.currentPeriodEnd.toISOString() };
}

/**
 * Resume a subscription scheduled to cancel — clears the flag so it keeps
 * renewing (once auto-renew ships) and stays paid. Only meaningful while
 * the period is still running; a no-op otherwise.
 */
export async function resumeSubscription(
  orgId: string
): Promise<{ ok: boolean }> {
  const sub = await prisma.subscription.findUnique({
    where: { orgId },
    select: { status: true, cancelAtPeriodEnd: true },
  });
  if (!sub || sub.status !== "ACTIVE" || !sub.cancelAtPeriodEnd) {
    return { ok: false };
  }
  await prisma.subscription.update({
    where: { orgId },
    data: { cancelAtPeriodEnd: false, canceledAt: null },
  });
  return { ok: true };
}

/**
 * Lazy expiry downgrade. Called on billing-status reads (no renewal cron
 * yet): if the OWNER's subscription was canceled and its period has now
 * elapsed, drop them to FREE. Dual-writes User.plan (authoritative) AND
 * Organization.plan (legacy mirror) + flips the Subscription to CANCELED
 * so the next pass is a no-op — matches the applySucceededPayment
 * dual-write pattern and foot-gun #11.
 *
 * Idempotent and safe to call on every read: resolveExpiryDowngrade
 * returns false once the row is CANCELED.
 */
export async function applyExpiryDowngrade(
  orgId: string,
  now: Date = new Date()
): Promise<{ downgraded: boolean; userId: string | null }> {
  const sub = await prisma.subscription.findUnique({
    where: { orgId },
    select: {
      status: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
      userId: true,
    },
  });

  const decision = resolveExpiryDowngrade(sub, now);
  if (!decision.downgrade) return { downgraded: false, userId: sub?.userId ?? null };

  await prisma.$transaction(async (tx) => {
    // Authoritative quota source — drop the seat owner to FREE.
    if (sub!.userId) {
      await tx.user.update({
        where: { id: sub!.userId },
        data: { plan: "FREE" },
      });
    }
    // Legacy mirror so pre-rollout admin queries stay consistent (#11).
    await tx.organization.update({
      where: { id: orgId },
      data: { plan: "FREE" },
    });
    // Terminal state — makes the next resolveExpiryDowngrade a no-op.
    await tx.subscription.update({
      where: { orgId },
      data: { status: "CANCELED" },
    });
  });

  return { downgraded: true, userId: sub!.userId ?? null };
}
```

- [ ] Gate: `npx tsc --noEmit && npm test` (no new tests; this is type-checked glue over already-green decisions).
- [ ] Commit:

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Add cancel / resume / expiry-downgrade DB ops in billing/index

Thin Prisma wrappers over the pure cancel decisions. Expiry downgrade
dual-writes User.plan + Organization.plan and flips the sub to CANCELED
so repeated billing-status reads are idempotent (foot-gun #11). No
provider call — there is no recurring charge to stop until auto-renew
ships."
```

#### Step 6 — Wire lazy downgrade into `GET /api/billing/status` (route, NO unit test)

This is a route edit (`src/app` — excluded from vitest); the logic it calls is already tested. Keeps the downgrade running with no renewal cron: every OWNER billing-status read self-heals an expired canceled sub before the response is computed.

- [ ] In `src/app/api/billing/status/route.ts`, add to the imports:

```ts
import { applyExpiryDowngrade } from "@/lib/billing";
```

- [ ] In `src/app/api/billing/status/route.ts`, immediately AFTER `const membership = await requireMembership(userId, orgId, "OWNER");` and BEFORE the `Promise.all([...])`, insert:

```ts
    // Lazy expiry downgrade: no renewal cron yet, so a canceled sub whose
    // period has elapsed is reconciled to FREE here, on the OWNER's own
    // billing read, before we resolve the effective plan below.
    await applyExpiryDowngrade(orgId);
```

- [ ] Gate: `npx tsc --noEmit && npm test`.
- [ ] Commit:

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Reconcile expired canceled subs on billing-status read

With no renewal cron yet, a canceled subscription past its period end
must drop the user to FREE somewhere. Do it lazily on the OWNER's own
billing-status read via the idempotent applyExpiryDowngrade."
```

#### Step 7 — New route `POST /api/billing/cancel` (OWNER-only, route — NO unit test)

Mirrors `activate-trial/route.ts` exactly: `auth()` → `ensureActiveOrg` → `requireMembership(..., "OWNER")` → call lib → map reason to HTTP → audit/analytics fire-and-forget. Foot-gun #26: the audit payload carries only `cancelAtPeriodEnd` / `currentPeriodEnd` — no email/token/secret.

- [ ] Create `src/app/api/billing/cancel/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  ensureActiveOrg,
  requireMembership,
  OrgAccessError,
} from "@/lib/org";
import {
  cancelSubscriptionAtPeriodEnd,
  resumeSubscription,
} from "@/lib/billing";
import { reportError } from "@/lib/telemetry";
import { captureEvent } from "@/lib/analytics/server";
import { logAudit } from "@/lib/audit";

// POST /api/billing/cancel
//   Self-serve cancel-at-period-end (and resume) for the workspace's
//   subscription. OWNER-only — cancelling flips the effective plan once
//   the period ends, a workspace-level decision. No provider call: there
//   is no recurring charge to stop yet (auto-renew deferred, roadmap
//   §MON-3), we only set Subscription.cancelAtPeriodEnd so the future
//   renewal loop skips this seat.
//
//   Body: { resume?: boolean }. resume=true clears a scheduled cancel.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const orgId = session.user.activeOrgId ?? (await ensureActiveOrg(userId));
    await requireMembership(userId, orgId, "OWNER");

    const body = (await request.json().catch(() => ({}))) as {
      resume?: boolean;
    };

    if (body.resume === true) {
      const r = await resumeSubscription(orgId);
      if (!r.ok) {
        return NextResponse.json(
          { error: "Нет подписки, запланированной к отмене." },
          { status: 409 }
        );
      }
      void logAudit({
        orgId,
        userId,
        action: "billing.subscription_canceled",
        target: orgId,
        targetType: "subscription",
        payload: { resumed: true },
      });
      return NextResponse.json({ ok: true, cancelAtPeriodEnd: false });
    }

    const result = await cancelSubscriptionAtPeriodEnd(orgId);
    if (!result.ok) {
      const map: Record<string, { msg: string; code: number }> = {
        NO_SUBSCRIPTION: {
          msg: "Нет активной подписки для отмены.",
          code: 409,
        },
        ALREADY_SCHEDULED: {
          msg: "Подписка уже запланирована к отмене в конце периода.",
          code: 409,
        },
        NOT_ACTIVE: {
          msg: "Подписка не активна.",
          code: 409,
        },
      };
      const m = map[result.reason] ?? {
        msg: "Не удалось отменить подписку.",
        code: 400,
      };
      return NextResponse.json({ error: m.msg }, { status: m.code });
    }

    void captureEvent({
      userId,
      orgId,
      event: "subscription_cancel_scheduled",
      properties: { currentPeriodEnd: result.currentPeriodEnd },
    });
    void logAudit({
      orgId,
      userId,
      action: "billing.subscription_canceled",
      target: orgId,
      targetType: "subscription",
      // No PII here — only the schedule fact + the period boundary.
      payload: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: result.currentPeriodEnd,
      },
    });

    return NextResponse.json({
      ok: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: result.currentPeriodEnd,
    });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    await reportError(error, { op: "billing.cancel" });
    return NextResponse.json(
      { error: "Не удалось отменить подписку. Попробуйте позже." },
      { status: 500 }
    );
  }
}
```

- [ ] Verify the analytics import path matches the codebase: `captureEvent` is imported from `@/lib/analytics/server` in `activate-trial/route.ts` — keep it identical. If `captureEvent` rejects a new `event` string due to a typed union, drop the `void captureEvent(...)` call (audit already records the action); do not invent a union member.
- [ ] Gate: `npx tsc --noEmit && npm test`.
- [ ] Commit:

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Add POST /api/billing/cancel — OWNER-only self-serve cancel + resume

Sets Subscription.cancelAtPeriodEnd (resume clears it); user keeps
access until currentPeriodEnd. Mirrors activate-trial's auth/OWNER
gate and audit/analytics fire-and-forget. Closes the offer-compliance
debt ('отключить автопродление в любой момент'). No charge stopped —
auto-renew is deferred until YooKassa Автоплатежи is live."
```

#### Step 8 — `/billing` UI: cancel / resume toggle (page — NO unit test)

`src/app/billing/page.tsx` is a client page (excluded from vitest). The `SubscriptionInfo` interface already carries `cancelAtPeriodEnd` and `canceledAt`, and `/api/billing/status` already returns them — no shape change needed. Add a cancel/resume control inside the existing "Current plan card", reusing the page's existing `reload()`.

- [ ] In `src/app/billing/page.tsx`, add cancel state near the other `useState` hooks (after the `trialError` state line):

```tsx
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
```

- [ ] In `src/app/billing/page.tsx`, add the handler after `handleActivateTrial` (before `handleCheckout`):

```tsx
  const handleCancelToggle = async (resume: boolean) => {
    setCancelLoading(true);
    setCancelError(null);
    try {
      const r = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setCancelError(json.error ?? "Не удалось изменить подписку.");
        return;
      }
      // Re-read so the badge / "действует до" / toggle reflect the new
      // cancelAtPeriodEnd state.
      reload();
    } catch {
      setCancelError("Сеть недоступна.");
    } finally {
      setCancelLoading(false);
    }
  };
```

- [ ] In `src/app/billing/page.tsx`, inside the current-plan `<section>`, immediately AFTER the existing `data.subscription && data.subscription.status === "CANCELED"` notice block (the one ending `доступ к функциям тарифа сохраняется до …`), insert the toggle for ACTIVE subscriptions:

```tsx
                {data.subscription && data.subscription.status === "ACTIVE" && (
                  <div className="mt-5 border-t border-border pt-5">
                    {cancelError && (
                      <p className="mb-3 flex items-center gap-1.5 text-sm text-danger">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {cancelError}
                      </p>
                    )}
                    {data.subscription.cancelAtPeriodEnd ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted">
                          Подписка будет отменена{" "}
                          <strong className="text-foreground">
                            {formatDate(data.subscription.currentPeriodEnd)}
                          </strong>
                          . До этой даты доступ сохраняется.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCancelToggle(true)}
                          disabled={cancelLoading}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                        >
                          {cancelLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Сохраняем...
                            </>
                          ) : (
                            "Возобновить подписку"
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted">
                          Вы можете отключить продление в любой момент — доступ
                          сохранится до конца оплаченного периода.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCancelToggle(false)}
                          disabled={cancelLoading}
                          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                        >
                          {cancelLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Отменяем...
                            </>
                          ) : (
                            "Отменить подписку"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
```

(`AlertCircle`, `Loader2`, `formatDate` are already imported / defined in this file — no new imports.)

- [ ] Gate: `npx tsc --noEmit && npm test`, then `npx next build` (with `DATABASE_URL` + `AUTH_SECRET` dummy env per the opening prompt) to confirm the client page compiles.
- [ ] Commit:

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Add cancel / resume toggle to /billing current-plan card

Surfaces self-serve cancel for ACTIVE subscriptions and resume when a
cancel is already scheduled, reusing the existing reload() and the
cancelAtPeriodEnd field /api/billing/status already returns. Fulfils
the offer promise that users can turn off renewal themselves."
```

#### Step 9 — Final verification (no success claim without evidence)

- [ ] `npx tsc --noEmit` → clean.
- [ ] `npm test` → all green (baseline + new `cancel.test.ts` cases). Confirm the new file ran (`vitest run src/lib/billing/__tests__/cancel.test.ts` shows the two describe blocks).
- [ ] `npx next build` → clean.
- [ ] Manual smoke (deferred to preview — YooKassa not configured locally, so an ACTIVE sub must be seeded by SQL): with an ACTIVE `Subscription` for your OWNER org, `/billing` shows "Отменить подписку"; clicking schedules cancel (`cancelAtPeriodEnd=true`, `canceledAt` set), card flips to "Возобновить подписку"; setting `currentPeriodEnd` to the past then reloading `/billing` drops `User.plan` to FREE and flips the sub to CANCELED. Note: do NOT attempt to exercise charge/auto-renew — it is out of scope and unconfigured.

**Out of scope (explicit, per roadmap §MON-3 split):** no `YookassaClient` charge method, no renewal cron, no `PAST_DUE`/dunning. Those land "после активации YooKassa" once Автоплатежи is enabled and end-to-end testable.