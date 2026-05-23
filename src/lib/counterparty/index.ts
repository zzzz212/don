// Counterparty data orchestrator. Routes a single INN through the provider
// chain: company data (DaData → ЕГРЮЛ → mock), court cases (КАД stub),
// debts (ФССП API → stub). Each layer is a swappable adapter — adding
// api-fns.ru or Контур.Фокус is a single new provider file plus a
// one-line registration.

import { dadataProvider } from "./providers/dadata";
import { egrulProvider } from "./providers/egrul";
import { kadStubProvider } from "./providers/kad";
import { fsspApiProvider } from "./providers/fssp-api";
import { fsspStubProvider } from "./providers/fssp";

import type {
  CompanyData,
  CompanyProvider,
  CourtData,
  CourtProvider,
  DebtData,
  DebtProvider,
} from "./types";

export type {
  CompanyData,
  CompanyProvider,
  CourtData,
  CourtProvider,
  DebtData,
  DebtProvider,
} from "./types";

export { calculateRiskScore } from "./score";
export type { ScoreInput, ScoreResult } from "./score";

// Provider chains. First available wins per call. When you add api-fns.ru
// or Контур, prepend the new provider here and it becomes the primary.
const COMPANY_CHAIN: CompanyProvider[] = [dadataProvider, egrulProvider];
const COURT_CHAIN: CourtProvider[] = [kadStubProvider];
// Real ФССП API first; the stub stays as the fallback for envs without
// an FSSP_AUTH_KEY (and when no company name is available to search by).
const DEBT_CHAIN: DebtProvider[] = [fsspApiProvider, fsspStubProvider];

// Mock fallback for known test INNs — kept for realistic local development
// when no real providers are configured at all.
const MOCK_COMPANY: Record<string, CompanyData> = {
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

export async function fetchCompanyData(inn: string): Promise<CompanyData | null> {
  for (const provider of COMPANY_CHAIN) {
    if (!provider.available) continue;
    try {
      const result = await provider.fetchCompany(inn);
      if (result) return result;
    } catch (e) {
      console.error(`[counterparty] ${provider.name} failed:`, (e as Error).message);
    }
  }
  return MOCK_COMPANY[inn] ?? null;
}

export async function fetchCourtData(inn: string): Promise<CourtData> {
  for (const provider of COURT_CHAIN) {
    if (!provider.available) continue;
    try {
      const result = await provider.fetchCourtCases(inn);
      if (result) return result;
    } catch (e) {
      console.error(`[counterparty] ${provider.name} failed:`, (e as Error).message);
    }
  }
  return { activeLawsuits: 0, completedLawsuits: 0, lossesCount: 0 };
}

export async function fetchDebtData(
  inn: string,
  companyName?: string
): Promise<DebtData> {
  for (const provider of DEBT_CHAIN) {
    if (!provider.available) continue;
    try {
      const result = await provider.fetchDebts(inn, companyName);
      if (result) return result;
    } catch (e) {
      console.error(`[counterparty] ${provider.name} failed:`, (e as Error).message);
    }
  }
  return { found: false, amount: undefined, sources: [] };
}

/** Names of the providers that are currently active — useful for diagnostics. */
export function getActiveProviders(): {
  company: string[];
  court: string[];
  debt: string[];
} {
  return {
    company: COMPANY_CHAIN.filter((p) => p.available).map((p) => p.name),
    court: COURT_CHAIN.filter((p) => p.available).map((p) => p.name),
    debt: DEBT_CHAIN.filter((p) => p.available).map((p) => p.name),
  };
}
