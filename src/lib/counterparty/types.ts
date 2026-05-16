// Provider-agnostic counterparty types. All adapters return data shaped to
// these interfaces; consumers don't care which source produced it.

export interface CompanyData {
  name: string;
  organizationType?: string;
  registrationDate?: string;
  address?: string;
  okved?: string;
  capitalSize?: number;
  /** Russian-language status: "активна" | "ликвидация" | "ликвидирована" | "банкрот" */
  statusCode?: string;
}

export interface CourtData {
  activeLawsuits: number;
  completedLawsuits: number;
  /** Cases where the company was the losing party */
  lossesCount: number;
  /** Free-form notes the provider may include (top case, etc) */
  note?: string;
}

export interface DebtData {
  found: boolean;
  amount?: bigint;
  /** Names of the data sources that reported the debt (ФССП, ФЕДРЕСУРС, etc) */
  sources: string[];
}

export interface CompanyProvider {
  readonly name: string;
  readonly available: boolean;
  fetchCompany(inn: string): Promise<CompanyData | null>;
}

export interface CourtProvider {
  readonly name: string;
  readonly available: boolean;
  fetchCourtCases(inn: string): Promise<CourtData | null>;
}

export interface DebtProvider {
  readonly name: string;
  readonly available: boolean;
  // companyName is required by the real ФССП search (it queries a legal
  // entity by name, not by ИНН); the stub ignores it. Optional so the
  // stub's narrower signature still satisfies the interface.
  fetchDebts(inn: string, companyName?: string): Promise<DebtData | null>;
}
