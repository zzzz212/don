### Task DR-8: Lightweight presence + auto-refresh (polling-first, no new infra)

**Files**
- create: `src/lib/deal-presence.ts`, `src/lib/__tests__/deal-presence.test.ts`, `src/lib/deal-merge.ts`, `src/lib/__tests__/deal-merge.test.ts`
- modify: `src/app/api/deals/by-token/[token]/route.ts` (untestable route — add `lastSeenAt` to payload), `src/app/deal/[token]/deal-room.tsx` (untestable glue — wire presence + visibility-gated poll)
- test: `src/lib/__tests__/deal-presence.test.ts`, `src/lib/__tests__/deal-merge.test.ts`

**Sequencing.** `dependsOn: DR-1`. DR-8 shares `src/app/deal/[token]/deal-room.tsx` with DR-1; DR-1 lands first, so the DR-8 edits below splice into the file as it exists *after* DR-1 (the `useCallback`/`useEffect` block at the top of `DealRoom` and the title-page `<header>` are untouched by DR-1's RECEIVER-only CTA card, so the anchors stay valid). The two pure `src/lib` modules have zero overlap with any other task.

**Why two pure modules.** `vitest.config.ts` excludes `src/app/**` (line 11), so `deal-room.tsx` and `route.ts` get NO unit tests. The two pieces of real logic — the presence formatter and the optimistic-vs-poll reconcile (the only place DR-8 bugs live, per roadmap line 110) — are extracted into `src/lib/*` and TDD'd red→green. The component/route are thin glue.

---

#### Step 1 — Failing test: presence formatter (`formatLastSeen` + `isOnline`)

- [ ] Create `src/lib/__tests__/deal-presence.test.ts` with VERBATIM:

```ts
import { describe, it, expect } from "vitest";
import { formatLastSeen, isOnline } from "../deal-presence";

const NOW = new Date("2026-06-04T12:00:00.000Z").getTime();

describe("isOnline", () => {
  it("is true within 60 seconds", () => {
    expect(isOnline(new Date(NOW - 10_000).toISOString(), NOW)).toBe(true);
    expect(isOnline(new Date(NOW - 59_000).toISOString(), NOW)).toBe(true);
  });

  it("is false at or beyond 60 seconds", () => {
    expect(isOnline(new Date(NOW - 60_000).toISOString(), NOW)).toBe(false);
    expect(isOnline(new Date(NOW - 600_000).toISOString(), NOW)).toBe(false);
  });

  it("is false for null", () => {
    expect(isOnline(null, NOW)).toBe(false);
  });
});

describe("formatLastSeen", () => {
  it("returns null when never seen", () => {
    expect(formatLastSeen(null, NOW)).toBe(null);
  });

  it("reads 'смотрит сейчас' under 60s", () => {
    expect(formatLastSeen(new Date(NOW - 20_000).toISOString(), NOW)).toBe(
      "смотрит сейчас"
    );
  });

  it("reads minutes ago", () => {
    expect(formatLastSeen(new Date(NOW - 4 * 60_000).toISOString(), NOW)).toBe(
      "смотрел 4 мин назад"
    );
  });

  it("reads hours ago", () => {
    expect(formatLastSeen(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe(
      "смотрел 3 ч назад"
    );
  });

  it("reads 'вчера' at one day", () => {
    expect(
      formatLastSeen(new Date(NOW - 25 * 3_600_000).toISOString(), NOW)
    ).toBe("смотрел вчера");
  });

  it("reads days ago under a week", () => {
    expect(
      formatLastSeen(new Date(NOW - 3 * 86_400_000).toISOString(), NOW)
    ).toBe("смотрел 3 дн назад");
  });
});
```

- [ ] Run to fail: `npx vitest run src/lib/__tests__/deal-presence.test.ts` → fails (module `../deal-presence` does not exist).

#### Step 2 — Minimal impl: `src/lib/deal-presence.ts`

- [ ] Create `src/lib/deal-presence.ts` with VERBATIM:

```ts
// Pure presence formatting for the Deal Room title-page header. Mirrors
// the dashboard's timeAgo idiom (src/app/dashboard/page.tsx) but lives in
// src/lib so it can be unit-tested (vitest excludes src/app) and takes an
// injectable `now` for deterministic tests. lastSeenAt is a soft, laggy
// signal written on every by-token GET — not a heartbeat — so "online"
// (<60s) is approximate.

const ONLINE_WINDOW_MS = 60_000;

/** True when the participant was last seen within the online window. */
export function isOnline(lastSeenAt: string | null, now: number): boolean {
  if (!lastSeenAt) return false;
  return now - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

/**
 * Editorial presence line for the counterparty, e.g.
 * "смотрит сейчас" / "смотрел 4 мин назад" / "смотрел вчера".
 * Returns null when the link has never been opened.
 */
export function formatLastSeen(lastSeenAt: string | null, now: number): string | null {
  if (!lastSeenAt) return null;
  const diff = now - new Date(lastSeenAt).getTime();
  if (diff < ONLINE_WINDOW_MS) return "смотрит сейчас";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `смотрел ${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `смотрел ${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "смотрел вчера";
  if (days < 7) return `смотрел ${days} дн назад`;
  return "смотрел давно";
}
```

- [ ] Run to pass: `npx vitest run src/lib/__tests__/deal-presence.test.ts` → green.
- [ ] Gate + commit: `npx tsc --noEmit && npm test` →
  `git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Add deal-presence formatter for Deal Room title-page header"`

---

#### Step 3 — Failing test: optimistic-aware merge (`mergeDealClauses`)

The reconcile must NOT blind-replace local state with the poll payload: an in-flight optimistic action (id prefixed `optimistic-`, see `deal-room.tsx:121`) that the server hasn't echoed yet must survive the merge until the server's own row appears. We re-derive each clause status with the existing pure `reconcileClauseStatus` (`src/lib/deal-status.ts`) so the merged clause's status matches what the server will canonicalise to.

- [ ] Create `src/lib/__tests__/deal-merge.test.ts` with VERBATIM:

```ts
import { describe, it, expect } from "vitest";
import { mergeDealClauses, type MergeClause } from "../deal-merge";

const SENDER = "p_sender";
const RECEIVER = "p_receiver";

function clause(
  id: string,
  status: MergeClause["status"],
  actions: MergeClause["actions"]
): MergeClause {
  return { id, status, actions };
}

function action(
  id: string,
  participantId: string,
  kind: string,
  createdAt: string
): MergeClause["actions"][number] {
  return {
    id,
    kind,
    body: null,
    createdAt,
    participant: { id: participantId, role: "RECEIVER", guestName: null },
  };
}

describe("mergeDealClauses", () => {
  it("takes the server clause when there are no optimistic actions", () => {
    const prev = [clause("c1", "PENDING", [])];
    const incoming = [
      clause("c1", "DISPUTED", [
        action("srv1", RECEIVER, "DISAGREE", "2026-06-04T12:00:00.000Z"),
      ]),
    ];
    const merged = mergeDealClauses(prev, incoming, SENDER, RECEIVER);
    expect(merged[0].status).toBe("DISPUTED");
    expect(merged[0].actions.map((a) => a.id)).toEqual(["srv1"]);
  });

  it("preserves an optimistic action the server has not echoed yet", () => {
    const optimistic = action(
      "optimistic-1",
      RECEIVER,
      "AGREE",
      "2026-06-04T12:00:05.000Z"
    );
    const prev = [clause("c1", "PENDING", [optimistic])];
    const incoming = [clause("c1", "PENDING", [])]; // server hasn't seen it
    const merged = mergeDealClauses(prev, incoming, SENDER, RECEIVER);
    expect(merged[0].actions.map((a) => a.id)).toEqual(["optimistic-1"]);
  });

  it("drops the optimistic action once a real server action of same kind from same participant arrives", () => {
    const optimistic = action(
      "optimistic-1",
      RECEIVER,
      "AGREE",
      "2026-06-04T12:00:05.000Z"
    );
    const real = action(
      "srvReal",
      RECEIVER,
      "AGREE",
      "2026-06-04T12:00:06.000Z"
    );
    const prev = [clause("c1", "PENDING", [optimistic])];
    const incoming = [clause("c1", "AGREED", [real])];
    const merged = mergeDealClauses(prev, incoming, SENDER, RECEIVER);
    expect(merged[0].actions.map((a) => a.id)).toEqual(["srvReal"]);
  });

  it("recomputes status from merged actions (sender+receiver AGREE → AGREED)", () => {
    const optimistic = action(
      "optimistic-1",
      RECEIVER,
      "AGREE",
      "2026-06-04T12:00:05.000Z"
    );
    const prev = [
      clause("c1", "PENDING", [
        action("srvS", SENDER, "AGREE", "2026-06-04T11:59:00.000Z"),
        optimistic,
      ]),
    ];
    // Server payload still only shows the sender AGREE.
    const incoming = [
      clause("c1", "PENDING", [
        action("srvS", SENDER, "AGREE", "2026-06-04T11:59:00.000Z"),
      ]),
    ];
    const merged = mergeDealClauses(prev, incoming, SENDER, RECEIVER);
    expect(merged[0].actions.map((a) => a.id)).toEqual(["srvS", "optimistic-1"]);
    expect(merged[0].status).toBe("AGREED");
  });

  it("falls back to the incoming clause when prev has no match", () => {
    const prev: MergeClause[] = [];
    const incoming = [clause("c2", "PENDING", [])];
    const merged = mergeDealClauses(prev, incoming, SENDER, RECEIVER);
    expect(merged.map((c) => c.id)).toEqual(["c2"]);
  });
});
```

- [ ] Run to fail: `npx vitest run src/lib/__tests__/deal-merge.test.ts` → fails (module `../deal-merge` does not exist).

#### Step 4 — Minimal impl: `src/lib/deal-merge.ts`

- [ ] Create `src/lib/deal-merge.ts` with VERBATIM:

```ts
// Reconcile a freshly-polled by-token deal payload against the locally
// held state WITHOUT blind-replacing it. The Deal Room applies actions
// optimistically (synthetic ids prefixed "optimistic-", see deal-room.tsx)
// before the server round-trip. A 4-5s background poll must keep any such
// in-flight action alive until the server's own row appears, otherwise the
// user's just-cast vote visibly flickers away. We carry surviving
// optimistic actions over and re-derive each clause status with the same
// pure reconcileClauseStatus the server uses, so the merged view matches
// what the server will canonicalise to.

import {
  reconcileClauseStatus,
  type ClauseActionInput,
  type ClauseStatus,
} from "./deal-status";

export interface MergeAction {
  id: string;
  kind: string;
  body: string | null;
  createdAt: string;
  participant: {
    id: string;
    role: "SENDER" | "RECEIVER";
    guestName: string | null;
  };
}

export interface MergeClause {
  id: string;
  status: ClauseStatus;
  actions: MergeAction[];
}

const OPTIMISTIC_PREFIX = "optimistic-";

function isOptimistic(action: MergeAction): boolean {
  return action.id.startsWith(OPTIMISTIC_PREFIX);
}

/**
 * Merge the polled (incoming) clauses over the locally-held (prev) clauses,
 * preserving optimistic actions the server has not yet echoed. Generic over
 * the concrete clause shape so the component's richer ClauseView can be
 * passed through unchanged (it structurally extends MergeClause).
 */
export function mergeDealClauses<C extends MergeClause>(
  prev: C[],
  incoming: C[],
  senderId: string,
  receiverId: string
): C[] {
  const prevById = new Map(prev.map((c) => [c.id, c]));

  return incoming.map((serverClause) => {
    const local = prevById.get(serverClause.id);
    if (!local) return serverClause;

    // Keep only optimistic actions that the server hasn't superseded yet:
    // an optimistic action is "settled" once a real (non-optimistic) action
    // of the same kind from the same participant is present in the payload.
    const survivingOptimistic = local.actions.filter((a) => {
      if (!isOptimistic(a)) return false;
      const settled = serverClause.actions.some(
        (s) =>
          !isOptimistic(s) &&
          s.participant.id === a.participant.id &&
          s.kind === a.kind
      );
      return !settled;
    });

    const mergedActions = [...serverClause.actions, ...survivingOptimistic];

    const reconciled: ClauseActionInput[] = mergedActions.map((a) => ({
      participantId: a.participant.id,
      kind: a.kind as ClauseActionInput["kind"],
      createdAt: new Date(a.createdAt),
    }));

    return {
      ...serverClause,
      actions: mergedActions,
      status: reconcileClauseStatus(reconciled, senderId, receiverId),
    };
  });
}
```

- [ ] Run to pass: `npx vitest run src/lib/__tests__/deal-merge.test.ts` → green.
- [ ] Gate + commit: `npx tsc --noEmit && npm test` →
  `git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Add optimistic-aware mergeDealClauses for Deal Room auto-refresh"`

---

#### Step 5 — Route: add `lastSeenAt` to by-token GET payload (UNTESTABLE — `src/app`)

No unit test (route lives under `src/app`, excluded). The `lastSeenAt` column already exists (`schema.prisma:989`) and is already written on every GET (route.ts:77/94/103). Two edits in `src/app/api/deals/by-token/[token]/route.ts`:

- [ ] Edit the `participants.include` to also `select` `lastSeenAt`. Change (route.ts:34):

```ts
        participants: { include: { user: { select: { name: true } } } },
```
to:
```ts
        participants: {
          include: { user: { select: { name: true } } },
        },
```
*(no change needed there — `include` returns scalar columns including `lastSeenAt` by default; the explicit edit below is in the response mapper).*

- [ ] Edit the participants map in the response (route.ts:120-124) from:

```ts
        participants: deal.participants.map((p) => ({
          id: p.id,
          role: p.role,
          name: p.guestName ?? p.user?.name ?? null,
        })),
```
to:
```ts
        participants: deal.participants.map((p) => ({
          id: p.id,
          role: p.role,
          name: p.guestName ?? p.user?.name ?? null,
          // Soft presence signal for the title-page header. Written on
          // every GET (sender + claimed receiver), so it lags by the poll
          // interval — never a heartbeat. Not PII (#50: only name leaks).
          lastSeenAt: p.lastSeenAt ? p.lastSeenAt.toISOString() : null,
        })),
```

- [ ] Manual note: `lastSeenAt` is a `DateTime @default(now())`, never null in DB, but the `?:` guard keeps the type honest and matches the `string | null` the client interface expects. No new PII — only the counterparty's own timestamp, already implied by their actions. Foot-gun #50 unchanged (still no `rawText` / `owner.email` / `recommendedText`).
- [ ] Gate + commit: `npx tsc --noEmit && npm test` →
  `git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Expose participant lastSeenAt on by-token deal payload"`

---

#### Step 6 — Component: presence line + interface field (UNTESTABLE — `src/app`)

No unit test (component under `src/app`). Wire the tested `formatLastSeen`/`isOnline` into `src/app/deal/[token]/deal-room.tsx`. All logic being added here is glue around the two tested cores.

- [ ] Add imports near the top of `deal-room.tsx` (after the existing `buttonClass` import, line 14):

```ts
import { formatLastSeen, isOnline } from "@/lib/deal-presence";
import { mergeDealClauses } from "@/lib/deal-merge";
```

- [ ] Extend the `DealView["participants"]` interface item (lines 22-26) from:

```ts
  participants: Array<{
    id: string;
    role: "SENDER" | "RECEIVER";
    name: string | null;
  }>;
```
to:
```ts
  participants: Array<{
    id: string;
    role: "SENDER" | "RECEIVER";
    name: string | null;
    lastSeenAt: string | null;
  }>;
```

- [ ] In the render body, after the `chipTone` const (line 250) and before `return (`, derive the counterparty presence line. The counterparty is the OTHER role from `myRole`; for an anonymous read-only viewer (`myRole === null`) show the receiver's presence by default:

```ts
  // Counterparty presence — the side the viewer is NOT. Soft signal from
  // lastSeenAt (lags by the poll interval). null when never opened.
  const counterpartyRole: "SENDER" | "RECEIVER" =
    myRole === "RECEIVER" ? "SENDER" : "RECEIVER";
  const counterparty = deal.participants.find(
    (p) => p.role === counterpartyRole
  );
  const presenceNow = Date.now();
  const presenceLabel = formatLastSeen(
    counterparty?.lastSeenAt ?? null,
    presenceNow
  );
  const counterpartyOnline = isOnline(
    counterparty?.lastSeenAt ?? null,
    presenceNow
  );
```

- [ ] Render the presence line inside the title-page `<header>`, immediately after the progress `<p>` block (after deal-room.tsx:305, the `</p>` that closes the italic progress line) and before `</header>`:

```tsx
          {presenceLabel && (
            <p className="mt-2 inline-flex items-center gap-2 text-[11px] italic text-ink-quiet">
              <span
                aria-hidden="true"
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  counterpartyOnline ? "bg-accent" : "bg-ink-quiet/40"
                }`}
              />
              {counterpartyRole === "SENDER" ? "Отправитель" : "Контрагент"}{" "}
              {presenceLabel}
            </p>
          )}
```

- [ ] Gate + commit: `npx tsc --noEmit && npm test` →
  `git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Render counterparty presence line in Deal Room header"`

---

#### Step 7 — Component: visibility-gated auto-refresh, replacing the reload crutch (UNTESTABLE — `src/app`)

No unit test (component). Add a tab-visibility-gated `setInterval` poll (~4.5s, mirroring `ActiveAnalysesStrip`'s polling idiom) that refetches the by-token GET and merges via the tested `mergeDealClauses`. Pause when `status === "AGREED"`. This replaces the `window.location.reload()` crutch in the error path.

- [ ] Add a poll-only fetch callback inside `DealRoom`, immediately after the existing `fetchDeal` `useCallback` (after deal-room.tsx:100). It must NOT clobber `errorState` / `needsIdentify` — it only diffs clauses/status/participants into existing state via the merge:

```tsx
  // Background poll: refetch and MERGE (not blind-replace) so optimistic
  // in-flight actions survive until the server echoes them. Distinct from
  // fetchDeal (which canonicalises after the local user's own action and
  // may surface errors / identify) — the poll stays silent on transient
  // failures and never opens the identify modal.
  const pollDeal = useCallback(async () => {
    try {
      const res = await fetch(`/api/deals/by-token/${token}`, {
        credentials: "include",
      });
      if (!res.ok) return; // stay silent on transient poll failures
      const data = (await res.json()) as DealResponse;
      setDeal((current) => {
        if (!current) return data.deal;
        const senderId =
          current.participants.find((p) => p.role === "SENDER")?.id ?? "";
        const receiverId =
          current.participants.find((p) => p.role === "RECEIVER")?.id ?? "";
        return {
          ...data.deal,
          clauses: mergeDealClauses(
            current.clauses,
            data.deal.clauses,
            senderId,
            receiverId
          ),
        };
      });
    } catch {
      // ignore — next tick retries
    }
  }, [token]);
```

- [ ] Add the visibility-gated interval effect after the existing mount `useEffect` (after deal-room.tsx:104). Gate on `document.visibilityState === "visible"` (deep-include each tick is costly with many idle tabs) and pause once the deal is fully agreed:

```tsx
  // Auto-refresh while the tab is visible and the deal is still open.
  // Pauses on AGREED (nothing more to reconcile) and whenever the tab is
  // hidden (avoids hammering deep-include GETs from background tabs).
  useEffect(() => {
    if (!deal || deal.status === "AGREED") return;
    let handle: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (handle) return;
      handle = setInterval(() => {
        void pollDeal();
      }, 4_500);
    };
    const stop = () => {
      if (handle) {
        clearInterval(handle);
        handle = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [deal, pollDeal]);
```

- [ ] Replace the error-path reload crutch (deal-room.tsx:199-206). The "Обновить" button currently calls `window.location.reload()`; swap it for a silent in-place retry that clears the error and refetches. Change:

```tsx
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`${buttonClass({ variant: "ghost" })} mt-6`}
          >
            Обновить
          </button>
```
to:
```tsx
          <button
            type="button"
            onClick={() => {
              setErrorState(null);
              void fetchDeal();
            }}
            className={`${buttonClass({ variant: "ghost" })} mt-6`}
          >
            Обновить
          </button>
```

- [ ] Sanity: confirm the only remaining `window.location.reload()` in this file is gone (`rg "window.location.reload" "src/app/deal/[token]/deal-room.tsx"` → no matches).
- [ ] Gate + commit: `npx tsc --noEmit && npm test` →
  `git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Auto-refresh Deal Room with visibility-gated poll, drop reload crutch"`

---

#### Acceptance / notes
- TDD'd cores: `formatLastSeen`/`isOnline` (presence) and `mergeDealClauses` (optimistic-aware reconcile) — both pure `src/lib`, full red→green. The route payload field and the component wiring are untestable glue (`src/app` excluded from vitest), kept deliberately thin.
- Foot-guns honored: #50 (by-token GET still leaks only `name` + the counterparty's own timestamp — no `rawText`/`owner.email`/`recommendedText`); #49 (cookie path untouched). Zero AI cost — no `generate()`/`logUsage` touched (#58/#59/#60 N/A).
- Roadmap line 110 risks addressed: reconcile diffs by `optimistic-` prefix (not blind replace); polling is visibility-gated and paused on AGREED; presence is a soft lagged signal (online <60s approximate), not a heartbeat.
- Shared-file coordination: only `deal-room.tsx` overlaps another task (DR-1, lands first). The DR-8 anchors (top-of-component `useCallback`/`useEffect` block; title-page `<header>` progress `<p>`; error-path button) do not collide with DR-1's RECEIVER-only CTA card insertions.
