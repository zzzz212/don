// DaData integration for company data enrichment
// Docs: https://dadata.ru/api/find-party/

interface DaDataParty {
  inn: string;
  ogrn?: string;
  kpp?: string;
  type?: string;
  name: {
    full_with_opf?: string;
    short_with_opf?: string;
    full?: string;
    short?: string;
  };
  opf?: {
    code?: string;
    full?: string;
    short?: string;
    type?: string;
  };
  state?: {
    status?: "ACTIVE" | "LIQUIDATING" | "LIQUIDATED" | "BANKRUPT" | "REORGANIZING";
    code?: string;
    actuality_date?: number;
    registration_date?: number;
    liquidation_date?: number;
  };
  address?: {
    value?: string;
    unrestricted_value?: string;
  };
  capital?: {
    type?: string;
    value?: number;
  };
  finance?: {
    tax_system?: string;
    income?: number;
    expense?: number;
    debt?: number;
    penalty?: number;
  };
  management?: {
    name?: string;
    post?: string;
    disqualified?: boolean | null;
  };
  okved?: string;
  okveds?: Array<{ code: string; name: string; type: string; main: boolean }>;
}

interface DaDataResponse {
  suggestions: Array<{
    value: string;
    unrestricted_value?: string;
    data: DaDataParty;
  }>;
}

function getDaDataKey(): string | null {
  const key = process.env.DADATA_API_KEY;
  if (!key || key.trim() === "" || key.includes("your-dadata")) return null;
  return key.trim();
}

function getDaDataSecret(): string | null {
  const key = process.env.DADATA_SECRET_KEY;
  if (!key || key.trim() === "" || key.includes("your-dadata")) return null;
  return key.trim();
}

/**
 * Whether a real DaData key is configured. Callers use this to tell
 * "ИНН genuinely not found" apart from "lookup unavailable" — e.g. the
 * ИНН-claim flow rejects an unknown ИНН only when DaData could have
 * found it.
 */
export function isDaDataConfigured(): boolean {
  return getDaDataKey() !== null;
}

export interface DaDataCompany {
  name: string;
  shortName: string;
  inn: string;
  ogrn?: string;
  kpp?: string;
  status: string;
  statusCode: string;
  registrationDate?: string;
  liquidationDate?: string;
  address?: string;
  capitalSize?: number;
  managementFio?: string;
  managementPost?: string;
  okved?: string;
  okvedName?: string;
  organizationType?: string;
}

/**
 * Search for company data by INN using DaData findById API.
 * Only requires DADATA_API_KEY (no secret needed for suggestions).
 */
export async function fetchFromDaData(inn: string): Promise<DaDataCompany | null> {
  const apiKey = getDaDataKey();

  if (!apiKey) {
    console.warn("[DaData] API key not configured. Set DADATA_API_KEY in .env to enable real data.");
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${apiKey}`,
        },
        body: JSON.stringify({
          query: inn,
          count: 1,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[DaData] HTTP ${response.status}: ${errorText.slice(0, 200)}`);
      return null;
    }

    const data: DaDataResponse = await response.json();

    if (!data.suggestions || data.suggestions.length === 0) {
      console.warn(`[DaData] No company found for INN ${inn}`);
      return null;
    }

    const party = data.suggestions[0].data;
    const statusCode = party.state?.status || "UNKNOWN";

    const statusRus =
      statusCode === "ACTIVE"
        ? "активна"
        : statusCode === "LIQUIDATING"
          ? "ликвидация"
          : statusCode === "LIQUIDATED"
            ? "ликвидирована"
            : statusCode === "BANKRUPT"
              ? "банкрот"
              : statusCode === "REORGANIZING"
                ? "реорганизация"
                : "неизвестен";

    const mainOkved = party.okveds?.find((o) => o.main) || party.okveds?.[0];

    const result: DaDataCompany = {
      name: party.name.full_with_opf || party.name.full || data.suggestions[0].value,
      shortName: party.name.short_with_opf || party.name.short || "",
      inn: party.inn,
      ogrn: party.ogrn,
      kpp: party.kpp,
      status: statusRus,
      statusCode,
      registrationDate: party.state?.registration_date
        ? new Date(party.state.registration_date).toISOString()
        : undefined,
      liquidationDate: party.state?.liquidation_date
        ? new Date(party.state.liquidation_date).toISOString()
        : undefined,
      address: party.address?.unrestricted_value || party.address?.value,
      capitalSize: party.capital?.value,
      managementFio: party.management?.name,
      managementPost: party.management?.post,
      okved: mainOkved?.code || party.okved,
      okvedName: mainOkved?.name,
      organizationType: party.opf?.short,
    };

    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[DaData] Request timeout (>10s)");
    } else {
      console.error("[DaData] Fetch error:", error);
    }
    return null;
  }
}

/**
 * Get extended financial data (debts, penalties) using DaData clean/party.
 * Requires both DADATA_API_KEY and DADATA_SECRET_KEY.
 */
export async function fetchDaDataFinance(inn: string): Promise<{
  debt?: number;
  penalty?: number;
  income?: number;
  expense?: number;
} | null> {
  const apiKey = getDaDataKey();
  const secret = getDaDataSecret();

  if (!apiKey || !secret) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://cleaner.dadata.ru/api/v1/clean/party", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Token ${apiKey}`,
        "X-Secret": secret,
      },
      body: JSON.stringify([inn]),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[DaData clean] HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    const party = data?.[0];

    if (!party?.finance) return null;

    return {
      debt: party.finance.debt,
      penalty: party.finance.penalty,
      income: party.finance.income,
      expense: party.finance.expense,
    };
  } catch (error) {
    console.error("[DaData clean] Fetch error:", error);
    return null;
  }
}
