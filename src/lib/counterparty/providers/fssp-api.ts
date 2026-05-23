// ФССП — Банк данных исполнительных производств (real provider).
//
// Official public API: https://api-ip.fssp.gov.ru/api/v1.0
// Requires a free AUTHKEY (register on the ФССП site). The rate limit is
// modest (~100 requests/day) — the orchestrator caches the result on
// CounterpartyProfile for 30 days, so a real account rarely hits it.
//
// Two things shape this adapter:
//   • The API is ASYNCHRONOUS — a search returns a task token, then you
//     poll a result endpoint until the task finishes.
//   • It searches legal entities by NAME, not by ИНН. So this provider
//     needs the company name (resolved by the company-data step) and
//     returns null when it isn't available — letting the chain fall
//     through to the stub.
//
// NOT verified against a live key. The request/response shapes below
// follow the documented v1.0 contract; confirm the field names and the
// `status` semantics on first activation.

import type { DebtData, DebtProvider } from "../types";

const API_BASE = "https://api-ip.fssp.gov.ru/api/v1.0";
// 8 × 1.5s = 12s worst case — comfortably inside the route's budget,
// and the task is usually ready within a few seconds.
const POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 1500;

function token(): string | undefined {
  const t = process.env.FSSP_AUTH_KEY;
  return t && t.trim().length > 0 ? t.trim() : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const fsspApiProvider: DebtProvider = {
  name: "fssp-api",

  // Mirrors the dadataProvider pattern — inert until the key is set, so
  // dev / preview without a token transparently falls back to the stub.
  get available() {
    return token() !== undefined;
  },

  async fetchDebts(_inn: string, companyName?: string): Promise<DebtData | null> {
    const t = token();
    // The ФССП bank searches a legal entity by name — without a resolved
    // company name there is nothing to query; let the chain fall through.
    if (!t || !companyName) return null;

    // 1. Submit the asynchronous search.
    const searchUrl = `${API_BASE}/search/legal?token=${encodeURIComponent(
      t
    )}&name=${encodeURIComponent(companyName)}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      throw new Error(`ФССП search HTTP ${searchRes.status}`);
    }
    const searchJson = (await searchRes.json()) as {
      response?: { task?: string };
    };
    const task = searchJson.response?.task;
    if (!task) return { found: false, sources: [] };

    // 2. Poll the result endpoint until the task finishes. `status === 0`
    //    is treated as "done" per the documented contract.
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const res = await fetch(
        `${API_BASE}/result?token=${encodeURIComponent(
          t
        )}&task=${encodeURIComponent(task)}`
      );
      if (!res.ok) continue;
      const json = (await res.json()) as {
        status?: number;
        response?: Array<{ result?: unknown[] }>;
      };
      if (json.status === 0) {
        const records = (json.response ?? []).flatMap((g) => g.result ?? []);
        return summarise(records);
      }
    }

    // Task never finished — treat as a provider failure so the chain
    // falls back to the stub rather than reporting a misleading "no debts".
    throw new Error("ФССП: задача не завершилась за отведённое время");
  },
};

// Each record is one исполнительное производство. The total sum lives in
// free-text subject / details fields, so `found` is the authoritative
// signal and `amount` is best-effort parsed.
function summarise(records: unknown[]): DebtData {
  if (records.length === 0) return { found: false, sources: [] };

  let total = BigInt(0);
  for (const r of records) {
    const rec = r as { details?: unknown; subject?: unknown };
    const text = `${typeof rec.details === "string" ? rec.details : ""} ${
      typeof rec.subject === "string" ? rec.subject : ""
    }`;
    const m = text.match(/(\d[\d\s]*)(?:[.,]\d{1,2})?\s*руб/i);
    if (m) {
      const digits = m[1].replace(/\s/g, "");
      if (digits) total += BigInt(digits);
    }
  }

  return {
    found: true,
    amount: total > BigInt(0) ? total : undefined,
    sources: [
      `ФССП — банк данных исполнительных производств (${records.length})`,
    ],
  };
}
