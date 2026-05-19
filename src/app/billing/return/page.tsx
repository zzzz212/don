// User lands here after the ЮKassa hosted payment page. ЮKassa appends
// no parameters by default, so we don't have a payment id in the URL —
// we just show a "we're checking your payment" screen and the user can
// continue to /billing to see the latest state. The webhook is the
// source of truth; the UI only needs to be patient.

import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export default function BillingReturnPage() {
  return (
    <AppShell>
      <div className="mx-auto mt-12 w-full max-w-lg rounded-2xl border border-border bg-card p-10 shadow-sm text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Платёж обрабатывается
          </h1>
          <p className="mt-3 text-base text-muted">
            Мы получили подтверждение от ЮKassa. Тариф активируется
            автоматически в течение нескольких секунд после получения
            уведомления о платеже.
          </p>
          <p className="mt-2 text-sm text-muted">
            Кассовый чек по 54-ФЗ придёт отдельным письмом.
          </p>
          <Link
            href="/billing"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Перейти в биллинг
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </AppShell>
  );
}
