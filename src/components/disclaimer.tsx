import Link from "next/link";
import { BRAND } from "@/lib/legal-info";

export function Disclaimer() {
  return (
    <footer className="border-t border-border bg-surface/50 py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 text-center text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-relaxed">
            Сервис носит информационный характер и не является юридической
            консультацией. © {new Date().getFullYear()} {BRAND.name}
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link
              href="/privacy"
              className="hover:text-foreground hover:underline"
            >
              Конфиденциальность
            </Link>
            <Link
              href="/terms"
              className="hover:text-foreground hover:underline"
            >
              Соглашение
            </Link>
            <Link
              href="/offer"
              className="hover:text-foreground hover:underline"
            >
              Оферта
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
