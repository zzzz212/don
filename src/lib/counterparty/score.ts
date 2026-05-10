// Pure scoring logic — no IO. Same algorithm as the legacy implementation.

export interface ScoreInput {
  registrationDate?: string;
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
  factors: string[];
}

export function calculateRiskScore(data: ScoreInput): ScoreResult {
  let score = 30;
  const factors: string[] = [];

  if (data.registrationDate) {
    const regDate = new Date(data.registrationDate);
    const yearsOld =
      (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

    if (yearsOld > 5) {
      score -= 10;
    } else if (yearsOld < 0.5) {
      score += 15;
      factors.push("registration_recent");
    }
  }

  if (data.statusCode === "активна") {
    score -= 5;
  } else if (
    data.statusCode === "ликвидация" ||
    data.statusCode === "ликвидирована"
  ) {
    score += 30;
    factors.push("liquidation");
  }

  if (data.activeLawsuits === 0) {
    score -= 5;
  } else {
    score += Math.min(data.activeLawsuits * 5, 20);
    factors.push("active_lawsuits");
  }

  if (data.lossesCount > 0) {
    score += Math.min(data.lossesCount * 10, 20);
    factors.push("lost_cases");
  }

  if (!data.debtFound) {
    score -= 10;
  } else {
    score += 15;
    factors.push("debt");
  }

  score = Math.max(0, Math.min(100, score));

  let level: ScoreResult["level"] = "low";
  if (score > 75) level = "critical";
  else if (score > 50) level = "high";
  else if (score > 25) level = "medium";

  return { score, level, factors };
}
