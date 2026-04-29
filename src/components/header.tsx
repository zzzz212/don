"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
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

const navigation = [
  { name: "Дашборд", href: "/dashboard", icon: LayoutDashboard },
  { name: "Анализ договора", href: "/analyze", icon: FileText },
  { name: "Шаблоны", href: "/templates", icon: FolderOpen },
  { name: "Контрагенты", href: "/counterparty", icon: Building2 },
  { name: "AI-консультант", href: "/chat", icon: MessageCircle },
];

export function Header() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();

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
    <header className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
              <Scale className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">
              ЮрИИст
            </span>
          </Link>

          {/* Desktop navigation */}
          {!isLanding && (
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-light text-primary-dark"
                        : "text-muted hover:text-foreground hover:bg-surface"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-3">
            {isLanding && !user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  Регистрация
                </Link>
              </div>
            ) : isLanding && user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-sm text-muted">
                  {user.name || user.email}
                </span>
                <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {initials}
                </div>
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  В кабинет
                </Link>
              </div>
            ) : (
              <>
                <span className="hidden sm:inline text-sm text-muted">
                  {user?.name || user?.email || "Бесплатный тариф"}
                </span>
                <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {initials}
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground transition-colors"
                  title="Выйти"
                >
                  <LogOut className="h-4 w-4" />
                </button>
                {/* Mobile hamburger */}
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground transition-colors"
                >
                  {mobileOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && !isLanding && (
        <div className="md:hidden border-t border-border bg-white animate-fade-in">
          <div className="px-4 py-3 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-light text-primary-dark"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
            <div className="border-t border-border pt-3 mt-2">
              <div className="flex items-center gap-3 px-3 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {initials}
                </div>
                <span className="text-sm text-foreground truncate">
                  {user?.name || user?.email || "Пользователь"}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
