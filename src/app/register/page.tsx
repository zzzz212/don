"use client";

import { useState, useEffect, useId } from "react";
import Link from "next/link";
import { Scale, Mail, Lock, User, Loader2, AlertCircle } from "lucide-react";
import { registerUser, loginWithGoogle, isGoogleAuthEnabled } from "@/lib/auth-actions";
import { computeFingerprint } from "@/lib/fingerprint";

export default function RegisterPage() {
  const formId = useId();
  const nameId = `${formId}-name`;
  const emailId = `${formId}-email`;
  const emailErrId = `${formId}-email-err`;
  const passwordId = `${formId}-password`;
  const passwordErrId = `${formId}-password-err`;
  const termsId = `${formId}-terms`;
  const formErrId = `${formId}-form-err`;

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [googleEnabled, setGoogleEnabled] = useState(false);
  // Two independent 152-ФЗ consents. The "general" one bundles TOS + offer
  // + processing of personal data (Art. 9). The "transborder" one is the
  // separate consent that Art. 12 requires whenever data is moved outside
  // RF — true here because the AI providers (Anthropic, Voyage AI) are
  // US-based. They MUST be two distinct checkboxes; the law does not let
  // us bundle cross-border transfer into the general consent.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedTransborder, setAcceptedTransborder] = useState(false);
  const transborderId = `${formId}-transborder`;
  // Best-effort device fingerprint — an anti-abuse signal sent with the
  // registration. Computed once after mount (needs the browser APIs).
  const [fingerprint, setFingerprint] = useState("");

  useEffect(() => {
    isGoogleAuthEnabled().then(setGoogleEnabled);
    setFingerprint(computeFingerprint());
  }, []);

  const validateField = (name: string, value: string) => {
    const errors: Record<string, string> = { ...fieldErrors };

    switch (name) {
      case "email":
        if (!value) {
          errors.email = "Введите email";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.email = "Некорректный формат email";
        } else {
          delete errors.email;
        }
        break;
      case "password":
        if (!value) {
          errors.password = "Введите пароль";
        } else if (value.length < 6) {
          errors.password = "Минимум 6 символов";
        } else {
          delete errors.password;
        }
        break;
    }

    setFieldErrors(errors);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (touched[name]) {
      validateField(name, value);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Validate all fields
    const errors: Record<string, string> = {};
    if (!email) errors.email = "Введите email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.email = "Некорректный формат email";
    if (!password) errors.password = "Введите пароль";
    else if (password.length < 6) errors.password = "Минимум 6 символов";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTouched({ email: true, password: true });
      return;
    }

    if (!acceptedTerms) {
      setError(
        "Чтобы продолжить, подтвердите согласие с условиями и политикой конфиденциальности."
      );
      return;
    }
    if (!acceptedTransborder) {
      setError(
        "Чтобы продолжить, подтвердите отдельное согласие на трансграничную передачу персональных данных."
      );
      return;
    }

    // Mirror both consents into the FormData payload so the server action
    // can validate them and write them to the audit log — the checkbox
    // <input>s themselves aren't named (they're React state), so without
    // this the server has no record of what was agreed to.
    formData.set("consent_general", "1");
    formData.set("consent_transborder", "1");
    formData.set("fingerprint", fingerprint);

    setIsLoading(true);

    const result = await registerUser(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full rounded-xl border bg-card py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:outline-none focus:ring-2 ${
      touched[field] && fieldErrors[field]
        ? "border-danger/40 focus:border-danger focus:ring-danger/20"
        : "border-border focus:border-primary focus:ring-primary/20"
    }`;

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
          {/* Error */}
          {error && (
            <div
              id={formErrId}
              role="alert"
              className="mb-4 flex items-center gap-2 rounded-lg bg-danger-light border border-danger/30 px-4 py-3 text-sm text-danger animate-fade-in"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Google OAuth */}
          {googleEnabled && (
            <>
              <form action={loginWithGoogle}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Зарегистрироваться через Google
                </button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-muted">или</span>
                </div>
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor={nameId}
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Имя
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  id={nameId}
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Иван Иванов"
                  className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor={emailId}
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Email <span className="text-danger" aria-hidden="true">*</span>
                <span className="sr-only"> (обязательно)</span>
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.ru"
                  aria-invalid={Boolean(touched.email && fieldErrors.email) || undefined}
                  aria-describedby={touched.email && fieldErrors.email ? emailErrId : undefined}
                  onBlur={handleBlur}
                  onChange={handleChange}
                  className={inputClass("email")}
                />
              </div>
              {touched.email && fieldErrors.email && (
                <p id={emailErrId} className="mt-1.5 text-xs text-danger animate-fade-in">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor={passwordId}
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Пароль <span className="text-danger" aria-hidden="true">*</span>
                <span className="sr-only"> (обязательно)</span>
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  id={passwordId}
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Минимум 6 символов"
                  aria-invalid={Boolean(touched.password && fieldErrors.password) || undefined}
                  aria-describedby={touched.password && fieldErrors.password ? passwordErrId : undefined}
                  onBlur={handleBlur}
                  onChange={handleChange}
                  className={inputClass("password")}
                />
              </div>
              {touched.password && fieldErrors.password && (
                <p id={passwordErrId} className="mt-1.5 text-xs text-danger animate-fade-in">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <label
              htmlFor={termsId}
              className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-muted"
            >
              <input
                id={termsId}
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary/30"
              />
              <span>
                Я принимаю{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="font-medium text-primary hover:underline"
                >
                  Пользовательское соглашение
                </Link>
                ,{" "}
                <Link
                  href="/offer"
                  target="_blank"
                  className="font-medium text-primary hover:underline"
                >
                  Публичную оферту
                </Link>{" "}
                и даю согласие на обработку персональных данных на территории
                Российской Федерации в соответствии с{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="font-medium text-primary hover:underline"
                >
                  Политикой конфиденциальности
                </Link>
                .
              </span>
            </label>

            {/* Separate 152-ФЗ Art. 12 consent — cross-border transfer is
                a distinct legal basis and CANNOT be bundled into the
                main acceptance above. AI inference and embeddings run on
                Anthropic and Voyage AI infrastructure in the United States;
                without this checkbox we'd be in violation. */}
            <label
              htmlFor={transborderId}
              className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-muted"
            >
              <input
                id={transborderId}
                type="checkbox"
                checked={acceptedTransborder}
                onChange={(e) => setAcceptedTransborder(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary/30"
              />
              <span>
                Даю отдельное согласие на трансграничную передачу персональных
                данных в США и другие страны для обработки сервисами AI-провайдеров
                (Anthropic Inc., Voyage AI Innovations Inc. и иными, перечисленными
                в{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="font-medium text-primary hover:underline"
                >
                  Политике конфиденциальности
                </Link>
                ) в соответствии со ст. 12 152-ФЗ.
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading || !acceptedTerms || !acceptedTransborder}
              aria-busy={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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

        <p className="mt-6 text-center text-xs text-muted leading-relaxed">
          Регистрируясь через Google, вы принимаете{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Пользовательское соглашение
          </Link>
          ,{" "}
          <Link href="/offer" className="underline hover:text-foreground">
            Публичную оферту
          </Link>{" "}
          и{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Политику конфиденциальности
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
