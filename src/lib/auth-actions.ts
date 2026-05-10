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

export async function registerUser(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email и пароль обязательны" };
  }

  if (password.length < 6) {
    return { error: "Пароль должен быть не менее 6 символов" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Пользователь с таким email уже существует" };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name: name || null,
      email,
      password: hashedPassword,
    },
  });

  // Fire-and-forget: don't block sign-in if mail fails. sendEmail() never
  // throws — errors are reported to telemetry inside the helper.
  void sendEmail(buildWelcomeEmail({ to: email, name: name || null }));

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

  if (!email || !password) {
    return { error: "Email и пароль обязательны" };
  }

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
    if (result.ok) return { ok: true };

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
