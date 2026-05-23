"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { AlertCircle, Loader2, Lock, Mail, User as UserIcon } from "lucide-react";

export default function AccountPage() {
  const { data: session, update } = useSession();
  const toast = useToast();
  const ids = useId();
  const nameId = `${ids}-name`;
  const emailId = `${ids}-email`;

  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
      setSavedName(session.user.name);
    }
  }, [session?.user?.name]);

  const dirty = name.trim() !== savedName.trim() && name.trim().length >= 2;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    setError(null);
    setSaving(true);
    try {
      const r = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(json.error ?? "Не удалось сохранить");
        return;
      }
      setSavedName(json.name ?? name.trim());
      // Refresh the JWT so the new name surfaces in Header / AccountMenu
      // without a hard reload.
      await update().catch(() => undefined);
      toast.success("Имя обновлено");
    } catch {
      setError("Сеть недоступна");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Настройки аккаунта"
        description="Имя и email — для всех ваших workspace. Тариф, биллинг и безопасность вынесены в отдельные разделы ниже."
      />
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

          {/* Profile */}
          <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Профиль
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label
                  htmlFor={nameId}
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Имя
                </label>
                <div className="relative">
                  <UserIcon
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    id={nameId}
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Иван Иванов"
                    minLength={2}
                    maxLength={80}
                    className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={emailId}
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    id={emailId}
                    type="email"
                    value={session?.user?.email ?? ""}
                    readOnly
                    aria-readonly="true"
                    className="w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-4 text-sm text-muted"
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  Email менять нельзя — он связан с вашими подписками и
                  историей. Чтобы поменять — напишите в поддержку.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {error}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!dirty || saving}
                  aria-busy={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Сохраняем…
                    </>
                  ) : (
                    "Сохранить"
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* Quick links to adjacent sections */}
          <section className="mb-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/account/security"
              className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-card-hover"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                <Lock className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Безопасность аккаунта
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  2FA-аутентификация, смена пароля
                </p>
              </div>
            </Link>
            <Link
              href="/billing"
              className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-card-hover"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                <UserIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Тариф и биллинг
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Подписка, оплаты, пробный период
                </p>
              </div>
            </Link>
          </section>
        </div>
      </AppShell>
  );
}
