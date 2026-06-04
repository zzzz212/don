"use client";

// "Send as Deal" — opens the Deal Room flow from /report. Editorial
// styling matches IdentifyModal and the Deal Room itself: paper-grain
// card, hairline rules, bottom-border inputs, no jewel-tone accents.
// Foot-gun #43: fixed bg-black/60 scrim, never bg-foreground/40.

import { useState } from "react";
import { Button, buttonClass } from "@/components/button";
import { buildShareLinks } from "@/lib/deals-share";

export function SendAsDeal({
  documentId,
  onClose,
}: {
  documentId: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ url: string; emailSent: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentId,
          counterpartyEmail: email.trim(),
          counterpartyName: name.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string })?.error ?? "Не удалось создать сделку"
        );
        return;
      }
      const data = (await res.json()) as { url: string; emailSent?: boolean };
      setResult({ url: data.url, emailSent: Boolean(data.emailSent) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-md px-4 py-6 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Отправить договор второй стороне"
        onClick={(e) => e.stopPropagation()}
        className="paper-grain flex w-full max-w-md flex-col rounded-2xl border border-rule bg-card p-8 shadow-xl"
      >
        {result ? (
          /* ── Success state ─────────────────────────────────────── */
          (() => {
            // Share-sheet links are built from the returned deal URL. The
            // title is the contract name typed by the sender (falls back
            // to a generic label inside buildShareLinks when blank).
            const share = buildShareLinks(result.url, name.trim());
            return (
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-ink-quiet">
                  {result.emailSent ? "Письмо отправлено" : "Ссылка готова"}
                </p>
                <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
                  Сделка создана
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-quiet">
                  {result.emailSent
                    ? "Контрагент получит письмо со ссылкой. Если хотите — передайте её и напрямую."
                    : "Скопируйте ссылку или отправьте её контрагенту в мессенджере. Логин ему не понадобится."}
                </p>
                <div className="mt-6 border border-rule bg-surface/40 px-4 py-3 font-mono text-[12px] leading-[1.5] text-foreground/80 break-all rounded-md">
                  {result.url}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(result.url);
                    }}
                    className={buttonClass({ variant: "primary" })}
                  >
                    Скопировать ссылку
                  </button>
                  <a
                    href={share.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass({ variant: "ghost" })}
                  >
                    Telegram
                  </a>
                  <a
                    href={share.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass({ variant: "ghost" })}
                  >
                    WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={onClose}
                    className={buttonClass({ variant: "ghost" })}
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          /* ── Form state ────────────────────────────────────────── */
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-ink-quiet">
              Прежде чем отправить
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
              Отправить второй стороне
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-quiet">
              Контрагент откроет договор без регистрации, увидит ваш разбор
              и сможет согласовать пункты или предложить правки.
            </p>

            <div className="mt-6">
              <label
                htmlFor="deal-counterparty-email"
                className="block text-[10px] uppercase tracking-[0.22em] text-ink-quiet mb-1.5"
              >
                Email контрагента — необязательно
              </label>
              <input
                id="deal-counterparty-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="counterparty@example.com"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                className="w-full border-0 border-b border-rule bg-transparent px-0 py-2 text-foreground placeholder:text-ink-quiet/50 focus:border-primary focus:outline-none focus:ring-0 transition-colors"
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="deal-counterparty-name"
                className="block text-[10px] uppercase tracking-[0.22em] text-ink-quiet mb-1.5"
              >
                Имя контрагента — необязательно
              </label>
              <input
                id="deal-counterparty-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иван Иванов"
                className="w-full border-0 border-b border-rule bg-transparent px-0 py-2 text-foreground placeholder:text-ink-quiet/50 focus:border-primary focus:outline-none focus:ring-0 transition-colors"
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="deal-message"
                className="block text-[10px] uppercase tracking-[0.22em] text-ink-quiet mb-1.5"
              >
                Сообщение — необязательно
              </label>
              <textarea
                id="deal-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Направляю договор на согласование. Просьба ознакомиться."
                className="w-full resize-y border-0 border-b border-rule bg-transparent px-0 py-2 text-foreground placeholder:text-ink-quiet/50 focus:border-primary focus:outline-none focus:ring-0 transition-colors"
              />
            </div>

            {error && (
              <p className="mt-4 text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <Button
              variant="primary"
              loading={submitting}
              onClick={() => void submit()}
              disabled={submitting}
              className="mt-6 w-full"
            >
              {submitting ? "Создаём…" : email.trim() ? "Отправить" : "Создать ссылку"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
