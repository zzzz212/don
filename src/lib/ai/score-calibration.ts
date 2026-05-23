// Single source of truth for the analyze score / verdict calibration
// table. Both the live LLM path (synthesis fallback when the model fails)
// and the demo path (no API keys) read from this helper, so they can't
// drift from the calibration the prompt embeds.
//
// The table mirrors the one in src/lib/ai/prompts.ts ANALYZE_TEXT — if
// you change one, change both.

export type Verdict = "sign" | "negotiate" | "do_not_sign";

export interface RiskCounts {
  critical: number;
  medium: number;
  low: number;
}

export interface ScoreVerdict {
  score: number;
  verdict: Verdict;
  verdictReason: string;
}

export function scoreAndVerdictFromCounts(counts: RiskCounts): ScoreVerdict {
  const { critical, medium } = counts;

  if (critical >= 2) {
    return {
      score: critical >= 3 ? 1 : 2,
      verdict: "do_not_sign",
      verdictReason:
        "В текущей редакции подписывать нельзя — договор содержит несколько критичных нарушений императивных норм закона.",
    };
  }
  if (critical === 1 && medium >= 3) {
    return {
      score: 3,
      verdict: "do_not_sign",
      verdictReason:
        "В текущей редакции подписывать нельзя — критичное нарушение в сочетании с дисбалансом по нескольким пунктам.",
    };
  }
  if (critical === 1) {
    return {
      score: 4,
      verdict: "negotiate",
      verdictReason:
        "Перед подписанием обязательно устранить критичное нарушение и согласовать правки с контрагентом.",
    };
  }
  if (medium >= 6) {
    return {
      score: 4,
      verdict: "negotiate",
      verdictReason:
        "Слишком много замечаний среднего уровня — без правок подписание создаст значимые правовые риски.",
    };
  }
  if (medium >= 4) {
    return {
      score: medium >= 5 ? 5 : 6,
      verdict: "negotiate",
      verdictReason:
        "Перед подписанием рекомендуется устранить замечания среднего уровня — иначе высок риск неоднозначного толкования.",
    };
  }
  if (medium >= 2) {
    return {
      score: medium === 3 ? 7 : 8,
      verdict: "sign",
      verdictReason:
        "Договор можно подписывать — критичных нарушений не выявлено, есть единичные замечания, которые желательно учесть.",
    };
  }
  return {
    score: medium === 1 ? 9 : 10,
    verdict: "sign",
    verdictReason:
      "Договор можно подписывать без правок — критичных нарушений не выявлено.",
  };
}
