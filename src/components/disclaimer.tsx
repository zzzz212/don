"use client";

import Link from "next/link";
import { BRAND } from "@/lib/legal-info";
import { useT } from "@/components/i18n-provider";

export function Disclaimer() {
  const t = useT();
  return (
    <footer className="border-t border-border bg-surface/50 py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 text-center text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-relaxed">
            {t("disclaimer.notLegalAdvice")} © {new Date().getFullYear()}{" "}
            {BRAND.name}
          </p>
          <nav
            aria-label="Юридические ссылки"
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
          >
            <Link
              href="/blog"
              className="hover:text-foreground hover:underline"
            >
              Журнал
            </Link>
            <Link
              href="/help"
              className="hover:text-foreground hover:underline"
            >
              Помощь
            </Link>
            <Link
              href="/privacy"
              className="hover:text-foreground hover:underline"
            >
              {t("disclaimer.privacy")}
            </Link>
            <Link
              href="/terms"
              className="hover:text-foreground hover:underline"
            >
              {t("disclaimer.terms")}
            </Link>
            <Link
              href="/offer"
              className="hover:text-foreground hover:underline"
            >
              {t("disclaimer.offer")}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
