// ИНН (taxpayer id) validation.
//
// Two formats exist in Russia:
//   • 10 digits — legal entity (ЮЛ / организация)
//   • 12 digits — individual or sole trader (физлицо / ИП)
// Both carry trailing check digits derived from a fixed weight vector, so
// a typo'd or fabricated ИНН is rejected before we ever call DaData. The
// algorithm is the official ФНС one (Приказ МНС РФ от 03.03.2004 № БГ-3-09/178).

export type InnKind = "legal" | "individual";

export interface InnValidation {
  valid: boolean;
  kind: InnKind | null;
  /** Digits-only normalised form, or "" when the input had no digits. */
  normalized: string;
  error?: string;
}

// Weight vectors for the control-digit checksums.
const WEIGHTS_10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const WEIGHTS_11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const WEIGHTS_12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

/** Strip everything that isn't a digit — users paste ИНН with spaces. */
export function normalizeInn(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

function checkDigit(digits: number[], weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += digits[i] * weights[i];
  return (sum % 11) % 10;
}

/**
 * Validate an ИНН by length and control digits. Does NOT verify the ИНН
 * actually exists — that's a DaData lookup the caller does next.
 */
export function validateInn(raw: string): InnValidation {
  const normalized = normalizeInn(raw);
  if (normalized.length === 0) {
    return { valid: false, kind: null, normalized, error: "Введите ИНН" };
  }
  if (normalized.length !== 10 && normalized.length !== 12) {
    return {
      valid: false,
      kind: null,
      normalized,
      error: "ИНН содержит 10 цифр (организация) или 12 (ИП / физлицо)",
    };
  }
  const digits = normalized.split("").map((c) => Number(c));

  if (normalized.length === 10) {
    const ok = checkDigit(digits, WEIGHTS_10) === digits[9];
    return {
      valid: ok,
      kind: ok ? "legal" : null,
      normalized,
      error: ok
        ? undefined
        : "Контрольная сумма ИНН не сходится — проверьте цифры",
    };
  }

  // 12 digits — two control digits, both must match.
  const ok11 = checkDigit(digits, WEIGHTS_11) === digits[10];
  const ok12 = checkDigit(digits, WEIGHTS_12) === digits[11];
  const ok = ok11 && ok12;
  return {
    valid: ok,
    kind: ok ? "individual" : null,
    normalized,
    error: ok
      ? undefined
      : "Контрольная сумма ИНН не сходится — проверьте цифры",
  };
}

/** Human label for an ИНН kind — used in UI copy. */
export function innKindLabel(kind: InnKind): string {
  return kind === "legal" ? "организация" : "ИП / физлицо";
}
