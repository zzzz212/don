"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { ClauseCard, type ClauseView } from "./clause-card";
import { IdentifyModal } from "./identify-modal";
import { StatusBar } from "./status-bar";

interface DealView {
  id: string;
  title: string;
  status: "ACTIVE" | "AGREED";
  owner: { name: string | null };
  document: { fileName: string };
  participants: Array<{
    id: string;
    role: "SENDER" | "RECEIVER";
    name: string | null;
  }>;
  clauses: ClauseView[];
}

interface DealResponse {
  deal: DealView;
  myParticipantId: string | null;
  myRole: "SENDER" | "RECEIVER" | null;
}

export function DealRoom({ token }: { token: string }) {
  const [deal, setDeal] = useState<DealView | null>(null);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<"SENDER" | "RECEIVER" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsIdentify, setNeedsIdentify] = useState(false);

  const fetchDeal = useCallback(async () => {
    const res = await fetch(`/api/deals/by-token/${token}`, {
      credentials: "include",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data?.error ?? "Не удалось загрузить договор");
      return;
    }
    const data = (await res.json()) as DealResponse;
    setDeal(data.deal);
    setMyParticipantId(data.myParticipantId);
    setMyRole(data.myRole);
    if (data.myRole === "RECEIVER") {
      const me = data.deal.participants.find(
        (p) => p.id === data.myParticipantId
      );
      if (me && !me.name) setNeedsIdentify(true);
    }
  }, [token]);

  useEffect(() => {
    void fetchDeal();
  }, [fetchDeal]);

  const onAction = useCallback(
    async (
      clauseId: string,
      kind: "AGREE" | "DISAGREE" | "COMMENT",
      body?: string
    ) => {
      const url =
        myRole === "SENDER" && deal
          ? `/api/deals/${deal.id}/clauses/${clauseId}/actions`
          : `/api/deals/by-token/${token}/clauses/${clauseId}/actions`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data?.error ?? "Не удалось сохранить действие");
        return;
      }
      await fetchDeal();
    },
    [token, fetchDeal, myRole, deal]
  );

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-serif text-2xl font-semibold text-foreground">
          Не удалось открыть
        </p>
        <p className="mt-2 text-sm text-ink-quiet">{error}</p>
      </div>
    );
  }
  if (!deal) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-ink-quiet">
          Открываем договор
        </p>
      </div>
    );
  }

  const sender = deal.participants.find((p) => p.role === "SENDER");
  const receiver = deal.participants.find((p) => p.role === "RECEIVER");
  const senderName = sender?.name ?? deal.owner.name ?? "Отправитель";
  const receiverName = receiver?.name ?? "Контрагент";

  // Counts for the title-page summary line.
  const agreedCount = deal.clauses.filter((c) => c.status === "AGREED").length;
  const disputedCount = deal.clauses.filter((c) => c.status === "DISPUTED")
    .length;

  return (
    <>
      <main className="paper-grain mx-auto max-w-5xl px-5 pb-32 pt-8 sm:px-10">
        {/* ── Title page ───────────────────────────────────────────── */}
        <header className="border-b border-rule pb-8 mb-12">
          <p className="text-[11px] uppercase tracking-[0.28em] text-ink-quiet">
            Переговоры по договору
          </p>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {deal.title}
          </h1>

          {/* Two-party header — sender on the left, receiver on the right,
              centre rule. Reads like a contract title page. */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
            <Party
              role="Отправитель"
              name={senderName}
              alignment="start"
            />
            <div
              aria-hidden="true"
              className="hidden sm:block mx-auto text-ink-quiet/40 font-serif text-3xl leading-none translate-y-1"
            >
              ⌇
            </div>
            <Party
              role="Получатель"
              name={receiverName}
              alignment="end"
            />
          </div>

          {/* Progress line — small print, italic, like a footer note. */}
          <p className="mt-6 text-xs italic text-ink-quiet">
            {deal.clauses.length}{" "}
            {deal.clauses.length === 1
              ? "пункт"
              : deal.clauses.length < 5
                ? "пункта"
                : "пунктов"}{" "}
            на обсуждении · {agreedCount} согласовано
            {disputedCount > 0 && ` · ${disputedCount} спорных`}
            {deal.status === "AGREED" && " · договор согласован полностью"}
          </p>
        </header>

        {/* ── Clauses — staggered fade-in, like turning the pages of a
              contract. Reduced-motion users get instant render via
              motion/react's built-in respect for prefers-reduced-motion. */}
        <div className="space-y-10">
          {deal.clauses.map((c, idx) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: Math.min(idx * 0.05, 0.5),
                duration: 0.35,
                ease: [0.21, 0.47, 0.32, 0.98],
              }}
            >
              <ClauseCard
                clause={c}
                myParticipantId={myParticipantId}
                onAction={onAction}
              />
            </motion.div>
          ))}
        </div>

        {/* Closing colophon — tiny brand mark at the bottom of the
            document, like a printer's mark on a legal opinion. */}
        <footer className="mt-20 text-center">
          <span
            aria-hidden="true"
            className="text-ink-quiet/30 font-serif text-xl"
          >
            ❦
          </span>
          <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-ink-quiet/60">
            Яксо · Переговорная для договоров
          </p>
        </footer>
      </main>

      <StatusBar clauses={deal.clauses} status={deal.status} />

      {needsIdentify && myParticipantId && (
        <IdentifyModal
          token={token}
          onDone={() => {
            setNeedsIdentify(false);
            void fetchDeal();
          }}
        />
      )}
    </>
  );
}

function Party({
  role,
  name,
  alignment,
}: {
  role: string;
  name: string;
  alignment: "start" | "end";
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "—";
  return (
    <div
      className={`flex items-center gap-3 ${alignment === "end" ? "sm:justify-end" : ""}`}
    >
      {alignment === "start" && (
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rule font-serif text-base font-semibold text-foreground/70"
        >
          {initial}
        </div>
      )}
      <div className={alignment === "end" ? "text-right" : ""}>
        <p className="text-[10px] uppercase tracking-[0.22em] text-ink-quiet">
          {role}
        </p>
        <p className="mt-1 font-serif text-base font-medium text-foreground">
          {name}
        </p>
      </div>
      {alignment === "end" && (
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rule font-serif text-base font-semibold text-foreground/70"
        >
          {initial}
        </div>
      )}
    </div>
  );
}
