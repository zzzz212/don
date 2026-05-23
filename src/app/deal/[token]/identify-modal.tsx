"use client";

import { useState } from "react";
import { Button } from "@/components/button";

// Modal shown to an anonymous receiver on first visit. Editorial styling
// matches the rest of the Deal Room: serif heading, hairline rules,
// understated. Foot-gun #43: fixed bg-black/60 scrim, never bg-foreground/40.

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-md">
      <div className="paper-grain w-full max-w-sm rounded-2xl border border-rule bg-card p-8 shadow-xl">
        <p className="text-[10px] uppercase tracking-[0.28em] text-ink-quiet">
          Прежде чем начать
        </p>
        <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
          Представьтесь
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-quiet">
          Чтобы вторая сторона видела, кто прокомментировал. Email и
          регистрация не требуются.
        </p>
        <div className="mt-6">
          <label
            htmlFor="deal-identify-name"
            className="block text-[10px] uppercase tracking-[0.22em] text-ink-quiet mb-1.5"
          >
            Ваше имя
          </label>
          <input
            id="deal-identify-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim() && !submitting) {
                void submit();
              }
            }}
            placeholder="Илья Петров"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="w-full border-0 border-b border-rule bg-transparent px-0 py-2 font-serif text-lg text-foreground placeholder:text-ink-quiet/50 focus:border-primary focus:outline-none focus:ring-0 transition-colors"
          />
        </div>
        {error && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <Button
          variant="primary"
          loading={submitting}
          onClick={() => void submit()}
          disabled={!name.trim() || submitting}
          className="mt-6 w-full"
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
}
