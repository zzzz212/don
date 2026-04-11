"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";

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

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}
