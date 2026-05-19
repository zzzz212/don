"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useToast } from "@/components/toast";
import {
  ShieldCheck,
  ShieldOff,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Download,
  ArrowLeft,
} from "lucide-react";

interface StatusResponse {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
}

interface SetupResponse {
  secret: string;
  otpauth: string;
  pending: boolean;
}

interface VerifyResponse {
  ok: boolean;
  recoveryCodes: string[];
  enabledAt: string;
}

type Phase =
  | "loading"
  | "off"
  | "setting-up"
  | "showing-recovery"
  | "on";

export default function AccountSecurityPage() {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [secretCopied, setSecretCopied] = useState(false);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [disableProof, setDisableProof] = useState({
    code: "",
    password: "",
    recoveryCode: "",
  });
  const [disableMode, setDisableMode] = useState<
    "code" | "password" | "recoveryCode"
  >("code");

  // Load status on mount.
  useEffect(() => {
    fetch("/api/account/2fa/status")
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!r.ok) {
          setError(`Ошибка ${r.status}`);
          setPhase("off");
          return;
        }
        const data = (await r.json()) as StatusResponse;
        setStatus(data);
        setPhase(data.enabled ? "on" : "off");
      })
      .catch(() => {
        setError("Сеть недоступна");
        setPhase("off");
      });
  }, []);

  // When entering setup phase, render the otpauth as a QR data URL on
  // the client (no roundtrip to a /qr route — the qrcode lib runs in
  // the browser).
  useEffect(() => {
    if (!setup?.otpauth) return;
    let cancelled = false;
    import("qrcode").then(async (mod) => {
      try {
        const dataUrl = await mod.default.toDataURL(setup.otpauth, {
          width: 240,
          margin: 1,
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setError("Не удалось сгенерировать QR");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [setup?.otpauth]);

  const handleStartSetup = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/account/2fa/setup", { method: "POST" });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(json.error ?? "Не удалось начать настройку");
        return;
      }
      setSetup(json as SetupResponse);
      setPhase("setting-up");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Введите 6-значный код");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/account/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(json.error ?? "Код не подходит");
        return;
      }
      const data = json as VerifyResponse;
      setRecoveryCodes(data.recoveryCodes);
      setPhase("showing-recovery");
      toast.success("2FA включена.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishSetup = () => {
    setRecoveryCodes([]);
    setSetup(null);
    setQrDataUrl(null);
    setCode("");
    setPhase("on");
    // Re-fetch status so the "on" panel shows correct recoveryCodesRemaining.
    fetch("/api/account/2fa/status")
      .then((r) => r.json())
      .then((data) => setStatus(data as StatusResponse))
      .catch(() => undefined);
  };

  const handleCopyRecovery = async () => {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setRecoveryCopied(true);
    setTimeout(() => setRecoveryCopied(false), 2000);
  };

  const handleDownloadRecovery = () => {
    const text = [
      "Резервные коды для восстановления доступа к Яксо",
      "===================================================",
      "",
      "Каждый код можно использовать ОДИН раз вместо",
      "обычного 2FA-кода если потеряете телефон.",
      "",
      "Храните в безопасном месте — менеджере паролей,",
      "сейфе или распечатайте и положите в ящик стола.",
      "",
      "Дата генерации: " + new Date().toLocaleString("ru-RU"),
      "",
      ...recoveryCodes,
      "",
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yakso-recovery-codes.txt`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleCopySecret = async () => {
    if (!setup?.secret) return;
    await navigator.clipboard.writeText(setup.secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const handleDisable = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      if (disableMode === "code") body.code = disableProof.code.trim();
      if (disableMode === "password") body.password = disableProof.password;
      if (disableMode === "recoveryCode")
        body.recoveryCode = disableProof.recoveryCode.trim();

      const r = await fetch("/api/account/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(json.error ?? "Не удалось отключить 2FA");
        return;
      }
      toast.success("2FA отключена.");
      setStatus({ enabled: false, enabledAt: null, recoveryCodesRemaining: 0 });
      setPhase("off");
      setDisableProof({ code: "", password: "", recoveryCode: "" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />К дашборду
          </Link>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
              <ShieldCheck className="h-5 w-5 text-primary-dark" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Безопасность аккаунта
              </h1>
              <p className="text-sm text-muted">
                Двухфакторная авторизация (2FA) защищает аккаунт даже
                если ваш пароль украден.
              </p>
            </div>
          </div>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {phase === "loading" && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          )}

          {phase === "off" && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-light text-warning">
                  <ShieldOff className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-foreground">
                    2FA отключена
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Сейчас в аккаунт можно зайти, зная только email и пароль.
                    Включение 2FA добавит шаг — 6-значный код из приложения
                    Google Authenticator, Authy, 1Password или Bitwarden.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartSetup}
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Включить 2FA
              </button>
            </section>
          )}

          {phase === "setting-up" && setup && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-bold text-foreground">
                Настройка 2FA
              </h2>
              <ol className="mb-6 list-inside list-decimal space-y-2 text-sm text-foreground">
                <li>
                  Откройте приложение-аутентификатор (Google Authenticator,
                  Authy, 1Password, Bitwarden).
                </li>
                <li>Отсканируйте QR-код или введите ключ вручную.</li>
                <li>Введите код, который покажет приложение.</li>
              </ol>

              <div className="mb-6 flex flex-col items-center gap-4 rounded-xl border border-border bg-surface/30 p-6">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR-код для 2FA"
                    width={240}
                    height={240}
                    className="rounded-lg"
                  />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-muted" />
                )}
                <div className="w-full text-center">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                    Или ключ вручную:
                  </p>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="inline-flex items-center gap-2 rounded-md bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-surface"
                    title="Скопировать ключ"
                  >
                    {setup.secret}
                    {secretCopied ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Код из приложения
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123 456"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  maxLength={6}
                  className="w-full rounded-xl border border-border bg-card py-3 px-4 text-center text-lg font-mono tracking-widest text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPhase("off");
                    setSetup(null);
                    setCode("");
                    setError(null);
                  }}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={code.length !== 6 || submitting}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Подтвердить
                </button>
              </div>
            </section>
          )}

          {phase === "showing-recovery" && (
            <section className="rounded-2xl border border-warning/30 bg-warning-light p-6">
              <h2 className="mb-2 text-lg font-bold text-warning">
                Сохраните резервные коды
              </h2>
              <p className="mb-4 text-sm text-warning/90">
                <strong>Эти коды показываются один раз.</strong> Каждый код
                можно использовать ОДНОКРАТНО вместо обычного 2FA-кода если
                потеряете телефон. Сохраните в надёжном месте — например,
                в менеджере паролей.
              </p>
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-card p-4 font-mono text-sm">
                {recoveryCodes.map((c) => (
                  <div key={c} className="px-2 py-1 text-foreground">
                    {c}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyRecovery}
                  className="flex items-center gap-2 rounded-xl border border-warning/40 bg-card px-4 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning-light"
                >
                  {recoveryCopied ? (
                    <>
                      <Check className="h-4 w-4 text-success" />
                      Скопировано
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Копировать
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadRecovery}
                  className="flex items-center gap-2 rounded-xl border border-warning/40 bg-card px-4 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning-light"
                >
                  <Download className="h-4 w-4" />
                  Скачать .txt
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handleFinishSetup}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  Я сохранил коды
                </button>
              </div>
            </section>
          )}

          {phase === "on" && status && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-success/30 bg-success/10 p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/20 text-success">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-success">
                      2FA включена
                    </h2>
                    <p className="mt-1 text-sm text-success/90">
                      {status.enabledAt &&
                        `Активирована ${new Date(status.enabledAt).toLocaleDateString("ru-RU")}. `}
                      Резервных кодов осталось:{" "}
                      <strong>{status.recoveryCodesRemaining}</strong>
                      {status.recoveryCodesRemaining < 3 && status.recoveryCodesRemaining > 0 &&
                        " — рекомендуется отключить и заново включить 2FA, чтобы получить новый набор."}
                      {status.recoveryCodesRemaining === 0 &&
                        " — все коды использованы. Отключите и заново включите 2FA, чтобы сгенерировать новые."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
                  Отключить 2FA
                </h3>
                <p className="mb-4 text-sm text-muted">
                  Подтвердите действие одним из способов: 6-значный код,
                  пароль или резервный код.
                </p>

                <div className="mb-3 flex flex-wrap gap-2">
                  {(["code", "password", "recoveryCode"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDisableMode(m)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        disableMode === m
                          ? "bg-primary text-white"
                          : "border border-border bg-card text-foreground hover:bg-surface"
                      }`}
                    >
                      {m === "code"
                        ? "TOTP-код"
                        : m === "password"
                          ? "Пароль"
                          : "Резервный код"}
                    </button>
                  ))}
                </div>

                {disableMode === "code" && (
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={disableProof.code}
                    onChange={(e) =>
                      setDisableProof((p) => ({
                        ...p,
                        code: e.target.value.replace(/\D/g, "").slice(0, 6),
                      }))
                    }
                    maxLength={6}
                    className="mb-3 w-full rounded-xl border border-border bg-card py-2 px-3 font-mono text-center tracking-widest focus:border-primary focus:outline-none"
                  />
                )}
                {disableMode === "password" && (
                  <input
                    type="password"
                    placeholder="Текущий пароль"
                    value={disableProof.password}
                    onChange={(e) =>
                      setDisableProof((p) => ({
                        ...p,
                        password: e.target.value,
                      }))
                    }
                    className="mb-3 w-full rounded-xl border border-border bg-card py-2 px-3 focus:border-primary focus:outline-none"
                  />
                )}
                {disableMode === "recoveryCode" && (
                  <input
                    type="text"
                    placeholder="a1b2-c3d4"
                    value={disableProof.recoveryCode}
                    onChange={(e) =>
                      setDisableProof((p) => ({
                        ...p,
                        recoveryCode: e.target.value,
                      }))
                    }
                    className="mb-3 w-full rounded-xl border border-border bg-card py-2 px-3 font-mono focus:border-primary focus:outline-none"
                  />
                )}

                <button
                  type="button"
                  onClick={handleDisable}
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-xl border border-danger/40 bg-card px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-light disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldOff className="h-4 w-4" />
                  )}
                  Отключить 2FA
                </button>
              </div>
            </section>
          )}
        </div>
      </AppShell>
  );
}
