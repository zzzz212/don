"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { sendEmail } from "@/lib/email";
import { buildWelcomeEmail } from "@/lib/email/templates/welcome";

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
