// Single source of truth for company / operator details that appear in
// the public legal pages (privacy policy, terms of service, public offer)
// and in transactional emails.
//
// ⚠️  Edit this file when the legal entity (ИП / ООО) is registered.
//     The `operator` block must contain real legal name, ИНН, ОГРН and
//     address before paid tariffs go live, because:
//       1. The public offer (/offer) is contractually binding —
//          ЮKassa requires a link to it before activating payments.
//       2. The privacy policy (/privacy) must name the data controller
//          ("оператор") for 152-ФЗ compliance.
//       3. Receipts (54-ФЗ) need the seller's identifying details.
//
//     Until those are set, the pages render with placeholder strings
//     that make it visible at a glance that the entity isn't registered.

export const LEGAL_EFFECTIVE_DATE = "2026-05-10";

/** Brand identity (consumer-facing). Distinct from the operator legal entity. */
export const BRAND = {
  name: "ЮрИИст",
  tagline: "AI-юрист для бизнеса",
  domain: "juriist.vercel.app",
  publicUrl: "https://juriist.vercel.app",
} as const;

/**
 * Legal operator. Placeholder values are intentionally Russian text starting
 * with "[" so they're impossible to miss in production until replaced.
 */
export const OPERATOR = {
  legalName: "[Исполнитель — ИП/ООО, наименование будет указано после регистрации]",
  shortName: "Исполнитель",
  inn: "[ИНН будет указан после регистрации]",
  ogrn: "[ОГРН/ОГРНИП будет указан после регистрации]",
  registeredAddress:
    "[Юридический адрес будет указан после регистрации]",
  bankAccount: "[Расчётный счёт будет указан после регистрации]",
  bankName: "[Наименование банка будет указано после регистрации]",
  bankBic: "[БИК будет указан после регистрации]",
  bankCorrespondentAccount:
    "[Корр. счёт будет указан после регистрации]",

  /**
   * Roskomnadzor PII operator registry number. Issued after registration at
   * https://pd.rkn.gov.ru/operators-registry/. Required by 152-ФЗ before
   * processing personal data of Russian citizens.
   */
  rknOperatorNumber: null as string | null,
} as const;

/** Email contacts shown in legal pages and used as `From:` for transactional mail. */
export const CONTACTS = {
  support: "support@juriist.ru",
  privacy: "privacy@juriist.ru",
  legal: "legal@juriist.ru",
  /** Reply-to / From address shown in transactional email headers. */
  noReply: "no-reply@juriist.ru",
} as const;

/** Pricing in RUB / month. Single source of truth — referenced from /offer and the landing pricing block. */
export const PRICING_RUB = {
  PRO: 3990,
  BUSINESS: 14990,
} as const;

/** Pricing in kopecks (integer) — used for billing math to dodge float drift. */
export const PRICING_KOPECKS = {
  PRO: PRICING_RUB.PRO * 100,
  BUSINESS: PRICING_RUB.BUSINESS * 100,
} as const;

export type PaidPlan = "PRO" | "BUSINESS";

export function isPaidPlan(plan: string): plan is PaidPlan {
  return plan === "PRO" || plan === "BUSINESS";
}

/** Trial period for new workspaces, in days. */
export const TRIAL_DAYS = 14;

export function isOperatorPlaceholder(): boolean {
  return OPERATOR.legalName.startsWith("[");
}
