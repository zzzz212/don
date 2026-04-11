"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Scale, FileText, LayoutDashboard, FolderOpen } from "lucide-react";

const navigation = [
  { name: "Дашборд", href: "/dashboard", icon: LayoutDashboard },
  { name: "Анализ договора", href: "/analyze", icon: FileText },
  { name: "Шаблоны документов", href: "/templates", icon: FolderOpen },
];

export function Header() {
  const pathname = usePathname();
  const isLanding = pathname === "/";

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

          {!isLanding && (
            <nav className="hidden sm:flex items-center gap-1">
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

          {isLanding ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Войти
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-sm text-muted">
                Бесплатный тариф
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                U
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
