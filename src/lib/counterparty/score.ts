// Pure counterparty risk-scoring logic — no IO.

export interface ScoreInput {
  registrationDate?: string;
  /**
   * Company status. Accepts the raw provider codes — DaData (the primary
   * provider) stores ACTIVE / REORGANIZING / LIQUIDATING / LIQUIDATED /
   * BANKRUPT in `statusCode` — and, defensively, Russian labels (the
   * EGRUL fallback passes the ФНС field through verbatim). See
   * normalizeStatus.
   */
  statusCode?: string;
  activeLawsuits: number;
  completedLawsuits: number;
  lossesCount: number;
  debtFound: boolean;
  debtAmount?: bigint;
}

export interface ScoreResult {
  score: number; // 0-100, higher = riskier
  level: "low" | "medium" | "high" | "critical";
  /** Human-readable Russian risk factors — rendered verbatim in the UI. */
  factors: string[];
}

export type CompanyStatus =
  | "active"
  | "reorganizing"
  | "liquidating"
  | "liquidated"
  | "bankrupt"
  | "unknown";

/**
 * Normalise a company status from whatever a provider hands us into one
 * canonical value. DaData stores the raw upper-case code in `statusCode`;
 * the EGRUL fallback passes the ФНС field through verbatim and may carry
 * a Russian label — both are handled so the score reacts to the status
 * regardless of which provider answered.
 *
 * Order matters in the Russian branch: "ликвидирована" (done) must be
 * matched before "ликвидация" / "ликвидируется" (in progress).
 */
export function normalizeStatus(
  raw: string | null | undefined
): CompanyStatus {
  if (!raw) return "unknown";

  switch (raw.trim().toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "REORGANIZING":
      return "reorganizing";
    case "LIQUIDATING":
      return "liquidating";
    case "LIQUIDATED":
      return "liquidated";
    case "BANKRUPT":
      return "bankrupt";
  }

  const lower = raw.trim().toLowerCase();
  if (lower.includes("банкрот")) return "bankrupt";
  if (lower.includes("ликвидирован")) return "liquidated";
  if (lower.includes("ликвидац") || lower.includes("ликвидир"))
    return "liquidating";
  if (lower.includes("реорганиз")) return "reorganizing";
  if (lower.includes("действ") || lower.includes("активн")) return "active";

  return "unknown";
}

// Per-status risk delta against the baseline. Tuned so that — even
// against the most favourable other factors (an established company
// with no court cases and no debt, i.e. -25 in total) — a liquidating
// company never scores below "high" and a liquidated / bankrupt one
// never below "critical". A status we couldn't read contributes
// nothing rather than a false signal in either direction.
const STATUS_DELTA: Record<CompanyStatus, number> = {
  active: -5,
  unknown: 0,
  reorganizing: 25,
  liquidating: 50,
  liquidated: 75,
  bankrupt: 80,
};

const STATUS_FACTOR: Partial<Record<CompanyStatus, string>> = {
  reorganizing: "Компания в процессе реорганизации",
  liquidating: "Компания в процессе ликвидации",
  liquidated: "Компания ликвидирована",
  bankrupt: "Компания признана банкротом",
};

export function calculateRiskScore(data: ScoreInput): ScoreResult {
  let score = 30;
  const factors: string[] = [];

  if (data.registrationDate) {
    const regDate = new Date(data.registrationDate);
    if (!Number.isNaN(regDate.getTime())) {
      const yearsOld =
        (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (yearsOld > 5) {
        score -= 10;
      } else if (yearsOld < 0.5) {
        score += 15;
        factors.push("Компания зарегистрирована недавно (меньше полугода)");
      }
    }
  }

  const status = normalizeStatus(data.statusCode);
  score += STATUS_DELTA[status];
  const statusFactor = STATUS_FACTOR[status];
  if (statusFactor) factors.push(statusFactor);

  if (data.activeLawsuits === 0) {
    score -= 5;
  } else {
    score += Math.min(data.activeLawsuits * 5, 20);
    factors.push("Есть открытые судебные споры");
  }

  if (data.lossesCount > 0) {
    score += Math.min(data.lossesCount * 10, 20);
    factors.push("Есть проигранные судебные дела");
  }

  if (!data.debtFound) {
    score -= 10;
  } else {
    score += 15;
    factors.push("Найдена задолженность (исполнительные производства)");
  }

  score = Math.max(0, Math.min(100, score));

  let level: ScoreResult["level"] = "low";
  if (score > 75) level = "critical";
  else if (score > 50) level = "high";
  else if (score > 25) level = "medium";

  return { score, level, factors };
}
