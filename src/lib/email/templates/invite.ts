// Workspace invitation email. Sent by the invite-create route when the
// caller supplies a target email — replaces the previous "copy this URL
// somewhere" UX which felt like 2010.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND } from "@/lib/legal-info";

interface InviteOptions {
  to: string;
  /** Workspace display name. */
  orgName: string;
  /** Display name of the person who created the invite, if known. */
  inviterName?: string | null;
  /** Inviter email — always known, used as the visible "from human" line. */
  inviterEmail: string;
  /**
   * Role being granted. Drops the OWNER case into MEMBER copy because
   * inviting someone as OWNER is a transfer-of-ownership flow and
   * shouldn't happen via plain invite emails.
   */
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  /** Public absolute URL the recipient clicks to accept. */
  acceptUrl: string;
  /** Expiry, ISO string, used for the user-facing expiry note. */
  expiresAt: string;
}

const ROLE_LABEL: Record<InviteOptions["role"], string> = {
  OWNER: "участника",
  ADMIN: "администратора",
  MEMBER: "участника",
  VIEWER: "наблюдателя",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function buildInviteEmail(opts: InviteOptions): EmailMessage {
  const inviter =
    (opts.inviterName && opts.inviterName.trim()) || opts.inviterEmail;
  const subject = `${inviter} приглашает вас в ${opts.orgName} на ${BRAND.name}`;
  const expiry = formatDate(opts.expiresAt);
  const roleLabel = ROLE_LABEL[opts.role];

  const html = renderEmailHtml({
    preview: `${inviter} приглашает вас в рабочее пространство ${opts.orgName}.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Вас приглашают в команду
      </p>
      <p style="margin: 0 0 16px 0;">
        <strong>${escape(inviter)}</strong> (${escape(opts.inviterEmail)})
        приглашает вас присоединиться к рабочему пространству
        <strong>${escape(opts.orgName)}</strong> в качестве ${roleLabel} на сервисе ${BRAND.name}.
      </p>
      <p style="margin: 0 0 16px 0;">
        Принять приглашение можно в один клик. Если у вас ещё нет аккаунта — он
        создастся автоматически после принятия.
      </p>
    `,
    cta: { label: "Принять приглашение", url: opts.acceptUrl },
    ctaFallbackNote: `Срок действия ссылки — до ${escape(expiry)}. Если кнопка не открывается, скопируйте адрес: <a href="${opts.acceptUrl}" style="color:#1d4ed8; word-break: break-all;">${escape(opts.acceptUrl)}</a>`,
  });

  const text = renderEmailText(
    [
      "Вас приглашают в команду",
      `${inviter} (${opts.inviterEmail}) приглашает вас присоединиться к рабочему пространству "${opts.orgName}" в качестве ${roleLabel} на сервисе ${BRAND.name}.`,
      `Срок действия ссылки — до ${expiry}.`,
    ],
    { label: "Принять приглашение", url: opts.acceptUrl }
  );

  return {
    to: opts.to,
    subject,
    html,
    text,
    tag: "invite",
    replyTo: opts.inviterEmail,
  };
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
