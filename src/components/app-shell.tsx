"use client";

// Two-column platform shell: persistent left sidebar + main content
// column. The mobile top bar (with hamburger) lives in here so every
// authenticated page gets it for free; on lg+ the bar disappears and
// the sidebar takes over.

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Disclaimer } from "@/components/disclaimer";
import { Logo } from "@/components/logo";
import { AccountMenu } from "@/components/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useT } from "@/components/i18n-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useT();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar — visible only below lg, where the sidebar
            collapses into the drawer. */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/80 px-3 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Открыть меню"
            aria-expanded={mobileOpen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link href="/" className="inline-flex">
            <Logo size={28} wordmark={t("brand.name")} />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <AccountMenu />
          </div>
        </header>

        <main id="main-content" className="flex-1">
          {children}
        </main>

        <Disclaimer />
      </div>
    </div>
  );
}
