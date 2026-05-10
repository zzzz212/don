"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { OrgSwitcher } from "@/components/org-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/components/i18n-provider";
import {
  Scale,
  FileText,
  LayoutDashboard,
  FolderOpen,
  MessageCircle,
  Menu,
  X,
  LogOut,
  Building2,
} from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const t = useT();

  const navigation = [
    { name: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { name: t("nav.analyze"), href: "/analyze", icon: FileText },
    { name: t("nav.templates"), href: "/templates", icon: FolderOpen },
    { name: t("nav.counterparty"), href: "/counterparty", icon: Building2 },
    { name: t("nav.chat"), href: "/chat", icon: MessageCircle },
  ];

  const user = session?.user;
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-fg">
                <Scale className="h-5 w-5" aria-hidden="true" />
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground">
                {t("brand.name")}
              </span>
            </Link>
            {!isLanding && user && <OrgSwitcher />}
          </div>

          {/* Desktop navigation */}
          {!isLanding && (
            <nav
              className="hidden md:flex items-center gap-1"
              aria-label={t("nav.primary")}
            >
              {navigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-light text-primary-dark"
                        : "text-muted hover:text-foreground hover:bg-surface"
                    )}
                  >
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            {isLanding && !user ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <ThemeToggle />
                <LanguageToggle />
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface sm:px-4"
                >
                  {t("auth.login")}
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark sm:px-4"
                >
                  {t("auth.register")}
                </Link>
              </div>
            ) : isLanding && user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <ThemeToggle />
                <LanguageToggle />
                <span className="hidden md:inline text-sm text-muted truncate max-w-[12rem]">
                  {user.name || user.email}
                </span>
                <div
                  className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg"
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark sm:px-4"
                >
                  {t("nav.openApp")}
                </Link>
              </div>
            ) : (
              <>
                <span className="hidden lg:inline text-sm text-muted truncate max-w-[14rem]">
                  {user?.name || user?.email || t("plan.free")}
                </span>
                <div
                  className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg"
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <ThemeToggle />
                <LanguageToggle />
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  aria-label={t("auth.logout")}
                  title={t("auth.logout")}
                  className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground transition-colors"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
                {/* Mobile hamburger */}
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  aria-label={mobileOpen ? t("nav.menuClose") : t("nav.menuOpen")}
                  aria-expanded={mobileOpen}
                  aria-controls="mobile-nav"
                  className="md:hidden flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground transition-colors"
                >
                  {mobileOpen ? (
                    <X className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && !isLanding && (
        <div
          id="mobile-nav"
          className="md:hidden border-t border-border bg-card animate-fade-in"
        >
          <div className="px-4 py-3 space-y-1">
            {/* Workspace switcher in mobile menu — clicking it opens its own
                dropdown, then the user can switch / create / open settings. */}
            {user && (
              <div className="pb-3 mb-2 border-b border-border">
                <OrgSwitcher />
              </div>
            )}

            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-light text-primary-dark"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  )}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  {item.name}
                </Link>
              );
            })}
            <div className="border-t border-border pt-3 mt-2 space-y-1">
              <div className="flex items-center gap-3 px-3 mb-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg"
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <span className="text-sm text-foreground truncate">
                  {user?.name || user?.email || t("plan.free")}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted hover:bg-surface hover:text-foreground transition-colors"
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
                {t("auth.logout")}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
