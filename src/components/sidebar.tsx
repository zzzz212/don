"use client";

// Persistent left navigation — the signature of a real platform shell.
// On lg+ renders as a sticky 240px column. Below lg, becomes a slide-in
// drawer controlled by the parent <AppShell> via mobileOpen.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Building2,
  MessageCircle,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { OrgSwitcher } from "@/components/org-switcher";
import { AccountMenu } from "@/components/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const t = useT();
  const user = session?.user;

  // Close the mobile drawer whenever the user navigates — otherwise
  // tapping a nav item leaves the drawer hanging open over the new page.
  useEffect(() => {
    onMobileClose();
    // pathname is the trigger; onMobileClose is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileClose]);

  const nav = [
    { name: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { name: t("nav.analyze"), href: "/analyze", icon: FileText },
    { name: t("nav.templates"), href: "/templates", icon: FolderOpen },
    { name: t("nav.counterparty"), href: "/counterparty", icon: Building2 },
    { name: t("nav.chat"), href: "/chat", icon: MessageCircle },
    { name: t("nav.network"), href: "/network", icon: Users },
  ];

  // The actual nav column markup — shared between the sticky desktop
  // aside and the mobile drawer panel.
  const body = (
    <>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <Link href="/" className="inline-flex">
          <Logo size={30} wordmark={t("brand.name")} />
        </Link>
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Закрыть меню"
          className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground lg:hidden"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {user && (
        <div className="border-b border-border px-3 py-3">
          <OrgSwitcher />
        </div>
      )}

      <nav
        aria-label={t("nav.primary")}
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        <ul className="space-y-0.5">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-foreground/[0.06] text-foreground"
                      : "text-muted hover:bg-surface hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex items-center justify-between border-t border-border px-3 py-3">
        <div className="min-w-0 flex-1">
          <AccountMenu />
        </div>
        <div className="flex items-center gap-0.5">
          <CommandPalette />
          <ThemeToggle />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: sticky aside that scrolls with the page. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
        {body}
      </aside>

      {/* Mobile: slide-in drawer overlay. Mounts on demand so a closed
          drawer doesn't sit in the layout tree. */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.primary")}
          className="fixed inset-0 z-50 lg:hidden"
        >
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={onMobileClose}
            className="absolute inset-0 bg-black/60"
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col border-r border-border bg-card shadow-xl">
            {body}
          </aside>
        </div>
      )}
    </>
  );
}
