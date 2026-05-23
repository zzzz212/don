"use client";

import { useEffect, useState, useCallback } from "react";
import { ClauseCard, type ClauseView } from "./clause-card";
import { IdentifyModal } from "./identify-modal";
import { StatusBar } from "./status-bar";

interface DealView {
  id: string;
  title: string;
  status: "ACTIVE" | "AGREED";
  owner: { name: string | null };
  document: { fileName: string; rawText: string };
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
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(data?.error ?? "Не удалось загрузить договор");
      return;
    }
    const data = (await res.json()) as DealResponse;
    setDeal(data.deal);
    setMyParticipantId(data.myParticipantId);
    setMyRole(data.myRole);
    // Identify modal only for anonymous receiver who hasn't named yet.
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
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data?.error ?? "Не удалось сохранить действие");
        return;
      }
      await fetchDeal();
    },
    [token, fetchDeal, myRole, deal]
  );

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">{error}</div>
    );
  }
  if (!deal) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center opacity-70">
        Загрузка…
      </div>
    );
  }

  const sender = deal.participants.find((p) => p.role === "SENDER");
  const counterpartName =
    sender?.name ?? deal.owner.name ?? "Отправитель";

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {deal.title}
          </h1>
          <p className="text-sm text-muted">От: {counterpartName}</p>
        </div>
        <div className="space-y-4 pb-16">
          {deal.clauses.map((c) => (
            <ClauseCard
              key={c.id}
              clause={c}
              myParticipantId={myParticipantId}
              onAction={onAction}
            />
          ))}
        </div>
      </div>
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
