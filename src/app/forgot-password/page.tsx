"use client";

import { useState } from "react";
import Link from "next/link";
import { Scale, Mail, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth-actions";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = (formData.get("email") as string | null)?.trim() ?? "";
    const result = await requestPasswordReset(formData);

    setIsLoading(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setSubmittedEmail(email);
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-surface/30 px-4 py-12">
      <div className="w-full max-w-md">
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
            Восстановление пароля
          </h1>
          <p className="mt-2 text-sm text-muted">
            Укажите email, который вы использовали при регистрации.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {submittedEmail ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Проверьте почту
              </h2>
              <p className="mt-2 text-sm text-muted">
                Если адрес <strong className="text-foreground">{submittedEmail}</strong>{" "}
                зарегистрирован — мы отправили на него инструкцию по
                смене пароля. Ссылка действует 30 минут.
              </p>
              <p className="mt-4 text-sm text-muted">
                Не пришло? Проверьте папку «Спам» или{" "}
                <button
                  type="button"
                  onClick={() => setSubmittedEmail(null)}
                  className="font-semibold text-primary hover:text-primary-dark"
                >
                  попробуйте снова
                </button>
                .
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 animate-fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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
                      autoFocus
                      placeholder="you@company.ru"
                      className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                      Отправляем...
                    </>
                  ) : (
                    "Отправить ссылку для восстановления"
                  )}
                </button>
              </form>
            </>
          )}

          <p className="mt-4 text-center text-sm text-muted">
            Вспомнили пароль?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:text-primary-dark"
            >
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
