interface EgrulData {
  name: string;
  organizationType?: string;
  registrationDate?: string;
  address?: string;
  okved?: string;
  capitalSize?: number;
  statusCode?: string;
}

interface CourtData {
  activeLawsuits: number;
  completedLawsuits: number;
  lossesCount: number;
}

interface DebtData {
  found: boolean;
  amount?: BigInt;
  sources: string[];
}

// Fetch company data from ЕГРЮЛ (Federal Tax Service)
export async function fetchFromEgrul(inn: string): Promise<EgrulData | null> {
  try {
    const response = await fetch(
      `https://egrul.nalog.ru/api/v1/person/legal?inn=${inn}`,
      { timeout: 5000 }
    );

    if (!response.ok) return null;

    const data = await response.json();

    return {
      name: data.name || "",
      organizationType: data.organizationType,
      registrationDate: data.registrationDate,
      address: data.address,
      okved: data.okved,
      capitalSize: data.capitalSize,
      statusCode: data.statusCode,
    };
  } catch (error) {
    console.error("ЕГРЮЛ fetch error:", error);
    return null;
  }
}

// Mock data for court cases (КАД - Arbitration Courts Database)
export async function fetchCourtData(inn: string): Promise<CourtData> {
  // TODO: Implement actual КАД scraping with Puppeteer/Cheerio
  // For now return mock data
  return {
    activeLawsuits: 0,
    completedLawsuits: 0,
    lossesCount: 0,
  };
}

// Mock data for debts (ФЕДРЕСУРС, ФССП)
export async function fetchDebtData(inn: string): Promise<DebtData> {
  // TODO: Implement actual ФЕДРЕСУРС/ФССП scraping
  // For now return mock data
  return {
    found: false,
    amount: undefined,
    sources: [],
  };
}

// Calculate risk score based on company data
export function calculateRiskScore(data: {
  registrationDate?: string;
  statusCode?: string;
  activeLawsuits: number;
  completedLawsuits: number;
  lossesCount: number;
  debtFound: boolean;
  debtAmount?: BigInt;
}): { score: number; level: string; factors: string[] } {
  let score = 30; // Base neutral score
  const factors: string[] = [];

  // Deduct points for positive factors
  if (data.registrationDate) {
    const regDate = new Date(data.registrationDate);
    const yearsOld = (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

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

  // Add points for negative factors
  if (data.activeLawsuits === 0) {
    score -= 5;
  } else {
    const lawsuitPoints = Math.min(data.activeLawsuits * 5, 20);
    score += lawsuitPoints;
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

  // Clamp score between 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine risk level
  let level = "low";
  if (score > 75) level = "critical";
  else if (score > 50) level = "high";
  else if (score > 25) level = "medium";

  return { score, level, factors };
}
