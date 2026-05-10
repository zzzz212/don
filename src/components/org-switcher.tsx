"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Check,
  ChevronsUpDown,
  Plus,
  Settings,
  Users,
  Loader2,
  CreditCard,
  ShieldCheck,
  Lock,
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
  slug: string;
  /** Effective plan — already PRO if a trial is active. */
  plan: string;
  /** Plan that will apply once any active trial expires. */
  baselinePlan?: string;
  isTrial?: boolean;
  trialDaysLeft?: number | null;
  trialEndsAt?: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER";
  isActive: boolean;
  createdAt: string;
}

const PLAN_LABEL: Record<string, string> = {
  FREE: "Старт",
  PRO: "Про",
  BUSINESS: "Бизнес",
};

function planSubtitle(org: Organization): string {
  const planLabel = PLAN_LABEL[org.plan] ?? org.plan;
  if (org.isTrial && typeof org.trialDaysLeft === "number") {
    const days = org.trialDaysLeft;
    const word =
      days === 1
        ? "день"
        : days >= 2 && days <= 4
          ? "дня"
          : "дней";
    return `Триал · ${days} ${word} · ${org.role}`;
  }
  return `${planLabel} · ${org.role}`;
}

export function OrgSwitcher() {
  // useSession.update() is the only way to force NextAuth to re-run the
  // JWT callback with trigger === "update" — without it the JWT cookie
  // keeps the previous activeOrgId across window.location.reload().
  const { update } = useSession();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{
    activeOrgId: string;
    organizations: Organization[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Admin status — fired in parallel with the orgs fetch. Failure is
  // silent: not-admin is the safe default.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.isAdmin) setIsAdmin(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Load orgs on mount + on session changes.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/organizations")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Find which org is active. Falls back to the first workspace in the list
  // if the cached activeOrgId is somehow not present in `organizations` —
  // can happen if the server-side activeOrgId got out of sync (rare, but
  // returning null here would silently hide the whole switcher and leave
  // the user wondering where their workspaces went).
  const active =
    data?.organizations.find((o) => o.id === data.activeOrgId) ??
    data?.organizations[0] ??
    null;

  // Hard reload after switching workspace. router.refresh() + session
  // update would re-run RSC and the JWT, but the *client* cache (this
  // component's `data` state, the dashboard's documents list, the usage
  // widget, etc.) would still hold the previous workspace's values until
  // each component manually re-fetched. A full reload is what every B2B
  // SaaS does for org switches (Slack, Linear, Notion) and gives a
  // clean, predictable state on the new workspace.
  const handleSwitch = async (orgId: string) => {
    if (orgId === data?.activeOrgId) {
      setOpen(false);
      return;
    }
    setSwitching(orgId);

    let response: Response;
    try {
      response = await fetch(`/api/organizations/${orgId}/switch`, {
        method: "POST",
      });
    } catch (e) {
      console.error("[org-switcher] switch network error:", e);
      alert("Сеть недоступна. Попробуйте ещё раз.");
      setSwitching(null);
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      alert(err.error ?? "Не удалось переключить workspace");
      setSwitching(null);
      return;
    }

    // The /switch endpoint already wrote the new activeOrgId to the DB,
    // but the browser's JWT cookie still encodes the OLD value. A bare
    // window.location.reload() would re-send that old cookie and the
    // server would happily continue serving the previous workspace.
    // useSession.update() forces NextAuth to re-run its jwt callback with
    // trigger === "update", which re-reads activeOrgId from the DB and
    // re-signs the cookie. THEN the reload picks up the new context.
    try {
      await update();
    } catch (e) {
      // Non-fatal — the reload below will still re-fetch the JWT on the
      // next request. Worst case, the user sees the old workspace for one
      // page load and we recover on the next nav.
      console.warn("[org-switcher] session update failed:", e);
    }

    // Spinner deliberately stays on until the page reloads — clearing it
    // before the navigation kicks in causes a half-second visual flicker
    // back to the old name.
    window.location.reload();
  };

  const handleCreate = async () => {
    const name = window.prompt("Название нового workspace:");
    if (!name || name.trim().length < 2) return;
    setCreating(true);

    let createdId: string | null = null;
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        // Soft-redirect to /billing when the user hit the FREE workspace
        // limit — turning the error into a productive next step.
        if (data.code === "FREE_WORKSPACE_LIMIT") {
          const ok = window.confirm(
            `${data.error}\n\nПерейти в раздел оплаты?`
          );
          if (ok) {
            window.location.href = "/billing";
          }
          return;
        }
        alert(data.error ?? "Не удалось создать workspace");
        return;
      }
      const created = (await response.json()) as { id: string };
      createdId = created.id;
    } catch (e) {
      console.error("[org-switcher] create failed:", e);
      alert("Не удалось создать workspace");
      return;
    } finally {
      // Only clear the spinner if we're not about to switch+reload —
      // handleSwitch's reload will naturally clear all client state.
      if (!createdId) setCreating(false);
    }

    // Switch into the new workspace. handleSwitch reloads on success.
    await handleSwitch(createdId);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
        <span className="text-muted">Загрузка…</span>
      </div>
    );
  }

  if (!data || !active) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Workspace: ${active.name}. Открыть переключатель`}
        // Compact form on mobile (avatar + chevron only) so the header bar
        // doesn't overflow with the workspace name + plan + trial pill;
        // expands to the full label on sm+ where there is room.
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-1.5 py-1 text-sm font-medium transition-colors hover:bg-surface sm:max-w-[260px] sm:gap-2 sm:px-3 sm:py-1.5"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary-light text-xs font-bold text-primary-dark">
          {active.name.slice(0, 1).toUpperCase()}
        </div>
        <span className="hidden truncate text-foreground sm:inline">
          {active.name}
        </span>
        {active.isTrial && typeof active.trialDaysLeft === "number" && (
          <span className="hidden shrink-0 rounded-md bg-warning-light px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning sm:inline">
            Триал {active.trialDaysLeft}д
          </span>
        )}
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        >
          <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Ваши workspace
          </div>

          <ul className="max-h-72 overflow-y-auto py-1">
            {data.organizations.map((org) => (
              <li key={org.id}>
                <button
                  onClick={() => handleSwitch(org.id)}
                  disabled={switching === org.id}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface disabled:opacity-50"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-light text-xs font-bold text-primary-dark">
                    {org.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {org.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-muted">
                      {planSubtitle(org)}
                    </span>
                  </div>
                  {switching === org.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : org.isActive ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-border p-1">
            <Link
              href="/settings/organization"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface"
            >
              <Settings className="h-4 w-4 text-muted" />
              Настройки workspace
            </Link>
            <Link
              href="/billing"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface"
            >
              <CreditCard className="h-4 w-4 text-muted" />
              Тариф и биллинг
              {active.isTrial && typeof active.trialDaysLeft === "number" && (
                <span className="ml-auto rounded-md bg-warning-light px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                  Триал {active.trialDaysLeft}д
                </span>
              )}
            </Link>
            <Link
              href="/settings/organization#members"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface"
            >
              <Users className="h-4 w-4 text-muted" />
              Пригласить участника
            </Link>
            <Link
              href="/account/security"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface"
            >
              <Lock className="h-4 w-4 text-muted" />
              Безопасность аккаунта
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface"
              >
                <ShieldCheck className="h-4 w-4 text-warning" />
                Админ-панель
              </Link>
            )}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Plus className="h-4 w-4 text-muted" />
              )}
              Создать workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
