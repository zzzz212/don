# Sprint 14 Design Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close six design completion gaps in Sprint 14 (editorial alignment of SendAsDeal + dashboard, Counter-AI prompt restoration, Deal Room UX polish) without expanding scope into Sprint 15.

**Architecture:** Twelve tasks in dependency order. Counter-AI prompt restoration first (isolated change, smoke-testable before UI work touches anything). Then editorial alignment in three small commits (modal, dashboard, leaks). Then UX upgrades that share `deal-room.tsx` (reconcileClauseStatus extraction → optimistic UI → perspective chip → loading skeleton → error states → misclick guard). End with full verification.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind 4 (warm-minimalism tokens — `paper-grain`, `border-rule`, `text-ink-quiet`, serif) / motion/react v12 / Anthropic Claude (analyze system prompt) / Prisma / Vitest 4 / Source Serif 4 + Geist.

**Spec reference:** [`docs/superpowers/specs/2026-05-24-sprint-14-design-completion.md`](../specs/2026-05-24-sprint-14-design-completion.md)

---

## File map

**Create:**
- `src/lib/deal-status.ts` — extract pure `reconcileClauseStatus` + types into a Prisma-free, client-safe module
- `src/app/deal/[token]/clause-skeleton.tsx` — editorial loading skeleton for clauses

**Modify:**
- `src/lib/ai/prompts.ts` — add inline `counterPerspective` bullet in `═══ ВЫХОДНЫЕ ДАННЫЕ ═══`
- `src/lib/deals.ts` — re-export `reconcileClauseStatus` from `./deal-status` (zero-invasion bc back-compat)
- `src/components/send-as-deal.tsx` — full rewrite to editorial style
- `src/app/dashboard/page.tsx` — editorial Active Deals list + `lastSeenAt` formatting + sentinel dot + Sprint 14 leak fix
- `src/app/page.tsx` — Sprint 14 leak fix + remove audit-trail bullet
- `src/app/deal/[token]/clause-card.tsx` — empty-`theirSide` fallback + misclick guard
- `src/app/deal/[token]/deal-room.tsx` — optimistic UI + perspective chip + loading skeleton mount + specific error states

**Tests touched:**
- `src/lib/__tests__/deals.test.ts` — unchanged (re-export keeps imports green)
- `src/lib/__tests__/analyze-schema.test.ts` — unchanged (positive `counterPerspective` tests already exist)

---

## Task 1: Restore Counter-AI prompt inline

**Why first:** isolated change. If it regresses prod analyze (foot-gun #47 history), a single revert is clean. Everything UI-side after this depends on the field actually being populated.

**Files:**
- Modify: `src/lib/ai/prompts.ts` — bullet list in `═══ ВЫХОДНЫЕ ДАННЫЕ ═══`, after the `legalReference` line, before `missingClauses`

- [ ] **Step 1: Confirm existing positive tests still cover the schema**

Read `src/lib/__tests__/analyze-schema.test.ts`. Verify these three tests exist (they do as of 2026-05-24 — coverage is sufficient, do NOT add duplicates):
- `"accepts a risk with counterPerspective"` (lines 62-72)
- `"accepts counterPerspective without compromise (optional inside optional)"` (lines 74-81)
- `"rejects counterPerspective without theirGain"` (lines 83-97)

No new tests needed at the schema level.

- [ ] **Step 2: Run existing analyze-schema tests to confirm baseline green**

Run: `npx vitest run src/lib/__tests__/analyze-schema.test.ts`
Expected: all tests PASS (7 tests as of baseline).

- [ ] **Step 3: Modify the analyze prompt — add inline `counterPerspective` bullet**

In `src/lib/ai/prompts.ts`, find the bullet starting `- В risks[].legalReference: точная статья…` (around line 62 in the `ANALYZE_BASE` constant). Add a new bullet immediately AFTER `legalReference` and BEFORE `missingClauses`:

```
- В risks[].counterPerspective (необязательно): объект с двумя полями. theirGain — одно предложение в свободной форме о том, что от этого пункта получает другая сторона договора (выгода или защита). compromise (опционально, пропусти если очевидного компромисса нет) — одна формулировка-компромисс, которая ослабляет риск для клиента и одновременно сохраняет разумную часть выгоды другой стороны. Не используй JSON-синтаксис в ответе для этого описания — заполни эти поля как обычные строковые свойства внутри объекта риска.
```

Critical: this bullet is **inline prose**, embedded in the same `- В risks[]…` series. **DO NOT** add a separate `ПРИМЕР:` block with `{ ... }` JSON elsewhere in the prompt — that pattern is what caused the foot-gun #51 regression where Opus 4.7 copied the example as its full top-level response (see `prompts.ts:70-79` NOTE comment).

- [ ] **Step 4: Also remove the obsolete NOTE comment**

In `src/lib/ai/prompts.ts`, find the multi-line comment block starting `// NOTE: A Counter-AI instruction block…` (lines 70-79). Delete the entire NOTE block — it documented a removed feature that we're restoring. The bullet itself is now self-documenting (it states "Не используй JSON-синтаксис").

- [ ] **Step 5: Run analyze-schema tests again to confirm prompt change didn't accidentally break anything**

Run: `npx vitest run src/lib/__tests__/analyze-schema.test.ts`
Expected: all tests PASS (still 7).

- [ ] **Step 6: Run full test suite to confirm no other breakage**

Run: `npm test`
Expected: 417 tests PASS (no regressions).

- [ ] **Step 7: Manual local smoke test** (BLOCKING — do not skip)

Local env needs `ANTHROPIC_API_KEY`, `DATABASE_URL`, `AUTH_SECRET` set.

```bash
npm run dev
```

In another terminal or browser:
1. Open http://localhost:3000, log in.
2. Upload a moderately complex contract (any договор with 4+ clauses — NDA, аренда, услуги).
3. Wait for analyze to complete (~30-60s).
4. In the Prisma Studio or Neon SQL editor, query:
   ```sql
   SELECT risks FROM "Analysis" ORDER BY "createdAt" DESC LIMIT 1;
   ```
5. Parse the `risks` JSON field. Confirm at LEAST 30% of the risks have `counterPerspective.theirGain` populated. (Not all risks will have a sensible "other side" — that's expected; the field is optional.)
6. Open the analysed document's `/report/[id]` page. Click "Отправить второй стороне" → create a Deal → open `/deal/[token]` → verify the right-hand "Другая сторона" column shows real text under at least one clause.

If smoke fails:
- If analyze 500's: check the Vercel/local logs for zod error. Likely the prompt change confused the model into wrapping the response again. Revert this commit and re-evaluate the bullet wording.
- If `counterPerspective` is null on every risk: model didn't honor the instruction. Try wording variations, but stay inline (no top-level JSON example).

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/prompts.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Restore Counter-AI prompt instruction inline (no top-level JSON example)

The original Sprint 14 attempt used an isolated `ПРИМЕР: { "counterPerspective": { ... } }`
JSON block near the end of the system prompt. Opus 4.7 copied the example as
its full top-level response, breaking all analyze runs on prod (foot-gun #47/#51).

This restoration embeds the field in the existing `- В risks[]…` bullet series
in flat prose, with an explicit "Не используй JSON-синтаксис" guard inside the
bullet. Defensive `isResultWrapper` unwrap (foot-gun #47) and `z.coerce.number()`
score guard (foot-gun #48) remain intact. Schema stays .optional() so old
analyses continue to parse.

Smoke-tested locally: analyze succeeds, ≥30% of risks return a populated
counterPerspective.theirGain, Deal Room right-hand column shows real text.
EOF
)"
```

---

## Task 2: Counter-AI empty-state fallback in clause card

**Why next:** complements Task 1 — old analyses (created before Task 1 deploys) will never have `counterPerspective`, so the right column would otherwise be visually empty. This fallback explains why.

**Files:**
- Modify: `src/app/deal/[token]/clause-card.tsx:108-147` (the `<aside>` block)

- [ ] **Step 1: Read the current `<aside>` block to understand the structure**

Open `src/app/deal/[token]/clause-card.tsx`. Lines 108-147 contain:
```tsx
<aside className="space-y-4 md:border-l md:border-rule md:pl-7 text-[13px] leading-[1.6]">
  {clause.yourSide && ( ... )}
  {clause.theirSide && ( ... )}
</aside>
```

When both `yourSide` and `theirSide` are null (rare but possible), `<aside>` renders empty. When only `theirSide` is null (the common case for pre-Task-1 deals), the column has yourSide but no Counter-AI.

- [ ] **Step 2: Add the fallback inside `<aside>`, after the `theirSide` block**

In `src/app/deal/[token]/clause-card.tsx`, find the closing `)}` of the `{clause.theirSide && ( ... )}` block (around line 146) and immediately before the closing `</aside>` tag (line 147), insert:

```tsx
{!clause.theirSide && clause.yourSide && (
  <p className="italic text-[12px] leading-[1.5] text-ink-quiet/70">
    Counter-AI не сформирован для этого договора. Запустите повторный
    анализ, чтобы получить позицию другой стороны.
  </p>
)}
```

Note the `&& clause.yourSide` guard — if both are null, we don't show anything (the clause has no risk-level content at all, the document column carries the load).

- [ ] **Step 3: Manual visual check**

If still running `npm run dev` from Task 1, refresh `/deal/[token]` for an OLD deal (one created before Task 1 deployed — or just create a deal from a doc whose analyze ran before Task 1). The right column should now show the italic ink-quiet fallback under each clause whose `theirSide` is null.

For a new deal (Task 1's smoke deal), the fallback should NOT appear because `theirSide` is populated.

- [ ] **Step 4: Run tests to confirm no regression**

Run: `npm test`
Expected: 417 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/deal/[token]/clause-card.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Add Counter-AI fallback when theirSide is null on a clause

Old analyses (created before the Counter-AI prompt restoration) and any future
risk where the model legitimately couldn't infer the other side leave
DealClause.theirSide null. Without a fallback, the right-hand "Другая сторона"
column was visually empty — readers couldn't tell whether the feature was
broken or simply not generated for this contract.

The ink-quiet italic note explains the gap and points at the remedy (rerun the
analysis). No CTA button — re-analyze flow has invariants (how to migrate
existing clause actions to new clauses) that belong to Sprint 15 deal-reuse
work, not here.
EOF
)"
```

---

## Task 3: Rewrite SendAsDeal modal in editorial style

**Why now:** this modal is the SENDER's entry point to the Deal Room flow. It currently uses Sprint 12-era product tokens (`rounded-xl`, `border-border`, `bg-card-hover`, `text-muted`, `ring-primary/20`) that clash with the editorial Deal Room they're about to enter.

**Files:**
- Modify: `src/components/send-as-deal.tsx` — full rewrite of the component body

- [ ] **Step 1: Replace the entire component body**

Open `src/components/send-as-deal.tsx`. Replace the entire file content with:

```tsx
"use client";

// "Send as Deal" — opens the Deal Room flow from /report. Editorial
// styling matches IdentifyModal and the Deal Room itself: paper-grain
// card, hairline rules, bottom-border inputs, no jewel-tone accents.
// Foot-gun #43: fixed bg-black/60 scrim, never bg-foreground/40.

import { useState } from "react";
import { Button, buttonClass } from "@/components/button";

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
    try {
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string })?.error ?? "Не удалось создать сделку"
        );
        return;
      }
      const data = (await res.json()) as { url: string };
      setResult({ url: data.url });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-md px-4 py-6 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Отправить договор второй стороне"
        onClick={(e) => e.stopPropagation()}
        className="paper-grain flex w-full max-w-md flex-col rounded-2xl border border-rule bg-card p-8 shadow-xl"
      >
        {result ? (
          /* ── Success state ─────────────────────────────────────── */
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-ink-quiet">
              Письмо отправлено
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
              Сделка создана
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-quiet">
              Контрагент получит письмо со ссылкой. Если хотите — скопируйте
              её и передайте напрямую.
            </p>
            <div className="mt-6 border border-rule bg-surface/40 px-4 py-3 font-mono text-[12px] leading-[1.5] text-foreground/80 break-all rounded-md">
              {result.url}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(result.url);
                }}
                className={buttonClass({ variant: "primary" })}
              >
                Скопировать ссылку
              </button>
              <button
                type="button"
                onClick={onClose}
                className={buttonClass({ variant: "ghost" })}
              >
                Закрыть
              </button>
            </div>
          </div>
        ) : (
          /* ── Form state ────────────────────────────────────────── */
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-ink-quiet">
              Прежде чем отправить
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
              Отправить второй стороне
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-quiet">
              Контрагент откроет договор без регистрации, увидит ваш разбор
              и сможет согласовать пункты или предложить правки.
            </p>

            <div className="mt-6">
              <label
                htmlFor="deal-counterparty-email"
                className="block text-[10px] uppercase tracking-[0.22em] text-ink-quiet mb-1.5"
              >
                Email контрагента
              </label>
              <input
                id="deal-counterparty-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="counterparty@example.com"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                className="w-full border-0 border-b border-rule bg-transparent px-0 py-2 text-foreground placeholder:text-ink-quiet/50 focus:border-primary focus:outline-none focus:ring-0 transition-colors"
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="deal-counterparty-name"
                className="block text-[10px] uppercase tracking-[0.22em] text-ink-quiet mb-1.5"
              >
                Имя контрагента — необязательно
              </label>
              <input
                id="deal-counterparty-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иван Иванов"
                className="w-full border-0 border-b border-rule bg-transparent px-0 py-2 text-foreground placeholder:text-ink-quiet/50 focus:border-primary focus:outline-none focus:ring-0 transition-colors"
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="deal-message"
                className="block text-[10px] uppercase tracking-[0.22em] text-ink-quiet mb-1.5"
              >
                Сообщение — необязательно
              </label>
              <textarea
                id="deal-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Направляю договор на согласование. Просьба ознакомиться."
                className="w-full resize-y border-0 border-b border-rule bg-transparent px-0 py-2 text-foreground placeholder:text-ink-quiet/50 focus:border-primary focus:outline-none focus:ring-0 transition-colors"
              />
            </div>

            {error && (
              <p className="mt-4 text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <Button
              variant="primary"
              loading={submitting}
              onClick={() => void submit()}
              disabled={!email.trim() || submitting}
              className="mt-6 w-full"
            >
              {submitting ? "Отправляем…" : "Отправить"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

Key changes from the previous version:
- Removed `Handshake`, `X`, `Send`, `Loader2`, `Check` icon imports (no header chrome — eyebrow + serif h2 carries the gesture).
- Container is `paper-grain rounded-2xl border border-rule bg-card` (matches IdentifyModal).
- Removed the inner header band with close icon — the scrim click closes the modal, no need for a chrome X button (matches IdentifyModal behaviour).
- Labels are uppercase tracking eyebrows above the input (not boxed below `<span>` siblings).
- Inputs are bottom-border-only (`border-b border-rule bg-transparent`), no `ring-primary/20` focus glow.
- Success state uses serif h2 + eyebrow + mono URL block in a hairline-bordered cream slab; no green check circle.
- Submit button is `<Button variant="primary" loading={...}>`, not a bespoke `<button>` with custom gradient.

- [ ] **Step 2: Run type check + tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: 417 tests PASS.

- [ ] **Step 3: Manual visual check**

With `npm run dev` running, navigate to `/report/[id]` for any analysed document. Open the overflow menu, click "Отправить второй стороне". Visually compare to `IdentifyModal` (shown on `/deal/[token]` first-visit). Both should feel like the same design language: serif heading, ink-quiet eyebrow, hairline-bottom inputs, paper-grain card.

Test the success state by sending a real (or noop-mocked) email — verify the cream URL block and two-button row render correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/send-as-deal.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Rewrite SendAsDeal modal in editorial style to match IdentifyModal

The sender's entry point into the Deal Room flow used Sprint 12-era product
tokens (rounded-xl, border-border, bg-card-hover, text-muted, ring-primary/20)
while the Deal Room they enter immediately after uses warm-minimalism
editorial tokens (paper-grain, border-rule, bottom-border inputs, serif). The
tonal switch read as a hand-off between two unrelated products.

Modal is now paper-grain card, hairline rules, bottom-border inputs with
uppercase tracking eyebrow labels, serif h2 heading, eyebrow above it. Success
state replaces the green-check circle with a mono URL slab in a hairline
border. Submit button is the standard <Button variant="primary"> primitive.
Removed icon imports and inner chrome — scrim-click close matches IdentifyModal.
EOF
)"
```

---

## Task 4: Editorial Dashboard Active Deals list + lastSeenAt

**Why now:** the empty-state below this list already uses editorial tokens (`paper-grain`, `border-rule`, `text-ink-quiet`) — the list above it sticks out.

**Files:**
- Modify: `src/app/dashboard/page.tsx:298-329` (Active Deals section)
- The `relativeTime` helper at lines 59-68 of the same file is reused (no new import).

- [ ] **Step 1: Verify the API already returns `lastSeenAt`**

Quick read: `src/app/api/deals/route.ts:143-146` — the `GET` handler selects `guestName, guestEmail, lastSeenAt` on the RECEIVER participant. The TypeScript shape on the client side (`ActiveDealItem.receiver`) needs to include `lastSeenAt`.

- [ ] **Step 2: Update the `ActiveDealItem` interface to include `lastSeenAt`**

In `src/app/dashboard/page.tsx`, find the `interface ActiveDealItem` block (around lines 47-56). The `receiver` field needs a `lastSeenAt`. Update to:

```ts
interface ActiveDealItem {
  id: string;
  title: string;
  status: string;
  inviteToken: string;
  clauseCount: number;
  receiver: {
    guestName: string | null;
    guestEmail: string | null;
    lastSeenAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}
```

(If the field is already there, fine — leave it.)

- [ ] **Step 3: Add the `receiverLine` + `sentinelTone` helpers above the component**

In `src/app/dashboard/page.tsx`, above the main `DashboardContent` component definition (around line 70, right after the `ActiveDealItem` interface), add:

```ts
function receiverLine(receiver: ActiveDealItem["receiver"]): string {
  if (!receiver?.lastSeenAt) return "Ссылка ещё не открыта";
  const name = receiver.guestName ?? "гость";
  return `${name} · открыто ${relativeTime(receiver.lastSeenAt)}`;
}

function sentinelTone(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "bg-primary"; // terracotta — needs attention
  const seenMs = new Date(lastSeenAt).getTime();
  const ageHours = (Date.now() - seenMs) / 3_600_000;
  if (ageHours < 24) return "bg-success"; // sage — active dialogue
  return "bg-foreground/30"; // neutral — opened but quiet
}
```

`relativeTime` is already in the same file (lines 59-68) — no import needed.

- [ ] **Step 4: Rewrite the Active Deals list block**

In `src/app/dashboard/page.tsx`, replace the entire `{!loading && activeDeals.length > 0 && ( ... )}` section (currently around lines 298-329) with:

```tsx
{!loading && activeDeals.length > 0 && (
  <section>
    <p className="text-[10px] uppercase tracking-[0.22em] text-ink-quiet">
      Активные сделки
    </p>
    <h2 className="mt-1 mb-4 font-serif text-xl font-semibold tracking-tight text-foreground">
      Идут согласования
    </h2>
    <ul className="space-y-2">
      {activeDeals.map((d) => (
        <li
          key={d.id}
          className="flex items-center gap-4 rounded-xl border border-rule bg-card px-5 py-3.5 transition-colors hover:bg-card/80"
        >
          <span
            aria-hidden="true"
            className={`mt-2 h-1.5 w-1.5 shrink-0 self-start rounded-full ${sentinelTone(
              d.receiver?.lastSeenAt
            )}`}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-foreground">
              {d.title}
            </div>
            <div className="mt-0.5 text-xs text-ink-quiet">
              {receiverLine(d.receiver)} ·{" "}
              {d.clauseCount}{" "}
              {d.clauseCount === 1
                ? "пункт"
                : d.clauseCount < 5
                  ? "пункта"
                  : "пунктов"}
            </div>
          </div>
          <Link
            href={`/deal/${d.inviteToken}`}
            className="ml-auto shrink-0 text-sm font-semibold text-foreground transition-colors hover:text-primary underline-offset-4 hover:underline"
          >
            Открыть →
          </Link>
        </li>
      ))}
    </ul>
  </section>
)}
```

Key changes:
- Section gains an uppercase eyebrow above the serif h2 (matches editorial header pattern used elsewhere in dashboard).
- `border border-border bg-card hover:bg-card-hover` → `border border-rule bg-card hover:bg-card/80`.
- `text-muted` → `text-ink-quiet`.
- Added sentinel dot (`sentinelTone(d.receiver?.lastSeenAt)`) before the title — terracotta when not opened, sage when active, neutral when quiet.
- Sub-line uses `receiverLine` helper (real `lastSeenAt` formatting, not "ожидает открытия" placeholder).
- CTA shifted to `text-foreground hover:text-primary` with `underline-offset-4 hover:underline` — terracotta is the hover state, not the default (editorial cue).

- [ ] **Step 5: Run type check + tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: 417 tests PASS.

- [ ] **Step 6: Manual visual check**

With `npm run dev` running, hit `/dashboard`:
- If you have ZERO active deals → editorial empty-state still shows (unchanged) with the bespoke illustration.
- If you have at least one ACTIVE deal → the list now shows editorial rows with sentinel dots and real `lastSeenAt` strings.

Create a fresh deal you don't open → sentinel should be terracotta + "Ссылка ещё не открыта". Open it in an incognito → refresh dashboard → sentinel turns sage + "гость · открыто X мин назад".

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/page.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Editorial Dashboard Active Deals list + sentinel dot + lastSeenAt formatting

The list above the empty-state was the last Sprint 12-era survivor in the
Active Deals section — border-border, bg-card-hover, text-muted, all clashing
with the editorial empty-state right below it (paper-grain, border-rule,
ink-quiet). Same section, two design languages.

List now: hairline border-rule rows, ink-quiet meta, eyebrow + serif h2,
foreground→primary hover-underline CTA (no permanent terracotta on the link).
Each row gains a 6px sentinel dot — terracotta when "ссылка ещё не открыта",
sage when the receiver was active within 24h, neutral after that. lastSeenAt
is formatted through the existing relativeTime helper (no new dep).

Closes one of six Sprint 14 design completion gaps.
EOF
)"
```

---

## Task 5: Remove "Sprint 14" leaks and audit-trail bullet

**Why now:** trivial change, no shared surface area with anything else. Better to land as its own commit than mix with the dashboard editorial work.

**Files:**
- Modify: `src/app/page.tsx:269` and the audit-trail bullet block around `:302-310`
- Modify: `src/app/dashboard/page.tsx:339`

- [ ] **Step 1: Replace "Sprint 14 · Deal Room" eyebrow on landing**

In `src/app/page.tsx`, find the line:
```tsx
                Sprint 14 · Deal Room
```
Replace with:
```tsx
                Новинка · Deal Room
```

- [ ] **Step 2: Remove the "Аудит-трейл" bullet from the landing band**

In `src/app/page.tsx`, find the `<ul>` inside the Deal Room band (around lines 282-312). It currently has three `<li>` items: "Получатель без логина", "Counter-AI", "Аудит-трейл". Delete the third `<li>` block entirely:

```tsx
<li className="flex gap-3">
  <span aria-hidden className="mt-2 inline-block h-px w-4 bg-foreground/40 shrink-0" />
  <span>
    <strong className="font-semibold text-foreground">
      Аудит-трейл —
    </strong>{" "}
    кто что отметил и когда, для всех пунктов. Готов к
    подписанию когда оба согласовали.
  </span>
</li>
```

The `<ul>` now contains exactly two `<li>` items.

- [ ] **Step 3: Replace "Sprint 14 · Deal Room" eyebrow on dashboard empty-state**

In `src/app/dashboard/page.tsx`, find the line:
```tsx
                  Sprint 14 · Deal Room
```
Replace with:
```tsx
                  Новинка · Deal Room
```

- [ ] **Step 4: Sanity-check no other "Sprint 14" leaks remain in user-facing code**

Run this grep:
```bash
```

Then via the Grep tool (NOT bash grep, per project conventions):

Grep pattern: `Sprint 14`, glob: `src/app/**/*.tsx`, output_mode: `content`

Expected: NO matches in `src/app/**/*.tsx`. (Matches in `docs/**` or comments inside `src/lib/**` are fine — those are internal documentation, not user-visible.)

- [ ] **Step 5: Run type check + tests + visual smoke**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: 417 tests PASS.

Visual: open `/` — Deal Room band shows "Новинка · Deal Room" eyebrow and exactly two bullets (no "Аудит-трейл"). Open `/dashboard` with no active deals — empty-state eyebrow shows "Новинка · Deal Room".

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/dashboard/page.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Drop "Sprint 14" eyebrow leaks and false-advertising audit-trail bullet

Two user-facing eyebrows on the landing Deal Room band and the dashboard
empty-state read "Sprint 14 · Deal Room". Internal product-management
naming was leaking into marketing copy — replaced with "Новинка · Deal Room".

The landing band's third bullet promised an audit-trail ("кто что отметил
и когда, готов к подписанию когда оба согласовали") that is explicitly
deferred to Sprint 16 in the Deal Room spec. Removed the bullet — the
remaining two (anonymous receiver + Counter-AI) accurately describe what
the product actually does today.
EOF
)"
```

---

## Task 6: Extract `reconcileClauseStatus` to client-safe module

**Why now:** Task 7 (optimistic UI) needs to call `reconcileClauseStatus` from the client to predict the new clause status without a round-trip. Currently it lives in `src/lib/deals.ts` next to `import { prisma } from "./db"` — that import poisons the entire module for client bundles.

**Files:**
- Create: `src/lib/deal-status.ts` — pure function + types, zero Prisma/Node imports
- Modify: `src/lib/deals.ts` — delete the local copy, re-export from `./deal-status`
- Tests: `src/lib/__tests__/deals.test.ts` — unchanged (`deals` re-exports, imports stay green)

- [ ] **Step 1: Create the new module**

Create `src/lib/deal-status.ts` with:

```ts
// Pure clause-status reconciliation logic, extracted from src/lib/deals.ts
// so the client bundle can import it without dragging in Prisma. Used by
// the Deal Room optimistic UI to predict the new status of a clause
// immediately after a local agree/disagree action, before the server
// round-trip canonicalises everything.
//
// Rule: take each participant's most recent AGREE/DISAGREE (ignoring
// COMMENT and PROPOSE_EDIT actions). If both AGREE → AGREED. If at least
// one DISAGREE → DISPUTED. Otherwise → PENDING.

export interface ClauseActionInput {
  participantId: string;
  kind: "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT";
  createdAt: Date;
}

export type ClauseStatus = "PENDING" | "AGREED" | "DISPUTED" | "RESOLVED";

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

This is a verbatim copy of the function currently in `src/lib/deals.ts:11-48` with only the JSDoc comment slightly rewritten.

- [ ] **Step 2: Delete the duplicates in `src/lib/deals.ts` and add a re-export**

In `src/lib/deals.ts`, delete lines 11-48 (the `ClauseActionInput` interface, `ClauseStatus` type, and `reconcileClauseStatus` function). Replace them with a single re-export at the top of the file (right after the `randomBytes` import block and the `generateInviteToken` function):

```ts
export {
  reconcileClauseStatus,
  type ClauseActionInput,
  type ClauseStatus,
} from "./deal-status";
```

The rest of `src/lib/deals.ts` (Prisma imports, `createDealFromDocument`, etc.) is untouched.

- [ ] **Step 3: Run tests to confirm the re-export keeps existing imports green**

Run: `npx vitest run src/lib/__tests__/deals.test.ts`
Expected: 7 tests PASS (the 5 `reconcileClauseStatus` tests + 2 `generateInviteToken` tests).

- [ ] **Step 4: Run full test suite + type check**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: 417 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deal-status.ts src/lib/deals.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Extract reconcileClauseStatus into client-safe src/lib/deal-status.ts

The pure function lived in src/lib/deals.ts next to `import { prisma } from
"./db"`. The Prisma import poisons the whole module for client bundles —
importing reconcileClauseStatus from a "use client" component would drag
Prisma in and either bloat the bundle or fail to compile. Pulled the pure
helper + its two types into a Prisma-free module so the Deal Room optimistic
UI (next commit) can import it from the client.

src/lib/deals.ts now re-exports from ./deal-status, keeping existing imports
in deals.test.ts and the API routes unchanged.
EOF
)"
```

---

## Task 7: Optimistic UI in DealRoom

**Why now:** Tasks 1, 2, 6 are prerequisites — Counter-AI populated, fallback in place, `reconcileClauseStatus` reachable from the client.

**Files:**
- Modify: `src/app/deal/[token]/deal-room.tsx` — restructure `onAction`

- [ ] **Step 1: Read the current `onAction` to understand the shape**

Open `src/app/deal/[token]/deal-room.tsx:62-86`. Currently:
```tsx
const onAction = useCallback(
  async (clauseId, kind, body) => {
    const url = ...;
    const res = await fetch(url, ...);
    if (!res.ok) { setError(...); return; }
    await fetchDeal();
  },
  ...
);
```

It does a full re-fetch after every action. We want: optimistic local mutation → POST → on success refetch to canonicalise → on failure rollback.

- [ ] **Step 2: Add the necessary imports**

In `src/app/deal/[token]/deal-room.tsx`, at the top with the existing imports, add:

```ts
import {
  reconcileClauseStatus,
  type ClauseActionInput,
} from "@/lib/deal-status";
```

- [ ] **Step 3: Rewrite `onAction` to be optimistic**

Replace the `onAction` callback (lines 62-86 currently) with:

```tsx
const onAction = useCallback(
  async (
    clauseId: string,
    kind: "AGREE" | "DISAGREE" | "COMMENT",
    body?: string
  ) => {
    if (!deal || !myParticipantId) return;

    // Snapshot before any mutation so we can rollback on POST failure.
    const snapshot = deal;

    // Build the synthetic action — same shape the server will produce
    // when we refetch. Optimistic id is prefixed so it can't collide
    // with real cuids.
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      kind,
      body: body ?? null,
      createdAt: new Date().toISOString(),
      participant: {
        id: myParticipantId,
        role: myRole ?? "RECEIVER",
        guestName: null,
      },
    };

    // Identify SENDER + RECEIVER ids for status reconciliation.
    const senderId =
      deal.participants.find((p) => p.role === "SENDER")?.id ?? "";
    const receiverId =
      deal.participants.find((p) => p.role === "RECEIVER")?.id ?? "";

    // Mutate the deal locally — append the synthetic action and
    // recompute the clause status.
    setDeal({
      ...deal,
      clauses: deal.clauses.map((c) => {
        if (c.id !== clauseId) return c;
        const newActions = [...c.actions, optimistic];
        // reconcileClauseStatus takes ClauseActionInput[] (participantId,
        // kind, createdAt). Map the rich action shape into that.
        const reconciled: ClauseActionInput[] = newActions.map((a) => ({
          participantId: a.participant.id,
          kind: a.kind as ClauseActionInput["kind"],
          createdAt: new Date(a.createdAt),
        }));
        return {
          ...c,
          actions: newActions,
          status: reconcileClauseStatus(reconciled, senderId, receiverId),
        };
      }),
    });

    // POST in the background.
    const url =
      myRole === "SENDER"
        ? `/api/deals/${deal.id}/clauses/${clauseId}/actions`
        : `/api/deals/by-token/${token}/clauses/${clauseId}/actions`;
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, body }),
    });

    if (!res.ok) {
      // Rollback to pre-mutation state, surface the error.
      setDeal(snapshot);
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data?.error ?? "Не удалось сохранить действие");
      return;
    }

    // Server accepted — canonicalise (timestamps, ids, etc.).
    await fetchDeal();
  },
  [deal, myParticipantId, myRole, token, fetchDeal]
);
```

Note: the snapshot/restore pattern is the simplest correct approach for a single-action flow. If two `onAction` calls overlap (rare — user mashing buttons), the second's snapshot captures the first's optimistic mutation; rollback unwinds back to the second's snapshot, which is mid-flight state. In practice the `fetchDeal()` after each success canonicalises, so divergence is bounded to single-action latency. Don't reach for a queue/lock here — YAGNI.

- [ ] **Step 4: Run type check + tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: 417 tests PASS.

- [ ] **Step 5: Manual UX smoke**

With `npm run dev` running, open a `/deal/[token]` in incognito (RECEIVER perspective), identify yourself, then click AGREE on a clause:
- Expected: the AGREE button visually fills (primary variant) IMMEDIATELY (no wait for network).
- Expected: within ~200-500ms, `fetchDeal` finishes and replaces the optimistic action's `id` with the real cuid.

To test rollback path: in DevTools Network tab, set the `/api/deals/by-token/.../actions` endpoint to "Block request URL". Click AGREE — the button should briefly highlight, then revert when the blocked request fails. Error message should appear.

- [ ] **Step 6: Commit**

```bash
git add src/app/deal/[token]/deal-room.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Optimistic UI for agree/disagree/comment in Deal Room

Previously the action handler awaited fetchDeal() after every POST — visual
feedback for a single click was gated by the full deal refetch (200-1500ms
depending on connection). On the deliberately-slow path (anonymous receiver
in Russia → Vercel edge → Neon US-East), this felt broken on every click.

Action handler now snapshots local state, applies the predicted clause status
locally via reconcileClauseStatus (imported from the client-safe module
extracted in the previous commit), POSTs in the background, and either
canonicalises via fetchDeal on success or restores the snapshot on failure.

The synthetic action carries an `optimistic-${ts}` id that can't collide
with the server's cuids — it gets replaced when the canonical fetch lands.
EOF
)"
```

---

## Task 8: Perspective chip in Deal Room header

**Why now:** small additive change, sits in the same file we just touched, doesn't share concerns.

**Files:**
- Modify: `src/app/deal/[token]/deal-room.tsx` — title-page header block (around lines 122-164)

- [ ] **Step 1: Compute the chip label in the render body**

In `src/app/deal/[token]/deal-room.tsx`, find the `return (` of the `DealRoom` component (around line 119, after the loading/error short-circuits). Just before the `return (`, add:

```tsx
const me = myParticipantId
  ? deal.participants.find((p) => p.id === myParticipantId)
  : null;
const chipLabel: string | null =
  myRole === "SENDER"
    ? "Вы — отправитель"
    : myRole === "RECEIVER"
      ? me?.name
        ? `Открыто как ${me.name} (получатель)`
        : "Открыто как гость"
      : null;
const chipTone =
  myRole === "SENDER" ? "bg-primary" : "bg-accent"; // sage for receiver
```

- [ ] **Step 2: Render the chip in the title-page header**

In the same file, find the `<header className="border-b border-rule pb-8 mb-12">` block (around line 123). Immediately after the existing `<p className="text-[11px] uppercase tracking-[0.28em] text-ink-quiet">Переговоры по договору</p>` line, add:

```tsx
{chipLabel && (
  <p className="mt-2 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary">
    <span
      aria-hidden="true"
      className={`inline-block h-1.5 w-1.5 rounded-full ${chipTone}`}
    />
    {chipLabel}
  </p>
)}
```

Visual: tiny dot + uppercase tracked text, terracotta for sender, sage for receiver. Sits just under the "Переговоры по договору" eyebrow, before the contract title h1.

- [ ] **Step 3: Run type check + tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: 417 tests PASS.

- [ ] **Step 4: Manual visual check**

- Sender view (logged in as deal owner): open `/deal/[token]`. Header should show "Переговоры по договору" + below it terracotta-dot chip "Вы — отправитель".
- Receiver view, before identify: open in incognito. Header should show terracotta-eyebrow "Переговоры по договору" + sage-dot chip "Открыто как гость". The identify modal will pop on first action.
- Receiver view, after identify: identify yourself as "Илья", refresh. Chip should change to "Открыто как Илья (получатель)".

- [ ] **Step 5: Commit**

```bash
git add src/app/deal/[token]/deal-room.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Add perspective chip to Deal Room title-page header

Previously the title page didn't communicate which side of the deal the
viewer was on. Sender opening the deal saw the same chrome as the receiver
opening it — no visual cue for "this is your perspective" or "you're viewing
as the counterparty". Now: small editorial chip under the eyebrow, terracotta
dot + "Вы — отправитель" for the SENDER, sage dot + "Открыто как X
(получатель)" or "Открыто как гость" for the RECEIVER.

Hidden when myRole is null (other anonymous viewer beyond the one claimed
receiver slot — the read-only path described in by-token route's invariant
comment).
EOF
)"
```

---

## Task 9: Loading skeleton for Deal Room

**Why now:** same file, additive.

**Files:**
- Create: `src/app/deal/[token]/clause-skeleton.tsx`
- Modify: `src/app/deal/[token]/deal-room.tsx` — replace the bare-spinner loading branch (around lines 98-107)

- [ ] **Step 1: Create the skeleton component**

Create `src/app/deal/[token]/clause-skeleton.tsx` with:

```tsx
// Editorial loading skeleton for a clause card. Structure mirrors
// ClauseCard so the page doesn't reflow when real data lands. Uses the
// shared shimmer-sweep primitive (src/components/skeleton.tsx) — that
// keyframe is already defined in globals.css and respects
// prefers-reduced-motion.

import { Skeleton } from "@/components/skeleton";

export function ClauseSkeleton() {
  return (
    <article className="border-l-2 border-l-rule pl-5 sm:pl-7">
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-[1.4fr_1fr]">
        {/* Document column */}
        <div>
          <div className="flex items-baseline gap-3">
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
        {/* Counter-AI column */}
        <aside className="space-y-4 md:border-l md:border-rule md:pl-7">
          <div>
            <Skeleton className="h-2.5 w-24" />
            <div className="mt-2 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </div>
          <div>
            <Skeleton className="h-2.5 w-28" />
            <div className="mt-2 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Replace the loading branch in DealRoom**

In `src/app/deal/[token]/deal-room.tsx`, find the loading branch (currently around lines 98-107):
```tsx
if (!deal) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-ink-quiet">
        Открываем договор
      </p>
    </div>
  );
}
```

Replace with:

```tsx
if (!deal) {
  return (
    <main className="paper-grain mx-auto max-w-5xl px-5 pt-8 sm:px-10">
      <header className="border-b border-rule pb-8 mb-12">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-8 w-3/4" />
        <Skeleton className="mt-6 h-3 w-1/2" />
      </header>
      <div className="space-y-10">
        {[0, 1, 2].map((i) => (
          <ClauseSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Add the two new imports**

At the top of `src/app/deal/[token]/deal-room.tsx`, add:

```ts
import { Skeleton } from "@/components/skeleton";
import { ClauseSkeleton } from "./clause-skeleton";
```

Also remove the now-unused `Loader2` import (was `import { Loader2 } from "lucide-react";` on line 5).

- [ ] **Step 4: Run type check + tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: 417 tests PASS.

- [ ] **Step 5: Manual visual check**

With `npm run dev` running, throttle DevTools Network to "Slow 3G", refresh `/deal/[token]`. Should see editorial skeleton (title page placeholder + 3 stub clauses) instead of bare spinner. Real content swaps in smoothly when fetch completes — no layout shift since skeleton mimics the structure.

- [ ] **Step 6: Commit**

```bash
git add src/app/deal/[token]/clause-skeleton.tsx src/app/deal/[token]/deal-room.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Replace bare-spinner loading with editorial clause skeleton

The previous loading state was a single Loader2 spinner — readable on a
fast connection where it flashed for 100ms, but on the cold-Neon-cold-Vercel
path the receiver could stare at "Открываем договор" for 2-3 seconds.
Skeleton clauses give a much stronger sense of "the page is loading
clauses" and avoid the layout shift when real content lands (skeleton
mirrors ClauseCard structure exactly).

Uses the existing shared Skeleton primitive which already has the
shimmer-sweep keyframe in globals.css and prefers-reduced-motion respect.
EOF
)"
```

---

## Task 10: Specific error states in Deal Room

**Why now:** same file, finishes the loading/error story.

**Files:**
- Modify: `src/app/deal/[token]/deal-room.tsx` — refactor the error block

- [ ] **Step 1: Update the error state shape and `fetchDeal` to capture status code**

In `src/app/deal/[token]/deal-room.tsx`:

1. Find the `useState` for error (currently `const [error, setError] = useState<string | null>(null);`). Replace with:

```tsx
const [errorState, setErrorState] = useState<{
  code: number;
  title: string;
  body: string;
  recoverable: boolean;
} | null>(null);
```

2. In `fetchDeal`, find the `if (!res.ok)` block. Replace with:

```tsx
if (!res.ok) {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  setErrorState(errorMessageFor(res.status, data?.error));
  return;
}
```

3. In the `onAction` failure path, replace `setError(data?.error ?? "Не удалось сохранить действие");` with:

```tsx
setErrorState(errorMessageFor(res.status, data?.error));
```

4. Above the component (right after the type definitions, around line 28), add the helper:

```tsx
function errorMessageFor(
  code: number,
  serverMessage?: string
): {
  code: number;
  title: string;
  body: string;
  recoverable: boolean;
} {
  if (code === 404 || code === 410) {
    return {
      code,
      title: "Ссылка устарела или удалена",
      body: "Свяжитесь с отправителем — он перевыпустит приглашение.",
      recoverable: false,
    };
  }
  if (code === 429) {
    return {
      code,
      title: "Слишком много действий подряд",
      body: "Подождите минуту и попробуйте снова.",
      recoverable: true,
    };
  }
  return {
    code,
    title: "Не удалось открыть",
    body: serverMessage ?? "Попробуйте обновить страницу.",
    recoverable: true,
  };
}
```

- [ ] **Step 2: Replace the error render block**

Find the current error short-circuit (around line 88):
```tsx
if (error) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-serif text-2xl font-semibold text-foreground">
        Не удалось открыть
      </p>
      <p className="mt-2 text-sm text-ink-quiet">{error}</p>
    </div>
  );
}
```

Replace with:

```tsx
if (errorState) {
  return (
    <main className="mx-auto max-w-md px-5 py-24 text-center sm:px-10">
      <p className="text-[10px] uppercase tracking-[0.28em] text-ink-quiet">
        Что-то не так
      </p>
      <p className="mt-3 font-serif text-2xl font-semibold tracking-tight text-foreground">
        {errorState.title}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-quiet">
        {errorState.body}
      </p>
      {errorState.recoverable && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`${buttonClass({ variant: "ghost" })} mt-6`}
        >
          Обновить
        </button>
      )}
    </main>
  );
}
```

Add the `buttonClass` import at the top:

```ts
import { buttonClass } from "@/components/button";
```

- [ ] **Step 3: Run type check + tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: 417 tests PASS.

- [ ] **Step 4: Manual smoke**

- Hit `/deal/000000000000000000000000000000000000000000000000` (48 zeros — valid format, certainly doesn't exist) → should show editorial 404 page with "Ссылка устарела или удалена", no "Обновить" button.
- Hit `/deal/` 60+ times rapidly to trip the rate limit (60/min per token) → 429 page with "Слишком много действий подряд" + "Обновить" button.

- [ ] **Step 5: Commit**

```bash
git add src/app/deal/[token]/deal-room.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Map Deal Room error states to specific editorial messages

The previous error state was a single generic "Не удалось открыть" with the
raw server message underneath. A receiver landing on a deleted-link
inviteToken couldn't tell whether they should reload, retry, or ask the
sender for a new invite — all paths looked identical.

Errors now map by HTTP status:
- 404/410 → "Ссылка устарела или удалена" with explanation to contact the
  sender. No reload button — reload won't help.
- 429 → "Слишком много действий подряд" with a 60-second cooldown hint and
  a reload button (which will work after the wait).
- Other → "Не удалось открыть" with the server message as fallback body and
  a reload button.

All three render with the same editorial chrome — eyebrow + serif h2 +
ink-quiet body — so the failure mode visually belongs to the Deal Room
rather than feeling like a generic Next.js error.
EOF
)"
```

---

## Task 11: Misclick guard on agree/disagree

**Why now:** smallest change, finishes the Deal Room polish list.

**Files:**
- Modify: `src/app/deal/[token]/clause-card.tsx:155-178` — AGREE/DISAGREE buttons

- [ ] **Step 1: Add `disabled` + `aria-pressed` to the AGREE button**

In `src/app/deal/[token]/clause-card.tsx`, find the AGREE button (around lines 155-166). Currently:

```tsx
<button
  type="button"
  onClick={() => void onAction(clause.id, "AGREE")}
  className={
    lastVote === "AGREE"
      ? buttonClass({ variant: "primary", size: "sm" })
      : buttonClass({ variant: "ghost", size: "sm" })
  }
>
  <Check className="h-3.5 w-3.5" aria-hidden="true" />
  Согласен
</button>
```

Replace with:

```tsx
<button
  type="button"
  onClick={() => void onAction(clause.id, "AGREE")}
  disabled={lastVote === "AGREE"}
  aria-pressed={lastVote === "AGREE"}
  className={
    lastVote === "AGREE"
      ? `${buttonClass({ variant: "primary", size: "sm" })} cursor-default opacity-90`
      : buttonClass({ variant: "ghost", size: "sm" })
  }
>
  <Check className="h-3.5 w-3.5" aria-hidden="true" />
  Согласен
</button>
```

- [ ] **Step 2: Do the same for the DISAGREE button**

A few lines below (around 167-178), replace:

```tsx
<button
  type="button"
  onClick={() => void onAction(clause.id, "DISAGREE")}
  className={
    lastVote === "DISAGREE"
      ? buttonClass({ variant: "primary", size: "sm" })
      : buttonClass({ variant: "ghost", size: "sm" })
  }
>
  <X className="h-3.5 w-3.5" aria-hidden="true" />
  Не согласен
</button>
```

With:

```tsx
<button
  type="button"
  onClick={() => void onAction(clause.id, "DISAGREE")}
  disabled={lastVote === "DISAGREE"}
  aria-pressed={lastVote === "DISAGREE"}
  className={
    lastVote === "DISAGREE"
      ? `${buttonClass({ variant: "primary", size: "sm" })} cursor-default opacity-90`
      : buttonClass({ variant: "ghost", size: "sm" })
  }
>
  <X className="h-3.5 w-3.5" aria-hidden="true" />
  Не согласен
</button>
```

Note: `opacity-90 cursor-default` is the disabled-state visual. Other disabled buttons in the app use `opacity-50`, but the pressed-state needs to look like a confirmed choice (not a faded one). `opacity-90` is a gentle nudge — "this is your active choice, click the other if you want to change it."

- [ ] **Step 3: Run type check + tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: 417 tests PASS.

- [ ] **Step 4: Manual UX smoke**

Open `/deal/[token]` as receiver, click AGREE on a clause. Button fills primary. Click AGREE again — nothing should happen (button disabled, network not called, no duplicate ClauseAction). Click DISAGREE — should switch (vote changes). Click AGREE again — switches back.

To verify network not called on the no-op re-click: open DevTools Network tab, click AGREE → see one POST to `/api/deals/by-token/.../actions`. Click AGREE again → NO new POST.

- [ ] **Step 5: Commit**

```bash
git add src/app/deal/[token]/clause-card.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "$(cat <<'EOF'
Disable the already-selected vote button to prevent duplicate actions

A clause's last vote was rendered as a primary-variant button while other
votes stayed ghost-variant — but the primary button was still clickable. A
user who AGREE'd then re-clicked AGREE minted a duplicate ClauseAction row
(reconcileClauseStatus correctly took the latest, so status was unchanged,
but the actions list grew with no-op rows).

Now the active vote button has disabled + aria-pressed=true and opacity-90
cursor-default styling. AGREE→DISAGREE and DISAGREE→AGREE still work — only
the no-op same-vote re-click is blocked. Matches standard radio-group
behaviour without forcing the user into a single-select dropdown.
EOF
)"
```

---

## Task 12: Full verification before PR

**Why last:** validates the whole stack, catches anything missed by per-task local checks.

**Files:** none modified (or one trivial doc commit at the end).

- [ ] **Step 1: Static gate — TypeScript compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Static gate — unit tests**

Run: `npm test`
Expected: 417 tests PASS, 0 fail, 0 skip-added.

- [ ] **Step 3: Static gate — production build**

This requires `DATABASE_URL` and `AUTH_SECRET` env vars to be set (build-time only — placeholder values are fine for the build itself):

```bash
DATABASE_URL="postgresql://x:y@localhost:5432/db" AUTH_SECRET="build-check-only-not-a-real-secret" npx next build
```

Note: on Windows PowerShell the env-var syntax is `$env:DATABASE_URL="..."; $env:AUTH_SECRET="..."; npx next build`. The `next build` itself may try to connect to the DB via `db push` in the build script — if you don't want that, run just the Next build directly:

```bash
DATABASE_URL="postgresql://x:y@localhost:5432/db" AUTH_SECRET="build-check-only" npx next build
```

Expected: build completes, no errors, no new warnings about Next 16 deprecations.

- [ ] **Step 4: Manual smoke — landing**

Open `/`:
- Eyebrow shows "Новинка · Deal Room" (NOT "Sprint 14").
- Deal Room band has exactly TWO `<li>` bullets (no "Аудит-трейл" third).

- [ ] **Step 5: Manual smoke — dashboard**

Open `/dashboard` with no active deals:
- Empty-state eyebrow shows "Новинка · Deal Room".

Create a deal (via `/report/[id]` → Отправить второй стороне). Return to `/dashboard`:
- Active Deals list shows editorial rows: hairline border, ink-quiet meta, sentinel dot (terracotta — "Ссылка ещё не открыта").

Open the deal in incognito → identify → refresh dashboard:
- Sentinel turns sage, meta shows "имя · открыто X мин назад".

- [ ] **Step 6: Manual smoke — SendAsDeal modal**

On `/report/[id]`, click "Отправить второй стороне":
- Editorial card (paper-grain, hairline border, no chrome header).
- Inputs are bottom-border only.
- Submit a deal — success state shows mono URL slab + two-button row.

Visually compare side-by-side with `/deal/[token]` first-visit IdentifyModal — both modals should feel like the same design.

- [ ] **Step 7: Manual smoke — Deal Room (both perspectives)**

As SENDER (logged in, owner): open `/deal/[token]`:
- Header: eyebrow + terracotta-dot chip "Вы — отправитель" + serif title.
- Counter-AI column populated (new deal from Task 1 smoke).

As RECEIVER (incognito): open `/deal/[token]`:
- Header: eyebrow + sage-dot chip "Открыто как гость" → after identify "Открыто как Илья (получатель)".
- Click AGREE → INSTANT visual feedback (no spinner wait).
- Click AGREE again → no-op (button disabled).
- Click DISAGREE → switches to disagree.

Throttle network to "Slow 3G", refresh /deal/[token]:
- Editorial skeleton (title placeholder + 3 stub clauses) renders.

Hit `/deal/000000000000000000000000000000000000000000000000`:
- Editorial 404 ("Ссылка устарела или удалена") with no reload button.

- [ ] **Step 8: Manual smoke — Counter-AI in production data**

Find the most recent analyzed document in Prisma Studio / Neon SQL:
```sql
SELECT
  COUNT(*) AS total_risks,
  COUNT(CASE WHEN risks::jsonb @? '$[*].counterPerspective.theirGain' THEN 1 END) AS with_counter_ai
FROM (
  SELECT jsonb_array_elements(risks::jsonb) AS risk
  FROM "Analysis"
  WHERE "createdAt" > NOW() - INTERVAL '1 hour'
) sub;
```

(Or just visually inspect the latest analysis's `risks` JSON.)

Expected: at least 30% of risks have `counterPerspective.theirGain` populated.

- [ ] **Step 9: Commit verification note (optional)**

If you want a paper-trail commit:

```bash
git commit --allow-empty -m "$(cat <<'EOF'
verify: Sprint 14 design completion — all 12 tasks pass

Static gates green: tsc --noEmit, npm test (417 pass), next build.

Manual smoke:
- Landing eyebrow "Новинка · Deal Room", audit-trail bullet removed.
- Dashboard empty-state + active-deals list both editorial; sentinel dot +
  lastSeenAt formatting working.
- SendAsDeal modal visually matches IdentifyModal.
- Deal Room: perspective chip both sides, optimistic agree/disagree instant,
  misclick disabled, skeleton on slow conn, 404 specific error state.
- Counter-AI populated on freshly-analyzed docs (>30% of risks).

Ready for PR review.
EOF
)"
```

- [ ] **Step 10: Update CLAUDE.md "Свежее в голове" section**

This step belongs to the `superpowers:finishing-a-development-branch` skill when we close the branch. NOT done as part of this plan — the plan ends here, and the user will decide whether to merge or continue iterating.

---

## Acceptance criteria mapping

Each spec acceptance criterion is covered by:

| # | Criterion | Task(s) |
|---|---|---|
| 1 | Editorial consistency: no `border-border`/`bg-card-hover`/`text-muted`/`ring-primary/20` on Sprint 14 path | T3, T4 |
| 2 | Counter-AI populated in prod analyses ≥ 50% | T1 |
| 3 | Empty-state fallback visible for old deals | T2 |
| 4 | Optimistic UI feedback < 100ms, rollback on failure | T6, T7 |
| 5 | Perspective chip correct in all three view modes | T8 |
| 6 | Loading skeleton instead of bare spinner | T9 |
| 7 | Specific 404/429 error states | T10 |
| 8 | Misclick guard on same-vote re-click | T11 |
| 9 | Dashboard sentinel + lastSeenAt | T4 |
| 10 | "Sprint 14" leak removed | T5 |
| 11 | "Аудит-трейл" bullet removed | T5 |
| 12 | tsc/test/build green | T12 |

## Self-review

- [x] **Spec coverage**: all 12 acceptance criteria mapped above. All 6 dyy from spec context closed (T1 Counter-AI, T2 fallback, T3 SendAsDeal modal, T4 dashboard list+lastSeenAt, T5 leaks+bullet, T6-T11 UX upgrades, T12 verification).
- [x] **Placeholder scan**: no TBD/TODO. All code blocks contain actual code. No "similar to Task N" references — each task is self-contained.
- [x] **Type consistency**: `ClauseActionInput.kind` is the same union in `deal-status.ts` (T6) and `deal-room.tsx` (T7). `errorMessageFor` return shape matches `errorState` state shape (T10). `myRole` typed `"SENDER" | "RECEIVER" | null` consistently across DealRoom file. `sentinelTone` and `receiverLine` parameter types match `ActiveDealItem.receiver` shape (T4).
