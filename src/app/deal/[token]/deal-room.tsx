"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { Skeleton } from "@/components/skeleton";
import { ClauseSkeleton } from "./clause-skeleton";
import { ClauseCard, type ClauseView } from "./clause-card";
import { IdentifyModal } from "./identify-modal";
import { StatusBar } from "./status-bar";
import {
  reconcileClauseStatus,
  type ClauseActionInput,
} from "@/lib/deal-status";
import { buttonClass } from "@/components/button";
import { ReceiverCta } from "./receiver-cta";
import { shouldShowReceiverCta } from "@/lib/deal-cta";
import { formatLastSeen, isOnline } from "@/lib/deal-presence";
import { mergeDealClauses } from "@/lib/deal-merge";

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
    lastSeenAt: string | null;
  }>;
  clauses: ClauseView[];
}

interface DealResponse {
  deal: DealView;
  myParticipantId: string | null;
  myRole: "SENDER" | "RECEIVER" | null;
}

function errorMessageFor(
  code: number,
  serverMessage?: string
): {
  code: number;
  title: string;
  body: string;
  recoverable: boolean;
} {
  if (code === 404 || code === 410) {
    return {
      code,
      title: "Ссылка устарела или удалена",
      body: "Свяжитесь с отправителем — он перевыпустит приглашение.",
      recoverable: false,
    };
  }
  if (code === 429) {
    return {
      code,
      title: "Слишком много действий подряд",
      body: "Подождите минуту и попробуйте снова.",
      recoverable: true,
    };
  }
  return {
    code,
    title: "Не удалось открыть",
    body: serverMessage ?? "Попробуйте обновить страницу.",
    recoverable: true,
  };
}

export function DealRoom({ token }: { token: string }) {
  const [deal, setDeal] = useState<DealView | null>(null);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<"SENDER" | "RECEIVER" | null>(null);
  const [errorState, setErrorState] = useState<{
    code: number;
    title: string;
    body: string;
    recoverable: boolean;
  } | null>(null);
  const [needsIdentify, setNeedsIdentify] = useState(false);

  const fetchDeal = useCallback(async () => {
    const res = await fetch(`/api/deals/by-token/${token}`, {
      credentials: "include",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorState(errorMessageFor(res.status, data?.error));
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

  // Background poll: refetch and MERGE (not blind-replace) so optimistic
  // in-flight actions survive until the server echoes them. Distinct from
  // fetchDeal (which canonicalises after the local user's own action and
  // may surface errors / identify) — the poll stays silent on transient
  // failures and never opens the identify modal.
  const pollDeal = useCallback(async () => {
    try {
      const res = await fetch(`/api/deals/by-token/${token}`, {
        credentials: "include",
      });
      if (!res.ok) return; // stay silent on transient poll failures
      const data = (await res.json()) as DealResponse;
      setDeal((current) => {
        if (!current) return data.deal;
        const senderId =
          current.participants.find((p) => p.role === "SENDER")?.id ?? "";
        const receiverId =
          current.participants.find((p) => p.role === "RECEIVER")?.id ?? "";
        return {
          ...data.deal,
          clauses: mergeDealClauses(
            current.clauses,
            data.deal.clauses,
            senderId,
            receiverId
          ),
        };
      });
    } catch {
      // ignore — next tick retries
    }
  }, [token]);

  useEffect(() => {
    void fetchDeal();
  }, [fetchDeal]);

  // Auto-refresh while the tab is visible and the deal is still open.
  // Pauses on AGREED (nothing more to reconcile) and whenever the tab is
  // hidden (avoids hammering deep-include GETs from background tabs).
  useEffect(() => {
    if (!deal || deal.status === "AGREED") return;
    let handle: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (handle) return;
      handle = setInterval(() => {
        void pollDeal();
      }, 4_500);
    };
    const stop = () => {
      if (handle) {
        clearInterval(handle);
        handle = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [deal, pollDeal]);

  const onAction = useCallback(
    async (
      clauseId: string,
      kind: "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT" | "ACCEPT_PROPOSAL",
      body?: string,
      proposalId?: string
    ) => {
      if (!deal || !myParticipantId) return;

      // Snapshot before any mutation so we can rollback on POST failure.
      const snapshot = deal;

      // Build the synthetic action — same shape the server will produce
      // when we refetch. Optimistic id is prefixed so it can't collide
      // with real cuids.
      const optimistic = {
        id: `optimistic-${Date.now()}`,
        kind,
        body: body ?? null,
        proposalId: proposalId ?? null,
        createdAt: new Date().toISOString(),
        participant: {
          id: myParticipantId,
          role: myRole ?? ("RECEIVER" as const),
          guestName: null,
        },
      };

      // Identify SENDER + RECEIVER ids for status reconciliation.
      const senderId =
        deal.participants.find((p) => p.role === "SENDER")?.id ?? "";
      const receiverId =
        deal.participants.find((p) => p.role === "RECEIVER")?.id ?? "";

      // Mutate the deal locally — append the synthetic action and
      // recompute the clause status.
      setDeal({
        ...deal,
        clauses: deal.clauses.map((c) => {
          if (c.id !== clauseId) return c;
          const newActions = [...c.actions, optimistic];
          // reconcileClauseStatus takes ClauseActionInput[] (participantId,
          // kind, createdAt). Map the rich action shape into that.
          const reconciled: ClauseActionInput[] = newActions.map((a) => ({
            id: a.id,
            participantId: a.participant.id,
            kind: a.kind as ClauseActionInput["kind"],
            body: a.body,
            proposalId: a.proposalId ?? null,
            createdAt: new Date(a.createdAt),
          }));
          return {
            ...c,
            actions: newActions,
            status: reconcileClauseStatus(reconciled, senderId, receiverId),
          };
        }),
      });

      // POST in the background.
      const url =
        myRole === "SENDER"
          ? `/api/deals/${deal.id}/clauses/${clauseId}/actions`
          : `/api/deals/by-token/${token}/clauses/${clauseId}/actions`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, body, proposalId }),
      });

      if (!res.ok) {
        // Rollback to pre-mutation state, surface the error.
        setDeal(snapshot);
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorState(errorMessageFor(res.status, data?.error));
        return;
      }

      // Server accepted — canonicalise (timestamps, ids, etc.).
      await fetchDeal();
    },
    [deal, myParticipantId, myRole, token, fetchDeal]
  );

  if (errorState) {
    return (
      <main className="mx-auto max-w-md px-5 py-24 text-center sm:px-10">
        <p className="text-[10px] uppercase tracking-[0.28em] text-ink-quiet">
          Что-то не так
        </p>
        <p className="mt-3 font-serif text-2xl font-semibold tracking-tight text-foreground">
          {errorState.title}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-quiet">
          {errorState.body}
        </p>
        {errorState.recoverable && (
          <button
            type="button"
            onClick={() => {
              setErrorState(null);
              void fetchDeal();
            }}
            className={`${buttonClass({ variant: "ghost" })} mt-6`}
          >
            Обновить
          </button>
        )}
      </main>
    );
  }
  if (!deal) {
    return (
      <main className="paper-grain mx-auto max-w-5xl px-5 pt-8 sm:px-10">
        <header className="border-b border-rule pb-8 mb-12">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-3 h-8 w-3/4" />
          <Skeleton className="mt-6 h-3 w-1/2" />
        </header>
        <div className="space-y-10">
          {[0, 1, 2].map((i) => (
            <ClauseSkeleton key={i} />
          ))}
        </div>
      </main>
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

  // Perspective chip — communicates which side of the deal the viewer is on.
  const me = myParticipantId
    ? deal.participants.find((p) => p.id === myParticipantId)
    : null;
  const chipLabel: string | null =
    myRole === "SENDER"
      ? "Вы — отправитель"
      : myRole === "RECEIVER"
        ? me?.name
          ? `Открыто как ${me.name} (получатель)`
          : "Открыто как гость"
        : null;
  const chipTone =
    myRole === "SENDER" ? "bg-primary" : "bg-accent"; // terracotta for sender, sage for receiver

  // Has the local receiver cast at least one AGREE/DISAGREE on any clause?
  // Drives the post-vote CTA peak (see src/lib/deal-cta.ts).
  const hasVoted = myParticipantId
    ? deal.clauses.some((c) =>
        c.actions.some(
          (a) =>
            a.participant.id === myParticipantId &&
            (a.kind === "AGREE" || a.kind === "DISAGREE")
        )
      )
    : false;
  const showReceiverCta = shouldShowReceiverCta({
    myRole,
    hasVoted,
    dealStatus: deal.status,
  });

  // Counterparty presence — the side the viewer is NOT. Soft signal from
  // lastSeenAt (lags by the poll interval). null when never opened.
  const counterpartyRole: "SENDER" | "RECEIVER" =
    myRole === "RECEIVER" ? "SENDER" : "RECEIVER";
  const counterparty = deal.participants.find(
    (p) => p.role === counterpartyRole
  );
  // Date.now() in render trips react-hooks/purity, but the presence label
  // is a soft, lagged signal that the 4.5s poll re-renders anyway — the
  // render-time instability is benign and never observable to the user.
  // eslint-disable-next-line react-hooks/purity
  const presenceNow = Date.now();
  const presenceLabel = formatLastSeen(
    counterparty?.lastSeenAt ?? null,
    presenceNow
  );
  const counterpartyOnline = isOnline(
    counterparty?.lastSeenAt ?? null,
    presenceNow
  );

  return (
    <>
      <main className="paper-grain mx-auto max-w-5xl px-5 pb-32 pt-8 sm:px-10">
        {/* ── Title page ───────────────────────────────────────────── */}
        <header className="border-b border-rule pb-8 mb-12">
          <p className="text-[11px] uppercase tracking-[0.28em] text-ink-quiet">
            Переговоры по договору
          </p>
          {chipLabel && (
            <p className="mt-2 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary">
              <span
                aria-hidden="true"
                className={`inline-block h-1.5 w-1.5 rounded-full ${chipTone}`}
              />
              {chipLabel}
            </p>
          )}
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

          {presenceLabel && (
            <p className="mt-2 inline-flex items-center gap-2 text-[11px] italic text-ink-quiet">
              <span
                aria-hidden="true"
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  counterpartyOnline ? "bg-accent" : "bg-ink-quiet/40"
                }`}
              />
              {counterpartyRole === "SENDER" ? "Отправитель" : "Контрагент"}{" "}
              {presenceLabel}
            </p>
          )}
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
                myRole={myRole}
                dealId={deal.id}
                token={token}
                onAction={onAction}
              />
            </motion.div>
          ))}
        </div>

        {showReceiverCta && deal.status !== "AGREED" && (
          <ReceiverCta variant="inline" />
        )}

        {showReceiverCta && deal.status === "AGREED" && (
          <ReceiverCta variant="colophon" />
        )}

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
