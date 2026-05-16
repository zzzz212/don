"use client";

// Avatar dropdown — owns the "your account" half of the header chrome.
// Mirrors OrgSwitcher's interaction model so the two pills feel like a
// pair rather than two different widgets.
//
// Owns: profile name + email at the top, links to billing, security,
// admin (if applicable), and the logout action. Trial pill renders here
// — trials are per-user, not per-workspace, so the badge belongs next
// to the avatar rather than next to the workspace name.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { AnimatePresence, motion } from "motion/react";
import {
  CreditCard,
  Lock,
  LogOut,
  ShieldCheck,
  Sparkles,
  Settings,
  ChevronDown,
  Gift,
} from "lucide-react";

interface BillingSummary {
  // Accepts both new ("PRO_SOLO" / "PRO_TEAM") and legacy ("PRO") strings
  // from /api/account/plan — the chip falls back to the raw key if a
  // future tier slips through before we relabel here.
  plan: string;
  isTrial: boolean;
  trialDaysLeft: number | null;
}

const PLAN_LABEL: Record<string, string> = {
  FREE: "Старт",
  PRO_SOLO: "Pro Solo",
  PRO_TEAM: "Pro Team",
  BUSINESS: "Бизнес",
  PRO: "Pro Solo", // legacy
};

export function AccountMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const user = session?.user;
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "U";

  // Admin status — silent fail. Same probe OrgSwitcher uses; both are
  // cheap (one row each).
  useEffect(() => {
    if (!user) return;
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
  }, [user]);

  // Lightweight USER-scoped plan probe. Hits /api/account/plan, not
  // /api/billing/status — the latter requires OWNER on the active
  // workspace and would 403 for a MEMBER who's sitting in someone
  // else's org. Plan + trial belong to the user account itself.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/account/plan")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        setBilling({
          plan: json.plan ?? "FREE",
          isTrial: Boolean(json.isTrial),
          trialDaysLeft:
            typeof json.trialDaysLeft === "number" ? json.trialDaysLeft : null,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  if (!user) return null;

  const trialDaysWord = (n: number) =>
    n === 1 ? "день" : n >= 2 && n <= 4 ? "дня" : "дней";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Аккаунт: ${user.name || user.email}. Открыть меню`}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card pl-1 pr-1.5 py-1 transition-colors hover:bg-surface sm:gap-2 sm:pl-1 sm:pr-2"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg">
          {initials}
        </div>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-muted"
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 600, damping: 40, mass: 0.6 }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
          >
            {/* Profile header */}
            <div className="flex items-center gap-3 border-b border-border px-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-fg">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                {user.name && (
                  <p className="truncate text-sm font-semibold text-foreground">
                    {user.name}
                  </p>
                )}
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
            </div>

            {/* Plan / trial summary chip */}
            {billing && (
              <Link
                href="/billing"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-2 border-b border-border bg-surface/50 px-3 py-2.5 text-xs transition-colors hover:bg-surface"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      billing.plan === "FREE"
                        ? "bg-card text-muted"
                        : "bg-primary-light text-primary-dark"
                    }`}
                  >
                    {PLAN_LABEL[billing.plan] ?? billing.plan}
                  </span>
                  {billing.isTrial &&
                    typeof billing.trialDaysLeft === "number" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-warning-light px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                        <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                        Триал · {billing.trialDaysLeft}{" "}
                        {trialDaysWord(billing.trialDaysLeft)}
                      </span>
                    )}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                  Управлять
                </span>
              </Link>
            )}

            {/* Links */}
            <div className="p-1">
              <Link
                href="/billing"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface"
                role="menuitem"
              >
                <CreditCard className="h-4 w-4 text-muted" aria-hidden="true" />
                Тариф и биллинг
              </Link>
              <Link
                href="/account/security"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface"
                role="menuitem"
              >
                <Lock className="h-4 w-4 text-muted" aria-hidden="true" />
                Безопасность аккаунта
              </Link>
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface"
                role="menuitem"
              >
                <Settings className="h-4 w-4 text-muted" aria-hidden="true" />
                Настройки аккаунта
              </Link>
              <Link
                href="/referral"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface"
                role="menuitem"
              >
                <Gift className="h-4 w-4 text-muted" aria-hidden="true" />
                Пригласить друзей
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface"
                  role="menuitem"
                >
                  <ShieldCheck
                    className="h-4 w-4 text-warning"
                    aria-hidden="true"
                  />
                  Админ-панель
                </Link>
              )}
            </div>

            {/* Logout — divider + danger-tinted on hover */}
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-danger-light hover:text-danger"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Выйти из аккаунта
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
