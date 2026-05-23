// КАД (Картотека арбитражных дел) — court case registry.
//
// CURRENT STATE: stub with hard-coded mock for known test INNs, otherwise
// returns zeros. The shape of fetchCourtCases matches what api-fns.ru,
// Контур.Фокус, or СПАРК-Интерфакс would return, so swapping in a real
// implementation is a single-file change.
//
// TO ACTIVATE A REAL PROVIDER:
//   1. Sign up at https://api-fns.ru (cheapest paid tier ~₽3000/mo) or
//      https://focus.kontur.ru (~₽40-80k/mo, all-in-one)
//   2. Set API_FNS_KEY or KONTUR_FOCUS_KEY in env
//   3. Replace the body of fetchCourtCases below with the real HTTP call.
//      The interface contract (CourtData | null) does not change.

import type { CourtData, CourtProvider } from "../types";

const MOCK_COURT_DATA: Record<string, CourtData> = {
  "7708119296": { activeLawsuits: 3, completedLawsuits: 8, lossesCount: 5 },
  "7710144361": { activeLawsuits: 1, completedLawsuits: 2, lossesCount: 0 },
};

export const kadStubProvider: CourtProvider = {
  name: "kad-stub",
  // Stays "available" so we always return *some* data — but the source flag
  // in the orchestrator marks the result as estimated, not authoritative.
  available: true,

  async fetchCourtCases(inn: string): Promise<CourtData | null> {
    return (
      MOCK_COURT_DATA[inn] ?? {
        activeLawsuits: 0,
        completedLawsuits: 0,
        lossesCount: 0,
      }
    );
  },
};
