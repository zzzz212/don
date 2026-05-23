// ФССП (Федеральная служба судебных приставов) — debt registry.
//
// CURRENT STATE: stub with mock for known test INNs, zeros otherwise.
//
// TO ACTIVATE A REAL PROVIDER:
//   • Public ФССП API: https://api-ip.fssp.gov.ru — requires AUTHKEY
//     (free signup, but rate-limited 100 requests/day)
//   • Or use api-fns.ru / Контур.Фокус (already covers debts in their bundle)
//
// Set FSSP_AUTH_KEY in env, replace fetchDebts body with real call.
// Interface contract (DebtData | null) does not change.

import type { DebtData, DebtProvider } from "../types";

const MOCK_DEBT_INNS = new Set(["7708119296", "7710144361"]);

export const fsspStubProvider: DebtProvider = {
  name: "fssp-stub",
  available: true,

  async fetchDebts(inn: string): Promise<DebtData | null> {
    if (MOCK_DEBT_INNS.has(inn)) {
      return {
        found: true,
        amount: BigInt("150000"),
        sources: ["ФССП (Федеральная служба судебных приставов)"],
      };
    }
    return { found: false, amount: undefined, sources: [] };
  },
};
