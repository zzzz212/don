import Link from "next/link";
import { buttonClass } from "@/components/button";

// Editorial conversion card shown to the RECEIVER at peak intent — see
// shouldShowReceiverCta in src/lib/deal-cta.ts for the when. Pure
// navigation: links to /sample-report (value-first) or /register. No
// AI, no endpoint — sidesteps foot-gun #60 and keeps the page anon-safe.
// Never link to /analyze: it sits behind <AppShell> and 401s for anons.

export function ReceiverCta({ variant }: { variant: "inline" | "colophon" }) {
  return (
    <aside
      className={`rounded-2xl border border-primary/25 bg-primary-light/30 px-6 py-7 text-center ${
        variant === "colophon" ? "mt-12" : "mt-8"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-primary">
        Ваш ход
      </p>
      <p className="mt-2 font-serif text-xl font-semibold tracking-tight text-foreground">
        Понравилось, как Яксо разобрал этот договор?
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-quiet">
        Загрузите свой — без логина, за пару минут. Увидите риски и что
        исправить до подписания.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link href="/register" className={buttonClass({ size: "md" })}>
          Разобрать свой договор
        </Link>
        <Link
          href="/sample-report"
          className="text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
        >
          Сначала посмотреть пример →
        </Link>
      </div>
    </aside>
  );
}
