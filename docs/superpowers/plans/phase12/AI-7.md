### Task AI-7: Apply-fix telemetry — fire `analyze.applyfix_unavailable` on the paraphrase null branch (no fuzzy fallback)

**Files**
- create: _(none)_
- modify: `src/lib/ai/quote-verify.ts`, `src/lib/ai/__tests__/quote-verify.test.ts`, `src/lib/analytics/server.ts`, `src/lib/ai/analyze.ts`
- test: `src/lib/ai/__tests__/quote-verify.test.ts`

**Grounding (verified against current code)**
- `findVerbatimQuote(contractText, quote)` (`src/lib/ai/quote-verify.ts:52-70`) returns `null` on two branches: the noise-guard (`needle.length < MIN_QUOTE_LENGTH`, line 59) and the real paraphrase miss (`normalized.indexOf(needle) < 0`, line 63). It only receives two strings — it has **no** `level`/`clauseTitle` to report.
- `verifyRiskQuotes(contractText, risks)` (`:74-87`) is the seam that actually decides apply-fix availability per risk and **does** have the full `AnalysisRisk` (with `.level` and `.clauseTitle`). The "unavailable" condition is exactly `snapped === null` (a paraphrase the snapper couldn't recover). The existing skip-guard `quote.trim().length < MIN_QUOTE_LENGTH` (line 80) is a placeholder/empty-cite skip, **not** an apply-fix degradation — do not fire there.
- `EventName` is a closed TS union (`src/lib/analytics/server.ts:65-97`); a new event name must be added or `tsc` fails. `captureEvent` is fire-and-forget, never throws (`:113-130`).
- `captureEvent` imports `posthog-node` lazily + `@/lib/telemetry`. **It must NOT be imported into the pure `quote-verify.ts`** or the unit test pulls in PostHog. Use dependency injection: `verifyRiskQuotes` gains an optional `onUnavailable` callback; `analyze.ts` (`:58`, already a `src/lib` module and the only production caller) wires it to `captureEvent`. The DI hook is unit-tested in `quote-verify.test.ts`; the one-line `analyze.ts` wiring is thin glue with no separate test (per `src/app`-style constraint logic — the glue carries no branching).
- `AnalysisRisk.level` is `"critical" | "medium" | "low"`; `AnalysisRisk.clauseTitle` is `string` (`src/lib/ai/schemas/analyze.ts:24-26`). No controlled `contractType` exists → use `level`/`clauseTitle` only.
- **NO fuzzy fallback** (foot-gun #13): apply-fix is a global replace-all in `report/[id]/page.tsx`; a wrong/non-unique anchor corrupts every occurrence. This task ships the telemetry half ONLY.

**Shared-file note:** `src/lib/analytics/server.ts` is also touched by **DR-2** (adds deal-funnel event names to the same `EventName` union). Both tasks append distinct string literals to the union — sequence them (or land AI-7 first) to avoid a merge conflict on the union block.

---

- [ ] **Step 1 — Failing test: the `onUnavailable` hook fires on a paraphrased (non-matching) quote.**
  Append a new `describe` block to `src/lib/ai/__tests__/quote-verify.test.ts`. The existing `risk(originalText)` helper at the top of the file already produces a valid `AnalysisRisk` with `clauseTitle: "Тест"` and `level: "medium"` — reuse it. Paste verbatim at the end of the file (after the closing `});` of the `verifyRiskQuotes` block on line 87):

  ```ts
  describe("verifyRiskQuotes — apply-fix telemetry hook", () => {
    it("calls onUnavailable with level + clauseTitle when a quote is paraphrased", () => {
      const calls: { level: string; clauseTitle: string }[] = [];
      const para = "Арендатор платит аренду до пятого числа месяца";
      verifyRiskQuotes(CONTRACT, [risk(para)], (info) => calls.push(info));
      expect(calls).toEqual([{ level: "medium", clauseTitle: "Тест" }]);
    });

    it("does not call onUnavailable when the quote is recovered (whitespace-only mismatch)", () => {
      const calls: unknown[] = [];
      const recoverable =
        "Арендатор обязан вносить арендную плату не позднее 5-го числа каждого месяца.";
      verifyRiskQuotes(CONTRACT, [risk(recoverable)], () => calls.push(1));
      expect(calls).toHaveLength(0);
    });

    it("does not call onUnavailable when the quote already appears verbatim", () => {
      const calls: unknown[] = [];
      const exact =
        "Арендодатель вправе в одностороннем порядке расторгнуть договор.";
      verifyRiskQuotes(CONTRACT, [risk(exact)], () => calls.push(1));
      expect(calls).toHaveLength(0);
    });

    it("does not call onUnavailable for a too-short placeholder cite (skip-guard, not degradation)", () => {
      const calls: unknown[] = [];
      verifyRiskQuotes(CONTRACT, [risk("—")], () => calls.push(1));
      expect(calls).toHaveLength(0);
    });

    it("works without a callback (back-compatible signature)", () => {
      const recoverable =
        "Арендатор обязан вносить арендную плату не позднее 5-го числа каждого месяца.";
      const [out] = verifyRiskQuotes(CONTRACT, [risk(recoverable)]);
      expect(CONTRACT.includes(out.originalText)).toBe(true);
    });
  });
  ```

- [ ] **Step 2 — Run to fail.**
  ```
  npx vitest run src/lib/ai/__tests__/quote-verify.test.ts
  ```
  Expected: the new block fails (the 3-arg call is a type/arity error and `onUnavailable` is never invoked) while the existing 5 tests still pass.

- [ ] **Step 3 — Minimal impl: add an optional `onUnavailable` hook to `verifyRiskQuotes`.**
  In `src/lib/ai/quote-verify.ts`, replace the entire `verifyRiskQuotes` function (lines 72-87) with the version below. Only `verifyRiskQuotes` changes — `findVerbatimQuote`, `normalizeWithMap`, `collapse`, and `MIN_QUOTE_LENGTH` are untouched. The callback fires exactly when a quote long enough to be a real cite could not be snapped (`snapped === null`) — i.e. the model paraphrased and apply-fix will be silently disabled.

  ```ts
  /** Telemetry hook: invoked once per risk whose quote is long enough to
   *  be a real citation but could not be located in the contract — the
   *  apply-fix button will be silently disabled for it. Injected (not
   *  imported) so this module stays pure and unit-testable without
   *  pulling in the PostHog client. */
  export type ApplyFixUnavailable = (info: {
    level: AnalysisRisk["level"];
    clauseTitle: string;
  }) => void;

  /** Repair `originalText` on each risk so the report's apply-fix can
   *  match it. Risks whose quote can't be located are returned unchanged.
   *  When `onUnavailable` is provided, it fires for each such paraphrased
   *  cite (whitespace-recoverable and already-verbatim quotes never fire). */
  export function verifyRiskQuotes(
    contractText: string,
    risks: AnalysisRisk[],
    onUnavailable?: ApplyFixUnavailable
  ): AnalysisRisk[] {
    return risks.map((risk) => {
      const quote = risk.originalText;
      // Empty / placeholder cites ("—", "Пункт отсутствует") are skipped,
      // not reported: there was never a real anchor to apply against, so
      // this is not a degradation of the apply-fix feature.
      if (!quote || quote.trim().length < MIN_QUOTE_LENGTH) return risk;
      const snapped = findVerbatimQuote(contractText, quote);
      if (snapped === null) {
        // The model paraphrased a real clause — apply-fix is now disabled
        // for this risk with no other signal (4xx never reach Sentry).
        onUnavailable?.({ level: risk.level, clauseTitle: risk.clauseTitle });
        return risk;
      }
      if (snapped !== quote) {
        return { ...risk, originalText: snapped };
      }
      return risk;
    });
  }
  ```

- [ ] **Step 4 — Run to pass.**
  ```
  npx vitest run src/lib/ai/__tests__/quote-verify.test.ts
  ```
  Expected: all 10 tests pass (5 original + 5 new). If "does not call onUnavailable for a too-short placeholder cite" fails, confirm the skip-guard `quote.trim().length < MIN_QUOTE_LENGTH` returns **before** `findVerbatimQuote`.

- [ ] **Step 5 — Extend the `EventName` union with the new event.**
  In `src/lib/analytics/server.ts`, add the literal under the "Document analysis" group. Replace lines 71-75:
  ```ts
    // Document analysis
    | "analysis_started"
    | "analysis_completed"
    | "analysis_failed"
    | "ocr_used"
  ```
  with:
  ```ts
    // Document analysis
    | "analysis_started"
    | "analysis_completed"
    | "analysis_failed"
    | "ocr_used"
    // Apply-fix observability: a risk cite was paraphrased so the report's
    // apply-fix button is silently disabled (no fuzzy fallback by design,
    // foot-gun #13). Lets us trend headline-feature degradation that 4xx
    // Sentry filtering hides.
    | "analyze.applyfix_unavailable"
  ```

- [ ] **Step 6 — Wire `captureEvent` into the production caller (thin glue, no new unit test).**
  This step writes to `src/lib/ai/analyze.ts` — a `src/lib` module, but the wiring is a one-line fire-and-forget with no branching, so its correctness is already covered by the Step-1 hook tests. In `src/lib/ai/analyze.ts`:

  6a. Add the import after the existing `verifyRiskQuotes` import (line 21):
  ```ts
  import { captureEvent } from "@/lib/analytics/server";
  ```

  6b. Replace the single return on line 58:
  ```ts
    return { ...result, risks: verifyRiskQuotes(contractText, result.risks) };
  ```
  with:
  ```ts
    return {
      ...result,
      risks: verifyRiskQuotes(contractText, result.risks, ({ level, clauseTitle }) => {
        // Fire-and-forget: a recovered quote stays usable, a paraphrased
        // one silently disables apply-fix — track the trend (PII-free:
        // only the risk level and the clause's own title flow through).
        void captureEvent({
          userId,
          event: "analyze.applyfix_unavailable",
          properties: { level, clauseTitle },
          orgId,
        });
      }),
    };
  ```
  Note: `userId` and `orgId` are the `analyzeContract` params already in scope (`:36-37`); `captureEvent` accepts `userId: string | null` and `orgId?: string | null` so passing them as-is is correct. No `email`/PII keys are passed (foot-gun #26 — `clauseTitle` is contract-clause text, not user PII; `level` is categorical).

- [ ] **Step 7 — Full gate.**
  ```
  npx tsc --noEmit
  npm test
  ```
  Expected: clean `tsc` (the new `EventName` literal makes the `captureEvent` call type-check) and the full suite green (existing count + 5 new quote-verify tests). If `tsc` flags `analyze.applyfix_unavailable` as not assignable, re-check Step 5 added the literal to the exported `EventName` union (not a local copy).

- [ ] **Step 8 — Commit.**
  ```
  git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -am "Track apply-fix unavailability when a risk cite is paraphrased

verifyRiskQuotes already silently drops the apply-fix button whenever the
model paraphrases a clause instead of quoting it verbatim — the snapper
can only recover whitespace mismatches. That degradation is invisible:
4xx never reach Sentry, so the patched-DOCX headline feature can rot
after any prompt/model bump with no signal.

Add an injected onUnavailable hook fired on the paraphrase null branch
(carrying only level + clauseTitle, PII-free) and wire it to a
fire-and-forget captureEvent in analyzeContract. The hook is injected
rather than imported so quote-verify stays pure and unit-testable.

No fuzzy fallback: apply-fix is a global replace-all, so a wrong or
non-unique anchor would corrupt every occurrence (foot-gun #13) — this
is the telemetry half only.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```
