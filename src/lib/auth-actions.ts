"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { sendEmail } from "@/lib/email";
import { buildWelcomeEmail } from "@/lib/email/templates/welcome";
import {
  requestPasswordReset as doRequestPasswordReset,
  consumePasswordResetToken as doConsumePasswordResetToken,
  MIN_PASSWORD_LEN,
} from "@/lib/password-reset";
import { reportError } from "@/lib/telemetry";
import { captureEvent } from "@/lib/analytics/server";
import { logAudit } from "@/lib/audit";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal-info";
import {
  isDisposableEmail,
  normalizeEmailForDedup,
  hashFingerprint,
} from "@/lib/anti-abuse";
import { generateReferralCode, resolveReferralCode } from "@/lib/referral";

export async function registerUser(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  // 152-ФЗ requires explicit consent at the moment of account creation,
  // with cross-border transfer (Art. 12) as a SEPARATE legal basis from
  // domestic processing (Art. 9). The client form sets these flags only
  // after the user ticks both boxes; the server re-validates because a
  // crafted request bypassing the UI would still hit this code path.
  const consentGeneral = formData.get("consent_general") === "1";
  const consentTransborder = formData.get("consent_transborder") === "1";

  if (!email || !password) {
    return { error: "Email и пароль обязательны" };
  }

  if (password.length < 6) {
    return { error: "Пароль должен быть не менее 6 символов" };
  }

  if (!consentGeneral || !consentTransborder) {
    // Generic message — the UI separates the two checkboxes so the user
    // already knows which one they missed; we don't need to leak which
    // one was missing back to the server response.
    return {
      error:
        "Для регистрации необходимо принять оба согласия — на обработку персональных данных и на их трансграничную передачу.",
    };
  }

  // ── Anti-abuse: hard blocks ───────────────────────────────────────
  // Disposable / throwaway addresses can't anchor a real account —
  // reject before we ever create a row.
  if (isDisposableEmail(email)) {
    return {
      error:
        "Регистрация с одноразовых почтовых сервисов недоступна. Используйте постоянный email.",
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Пользователь с таким email уже существует" };
  }

  // Normalised-email collision — j.o.hn+promo@gmail and john@gmail reach
  // the same inbox, so they're the same person. This is the main lever
  // against farming trials with alias variants of one address.
  const normalizedEmail = normalizeEmailForDedup(email);
  const normalizedClash = await prisma.user.findFirst({
    where: { normalizedEmail },
    select: { id: true },
  });
  if (normalizedClash) {
    return {
      error:
        "Аккаунт с таким email уже существует. Если вы добавили точки или +псевдоним — войдите в исходный аккаунт.",
    };
  }

  // Capture request attribution once — reused for the User row (signup
  // signals) and the consent audit event. headers() can rarely throw
  // outside a request scope, so it's wrapped; never block signup on it.
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null;
    userAgent = h.get("user-agent");
  } catch {
    // non-fatal
  }

  // Best-effort device fingerprint from the client (see fingerprint.ts).
  // Stored only as a SHA-256 hash; feeds the trial-activation cluster
  // score, never auto-blocks on its own.
  const fingerprintRaw = (formData.get("fingerprint") as string | null) ?? "";

  // Referral: mint this user's own invite code and, if they arrived via
  // ?ref=CODE, link them to whoever invited them.
  const referralCode = await generateReferralCode();
  const refParam = (formData.get("ref") as string | null)?.trim() ?? "";
  const referredById = refParam ? await resolveReferralCode(refParam) : null;

  const hashedPassword = await bcrypt.hash(password, 12);

  const newUser = await prisma.user.create({
    data: {
      name: name || null,
      email,
      password: hashedPassword,
      normalizedEmail,
      signupIp: ip,
      signupUserAgent: userAgent ? userAgent.slice(0, 500) : null,
      signupFingerprint: hashFingerprint(fingerprintRaw) || null,
      referralCode,
      referredById,
    },
    select: { id: true },
  });

  // Persist consent capture to the audit log — the legal-grade record
  // that survives even if the account is deleted later (AuditEvent.orgId
  // is nullable + onDelete: SetNull). logAudit is swallow-and-report, so
  // a failed write can't break signup.
  void logAudit({
    orgId: null,
    userId: newUser.id,
    action: "account.signup_consent_granted",
    target: newUser.id,
    targetType: "user",
    payload: {
      consentGeneral,
      consentTransborder,
      legalEffectiveDate: LEGAL_EFFECTIVE_DATE,
      provider: "credentials",
    },
    ip,
    userAgent,
  });

  // Fire-and-forget: don't block sign-in if mail fails. sendEmail() never
  // throws — errors are reported to telemetry inside the helper.
  void sendEmail(buildWelcomeEmail({ to: email, name: name || null }));

  // Analytics: fire-and-forget. captureEvent never throws.
  void captureEvent({
    userId: newUser.id,
    event: "signup_completed",
    properties: { provider: "credentials" },
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    return { error: "Ошибка при входе после регистрации" };
  }

  return { success: true };
}

export async function loginUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const totpCode = (formData.get("totpCode") as string | null) ?? "";

  if (!email || !password) {
    return { error: "Email и пароль обязательны" };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      totpCode,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    return { error: "Неверный email или пароль" };
  }

  return { success: true };
}

export async function isGoogleAuthEnabled() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function loginWithGoogle() {
  try {
    await signIn("google", { redirectTo: "/dashboard" });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    throw new Error("Ошибка при входе через Google");
  }
}

// ── Password reset ────────────────────────────────────────────────

/**
 * Build the absolute origin (protocol + host) for the reset URL out of the
 * incoming request headers. Falls back to AUTH_URL / Vercel URL env so this
 * also works in environments where the proxy strips Forwarded headers.
 */
async function resolveBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const proto =
      h.get("x-forwarded-proto") ??
      (process.env.NODE_ENV === "production" ? "https" : "http");
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() is only available in route handlers / server actions; if
    // we got here without it, fall through to the env defaults.
  }
  if (process.env.AUTH_URL) return process.env.AUTH_URL;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Server action: send a password-reset email if the address belongs to a
 * registered user. Always returns { ok: true } so the UI can show a single
 * success message regardless — never leak which addresses are registered.
 */
export async function requestPasswordReset(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Введите корректный email" };
  }
  try {
    const baseUrl = await resolveBaseUrl();
    await doRequestPasswordReset(email, baseUrl);
    void captureEvent({
      userId: null,
      event: "password_reset_requested",
    });
    return { ok: true };
  } catch (e) {
    await reportError(e, { op: "auth.password-reset.request" });
    return { error: "Не удалось отправить письмо. Попробуйте позже." };
  }
}

/**
 * Server action: consume a reset token and update the password. The token
 * is single-use and time-limited (30 минут).
 */
export async function confirmPasswordReset(
  formData: FormData
): Promise<{ ok: true } | { error: string }> {
  const token = (formData.get("token") as string | null) ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const confirm = (formData.get("confirm") as string | null) ?? "";

  if (password !== confirm) {
    return { error: "Пароли не совпадают" };
  }

  try {
    const result = await doConsumePasswordResetToken(token, password);
    if (result.ok) {
      void captureEvent({
        userId: null,
        event: "password_reset_completed",
      });
      return { ok: true };
    }

    switch (result.reason) {
      case "WEAK_PASSWORD":
        return { error: `Пароль должен быть не короче ${MIN_PASSWORD_LEN} символов` };
      case "EXPIRED":
        return { error: "Срок действия ссылки истёк. Запросите новую." };
      case "ALREADY_USED":
        return { error: "Эта ссылка уже была использована. Запросите новую." };
      default:
        return { error: "Ссылка недействительна. Запросите новую." };
    }
  } catch (e) {
    await reportError(e, { op: "auth.password-reset.confirm" });
    return { error: "Не удалось сменить пароль. Попробуйте позже." };
  }
}
