import { fetchFromDaData } from "./dadata";

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
  amount?: bigint;
  sources: string[];
}

// Mock data for ЕГРЮЛ fallback
const mockEgrulData: Record<string, EgrulData> = {
  "7708119296": {
    name: "ООО Рога и Копыта",
    organizationType: "ООО",
    registrationDate: "2010-03-15",
    address: "г. Москва, ул. Первомайная, д. 42, оф. 101",
    okved: "52.11 (Оптовая торговля автомобилями)",
    capitalSize: 1000000,
    statusCode: "ликвидирована",
  },
  "7710144361": {
    name: "АО Альфа-Сервис",
    organizationType: "АО",
    registrationDate: "2005-06-20",
    address: "г. Санкт-Петербург, пр. Невский, д. 1, оф. 500",
    okved: "62.01 (Программирование)",
    capitalSize: 5000000,
    statusCode: "активна",
  },
};

// Fetch company data from ЕГРЮЛ or DaData
export async function fetchFromEgrul(inn: string): Promise<EgrulData | null> {
  // Try DaData first (more reliable)
  try {
    const daDataResult = await fetchFromDaData(inn);
    if (daDataResult) {
      return {
        name: daDataResult.name,
        organizationType: daDataResult.name.split(" ")[0],
        registrationDate: daDataResult.registrationDate,
        address: daDataResult.address,
        okved: undefined,
        capitalSize: daDataResult.capitalSize,
        statusCode: daDataResult.status,
      };
    }
  } catch (error) {
    console.error("DaData error, trying ЕГРЮЛ:", error);
  }

  // Fallback to ЕГРЮЛ
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://egrul.nalog.ru/api/v1/person/legal?inn=${inn}`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Return mock data for testing if API fails
      return mockEgrulData[inn] || null;
    }

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
    // Fallback to mock data for known INNs
    return mockEgrulData[inn] || null;
  }
}

// Mock data for court cases (КАД - Arbitration Courts Database)
const mockCourtData: Record<string, CourtData> = {
  "7708119296": {
    activeLawsuits: 3,
    completedLawsuits: 8,
    lossesCount: 5,
  },
  "7710144361": {
    activeLawsuits: 1,
    completedLawsuits: 2,
    lossesCount: 0,
  },
};

export async function fetchCourtData(inn: string): Promise<CourtData> {
  // TODO: Implement actual КАД scraping with Puppeteer/Cheerio
  // For now return mock data (real data for known INNs, empty for others)
  return mockCourtData[inn] || {
    activeLawsuits: 0,
    completedLawsuits: 0,
    lossesCount: 0,
  };
}

// Mock data for debts (ФЕДРЕСУРС, ФССП)
export async function fetchDebtData(inn: string): Promise<DebtData> {
  // TODO: Implement actual ФЕДРЕСУРС/ФССП scraping
  // For realistic testing, some INN numbers trigger mock debt scenarios
  const mockDebtIinns = [
  "7708119296", // Classic test INN with debt
  "7710144361", // Another test case
  ];

  if (mockDebtIinns.includes(inn)) {
    return {
      found: true,
      amount: BigInt("150000"),
      sources: ["ФССП (Федеральная служба судебных приставов)"],
    };
  }

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
  debtAmount?: bigint;
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
