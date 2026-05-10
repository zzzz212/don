import { fetchFromDaData } from "@/lib/dadata";
import type { CompanyData, CompanyProvider } from "../types";

export const dadataProvider: CompanyProvider = {
  name: "dadata",

  get available() {
    const key = process.env.DADATA_API_KEY;
    return !!key && !key.includes("your-dadata") && key.trim().length > 0;
  },

  async fetchCompany(inn: string): Promise<CompanyData | null> {
    const result = await fetchFromDaData(inn);
    if (!result) return null;
    return {
      name: result.name,
      organizationType: result.organizationType ?? result.name.split(" ")[0],
      registrationDate: result.registrationDate,
      address: result.address,
      okved: result.okved,
      capitalSize: result.capitalSize,
      statusCode: result.status,
    };
  },
};
