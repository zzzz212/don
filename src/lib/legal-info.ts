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
  name: "Яксо",
  tagline: "AI-юрист для бизнеса",
  domain: "yakso.ru",
  publicUrl: "https://yakso.ru",
} as const;

/**
 * Legal operator. Placeholder values are intentionally Russian text starting
 * with "[" so they're impossible to miss in production until replaced.
 */
export const OPERATOR = {
  legalName: "Индивидуальный предприниматель Дадашева Зарета Райкомовна",
  shortName: "Исполнитель",
  inn: "772580231694",
  ogrn: "310774628400191",
  registeredAddress:
    "г. Москва, Даниловская набережная, д. 6, корп. 3, кв. 27",

  // Расчётный счёт ещё не открыт. Пока поля пусты, раздел «Реквизиты
  // исполнителя» в /offer не выводит банковский блок — заполнить эти
  // четыре поля и вернуть блок в offer/page.tsx при открытии счёта.
  bankAccount: "",
  bankName: "",
  bankBic: "",
  bankCorrespondentAccount: "",

  /**
   * Roskomnadzor PII operator registry number. Issued after registration at
   * https://pd.rkn.gov.ru/operators-registry/. Required by 152-ФЗ before
   * processing personal data of Russian citizens.
   */
  rknOperatorNumber: null as string | null,
} as const;

/** Email contacts shown in legal pages and used as `From:` for transactional mail. */
export const CONTACTS = {
  support: "support@yakso.ru",
  privacy: "privacy@yakso.ru",
  legal: "legal@yakso.ru",
  /** Reply-to / From address shown in transactional email headers. */
  noReply: "no-reply@yakso.ru",
} as const;

/**
 * Pricing in RUB / month. Single source of truth — referenced from /offer
 * and the landing pricing block.
 *
 * Legacy "PRO" is kept as an alias to PRO_SOLO so old code paths (email
 * receipts replaying historical Subscription rows, admin tools dumping
 * raw plan strings, etc.) keep producing valid amounts. New checkouts
 * use PRO_SOLO / PRO_TEAM / BUSINESS exclusively.
 */
export const PRICING_RUB = {
  PRO_SOLO: 1990,
  PRO_TEAM: 4990,
  BUSINESS: 14990,
  // Legacy alias — same price as PRO_SOLO. Anything still reading "PRO"
  // (subscription rows, receipt emails for past payments) gets sensible
  // numbers without a destructive backfill.
  PRO: 1990,
} as const;

/** Pricing in kopecks (integer) — used for billing math to dodge float drift. */
export const PRICING_KOPECKS = {
  PRO_SOLO: PRICING_RUB.PRO_SOLO * 100,
  PRO_TEAM: PRICING_RUB.PRO_TEAM * 100,
  BUSINESS: PRICING_RUB.BUSINESS * 100,
  PRO: PRICING_RUB.PRO * 100,
} as const;

/**
 * Canonical paid-plan strings. Legacy "PRO" is accepted at the type level
 * so existing call sites passing it (emails, audit logs, historical
 * subscriptions) continue to typecheck.
 */
export type PaidPlan = "PRO_SOLO" | "PRO_TEAM" | "BUSINESS" | "PRO";

export function isPaidPlan(plan: string): plan is PaidPlan {
  return (
    plan === "PRO_SOLO" ||
    plan === "PRO_TEAM" ||
    plan === "BUSINESS" ||
    plan === "PRO"
  );
}

/**
 * Human-readable plan label. Single source of truth for the UI chrome
 * (account menu, billing page, admin tools, email subject lines).
 * Legacy "PRO" maps to the PRO_SOLO label since that's its current
 * pricing alias.
 */
export const PLAN_LABEL: Record<string, string> = {
  FREE: "Старт",
  PRO_SOLO: "Pro Solo",
  PRO_TEAM: "Pro Team",
  BUSINESS: "Бизнес",
  // Legacy
  PRO: "Pro Solo",
};

export function planLabel(plan: string | null | undefined): string {
  if (!plan) return PLAN_LABEL.FREE;
  return PLAN_LABEL[plan] ?? plan;
}

/** Trial period, in days. Granted ONLY via explicit activation through
 *  /api/billing/activate-trial — no longer auto-set at signup. */
export const TRIAL_DAYS = 2;
/** Cyrillic spell-out of TRIAL_DAYS for the legal pages — must match. */
export const TRIAL_DAYS_LABEL = "два";

export function isOperatorPlaceholder(): boolean {
  return OPERATOR.legalName.startsWith("[");
}
