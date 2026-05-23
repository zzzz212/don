// Password reset link. Token in URL is the *plaintext* random value — the
// DB stores only its SHA-256 hash, so this email is the only place the
// plaintext exists. That's why we never log the URL on the server side.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND } from "@/lib/legal-info";

interface PasswordResetOptions {
  to: string;
  /** Absolute URL with the plaintext token in the query string. */
  resetUrl: string;
  /** Validity window for the user-facing copy, e.g. "30 минут". */
  validityHuman: string;
}

export function buildPasswordResetEmail(
  opts: PasswordResetOptions
): EmailMessage {
  const html = renderEmailHtml({
    preview: `Запрос на восстановление пароля в ${BRAND.name}.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Восстановление пароля
      </p>
      <p style="margin: 0 0 16px 0;">
        Мы получили запрос на сброс пароля для вашего аккаунта в ${BRAND.name}.
        Чтобы задать новый пароль, нажмите кнопку ниже.
      </p>
      <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px;">
        Ссылка действительна <strong>${opts.validityHuman}</strong> и работает
        только один раз. Если вы не запрашивали смену пароля — просто
        игнорируйте это письмо, ваш текущий пароль не изменится.
      </p>
    `,
    cta: { label: "Задать новый пароль", url: opts.resetUrl },
    ctaFallbackNote: `Если кнопка не открывается, скопируйте адрес: <a href="${opts.resetUrl}" style="color:#1d4ed8; word-break: break-all;">${opts.resetUrl}</a>`,
  });

  const text = renderEmailText(
    [
      "Восстановление пароля",
      `Мы получили запрос на сброс пароля для вашего аккаунта в ${BRAND.name}.`,
      `Ссылка действительна ${opts.validityHuman} и работает только один раз. Если вы не запрашивали смену пароля — просто игнорируйте это письмо.`,
    ],
    { label: "Задать новый пароль", url: opts.resetUrl }
  );

  return {
    to: opts.to,
    subject: `Восстановление пароля в ${BRAND.name}`,
    html,
    text,
    tag: "password-reset",
  };
}
