import type { CompanyData, CompanyProvider } from "../types";

const EGRUL_ENDPOINT = "https://egrul.nalog.ru/api/v1/person/legal";
const TIMEOUT_MS = 5000;

interface EgrulRawResponse {
  name?: string;
  organizationType?: string;
  registrationDate?: string;
  address?: string;
  okved?: string;
  capitalSize?: number;
  statusCode?: string;
}

// Public ФНС endpoint — always available, no key required, but rate-limited
// and not always reliable. Used as fallback when DaData is missing or quiet.
export const egrulProvider: CompanyProvider = {
  name: "egrul",
  available: true,

  async fetchCompany(inn: string): Promise<CompanyData | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${EGRUL_ENDPOINT}?inn=${inn}`, {
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const data: EgrulRawResponse = await response.json();
      if (!data.name) return null;

      return {
        name: data.name,
        organizationType: data.organizationType,
        registrationDate: data.registrationDate,
        address: data.address,
        okved: data.okved,
        capitalSize: data.capitalSize,
        statusCode: data.statusCode,
      };
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        console.error("[egrul] timeout >5s");
      } else {
        console.error("[egrul] fetch failed:", (e as Error).message);
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
