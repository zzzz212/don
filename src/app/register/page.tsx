"use client";

import { useState } from "react";
import Link from "next/link";
import { Scale, Mail, Lock, User, Loader2, AlertCircle } from "lucide-react";
import { registerUser, loginWithGoogle } from "@/lib/auth-actions";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await registerUser(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    await loginWithGoogle();
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-surface/30 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
              <Scale className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground">
              ЮрИИст
            </span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-foreground">
            Создайте аккаунт
          </h1>
          <p className="mt-2 text-sm text-muted">
            3 бесплатных анализа договоров каждый месяц
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={isGoogleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-white py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface disabled:opacity-50"
          >
            {isGoogleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Регистрация через Google
          </button>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted">или</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Имя
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  name="name"
                  type="text"
                  placeholder="Иван Иванов"
                  className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@company.ru"
                  className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Минимум 6 символов"
                  className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Регистрация...
                </>
              ) : (
                "Создать аккаунт"
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted">
            Уже есть аккаунт?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:text-primary-dark"
            >
              Войти
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Регистрируясь, вы принимаете{" "}
          <span className="underline">условия использования</span> и{" "}
          <span className="underline">политику конфиденциальности</span>
        </p>
      </div>
    </div>
  );
}
