"use client";

import { useState } from "react";
import { Button } from "@/components/button";

// Modal shown to an anonymous receiver on first visit so the other party
// can see their name on comments and votes. No email required — just a
// display name stored on the DealParticipant row.

export function IdentifyModal({
  token,
  onDone,
}: {
  token: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/deals/by-token/${token}/identify`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Не удалось сохранить имя");
      return;
    }
    onDone();
  };

  return (
    // foot-gun #43: fixed black/60 scrim — bg-foreground/40 inverts in dark
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 className="text-xl font-semibold tracking-tight mb-2">
          Представьтесь
        </h2>
        <p className="text-sm text-muted mb-4">
          Чтобы вторая сторона видела, кто прокомментировал, введите своё имя.
          Email не нужен.
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim() && !submitting) {
              void submit();
            }
          }}
          placeholder="Ваше имя"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          className="w-full rounded border border-border bg-background px-3 py-2 mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {error && <p className="text-danger text-sm mb-2">{error}</p>}
        <Button
          variant="primary"
          loading={submitting}
          onClick={() => void submit()}
          disabled={!name.trim() || submitting}
          className="w-full"
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
}
