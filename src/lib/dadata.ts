// DaData integration for company data enrichment
// https://dadata.ru/api/

interface DaDataParty {
  inn: string;
  name: {
    full_with_opf: string;
    short_with_opf: string;
    opf?: {
      code: string;
      name: string;
    };
  };
  state?: {
    status: string;
    code: string;
    registration_date?: string;
    liquidation_date?: string;
  };
  address?: {
    value: string;
  };
  finance?: {
    tax_system?: string;
    revenue?: number;
    debt?: number;
  };
  management?: Array<{
    name: string;
    post: string;
  }>;
}

interface DaDataResponse {
  suggestions: Array<{
    value: string;
    data: DaDataParty;
  }>;
}

interface SuggestionResponse {
  data: DaDataParty;
}

interface StatusCode {
  name: string;
  code: string;
}

function getDaDataKey(): string | null {
  return process.env.DADATA_API_KEY || null;
}

function getDaDataSecret(): string | null {
  return process.env.DADATA_SECRET_KEY || null;
}

export async function fetchFromDaData(inn: string): Promise<{
  name: string;
  status: string;
  registrationDate?: string;
  address?: string;
  capitalSize?: number;
  managementFio?: string;
} | null> {
  const apiKey = getDaDataKey();
  const secret = getDaDataSecret();

  if (!apiKey || !secret) {
    console.warn("DaData API key or secret not configured, falling back to mock");
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch("https://suggestions.dadata.ru/api/v1/suggest/party", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${apiKey}`,
        "X-Secret": secret,
      },
      body: JSON.stringify({
        query: inn,
        type: "LEGAL",
        count: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`DaData error: ${response.status}`);
      return null;
    }

    const data: DaDataResponse = await response.json();

    if (!data.suggestions || data.suggestions.length === 0) {
      return null;
    }

    const party = data.suggestions[0].data;
    const statusCode = party.state?.status || "UNKNOWN";

    return {
      name: party.name.full_with_opf,
      status: statusCode === "ACTIVE" ? "активна" : statusCode === "LIQUIDATING" ? "ликвидация" : "ликвидирована",
      registrationDate: party.state?.registration_date,
      address: party.address?.value,
      capitalSize: undefined,
      managementFio: party.management?.[0]?.name,
    };
  } catch (error) {
    console.error("DaData fetch error:", error);
    return null;
  }
}

// Получить арбитражные судебные данные (требует отдельный endpoint DaData)
export async function fetchArbitrationData(inn: string): Promise<{
  activeCases: number;
  completedCases: number;
  losses: number;
} | null> {
  const apiKey = getDaDataKey();

  if (!apiKey) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://suggestions.dadata.ru/api/v1/rs/findbyid/party?query=${inn}`,
      {
        headers: {
          Authorization: `Token ${apiKey}`,
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // DaData не предоставляет прямых судебных данных в этом endpoint
    // Это было бы доступно через более дорогой тариф
    return null;
  } catch (error) {
    console.error("DaData arbitration fetch error:", error);
    return null;
  }
}

// Получить информацию о судебных исках (через API kad.arbitr.ru, но рекомендуется через DaData PRO)
export async function fetchDebtData(inn: string): Promise<{
  found: boolean;
  amount?: number;
} | null> {
  const apiKey = getDaDataKey();

  if (!apiKey) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    // Через DaData можно запросить информацию о задолженностях (платный сервис)
    // Здесь упрощённый вариант
    const response = await fetch("https://api.dadata.ru/api/v2/clean/party", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify({
        source: inn,
        type: "LEGAL",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data: SuggestionResponse = await response.json();

    // Проверяем статус компании
    if (data.data?.state?.status === "LIQUIDATED" || data.data?.state?.status === "LIQUIDATING") {
      return {
        found: true,
        amount: undefined,
      };
    }

    return {
      found: false,
    };
  } catch (error) {
    console.error("DaData debt fetch error:", error);
    return null;
  }
}
