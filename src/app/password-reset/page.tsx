"use client";

import { Suspense, useId, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { confirmPasswordReset } from "@/lib/auth-actions";

function PasswordResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const formId = useId();
  const passId = `${formId}-pass`;
  const confirmId = `${formId}-confirm`;

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-light text-danger">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Ссылка некорректна
        </h2>
        <p className="mt-2 text-sm text-muted">
          В ссылке отсутствует токен сброса пароля. Запросите новую ссылку
          через форму восстановления.
        </p>
        <Link
          href="/forgot-password"
          className="mt-4 inline-block font-semibold text-primary hover:text-primary-dark"
        >
          Запросить новую ссылку
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("token", token);
    const result = await confirmPasswordReset(formData);

    if ("error" in result) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setIsLoading(false);
    // Auto-redirect to login after 2.5s — the user just changed their
    // password, they can sign in with the new one.
    setTimeout(() => router.push("/login"), 2500);
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Пароль обновлён
        </h2>
        <p className="mt-2 text-sm text-muted">
          Через несколько секунд вы будете перенаправлены на страницу входа.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block font-semibold text-primary hover:text-primary-dark"
        >
          Войти сейчас
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-lg bg-danger-light border border-danger/30 px-4 py-3 text-sm text-danger animate-fade-in"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor={passId}
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Новый пароль
          </label>
          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id={passId}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              autoFocus
              placeholder="Минимум 6 символов"
              className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor={confirmId}
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Повторите пароль
          </label>
          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id={confirmId}
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="Введите пароль ещё раз"
              className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Сохраняем...
            </>
          ) : (
            "Сохранить новый пароль"
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        <Link
          href="/login"
          className="font-semibold text-primary hover:text-primary-dark"
        >
          Вернуться ко входу
        </Link>
      </p>
    </div>
  );
}

export default function PasswordResetPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-surface/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Logo size={44} wordmark="Яксо" />
          </Link>
          <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight text-foreground">
            Новый пароль
          </h1>
          <p className="mt-2 text-sm text-muted">
            Придумайте надёжный пароль и сохраните.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted">
              Загрузка...
            </div>
          }
        >
          <PasswordResetForm />
        </Suspense>
      </div>
    </div>
  );
}
