// Backward-compatible facade over src/lib/counterparty/. Existing routes that
// import from "@/lib/counterparty" keep working unchanged. New code should
// import from "@/lib/counterparty/index" directly for the provider-aware API.

import {
  fetchCompanyData,
  fetchCourtData as fetchCourtDataInternal,
  fetchDebtData as fetchDebtDataInternal,
  calculateRiskScore as calculateRiskScoreInternal,
  type CompanyData,
  type CourtData,
  type DebtData,
} from "./counterparty/index";

export type EgrulData = {
  name: string;
  organizationType?: string;
  registrationDate?: string;
  address?: string;
  okved?: string;
  capitalSize?: number;
  statusCode?: string;
};

export async function fetchFromEgrul(inn: string): Promise<EgrulData | null> {
  const data: CompanyData | null = await fetchCompanyData(inn);
  if (!data) return null;
  return {
    name: data.name,
    organizationType: data.organizationType,
    registrationDate: data.registrationDate,
    address: data.address,
    okved: data.okved,
    capitalSize: data.capitalSize,
    statusCode: data.statusCode,
  };
}

export async function fetchCourtData(inn: string): Promise<CourtData> {
  return fetchCourtDataInternal(inn);
}

export async function fetchDebtData(inn: string): Promise<DebtData> {
  return fetchDebtDataInternal(inn);
}

export const calculateRiskScore = calculateRiskScoreInternal;
