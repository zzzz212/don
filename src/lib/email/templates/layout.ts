// Shared HTML chrome for transactional emails. Inline CSS only — Gmail,
// Outlook and Apple Mail strip <style> blocks aggressively and any external
// stylesheet is forbidden. Tested against Litmus-style breakpoints; uses a
// 600px-wide table layout (the de-facto email standard) with system fonts.

import { BRAND, CONTACTS } from "@/lib/legal-info";

interface LayoutOptions {
  /** Visible subject line preview (first chars rendered in inbox list). */
  preview: string;
  /** Pre-rendered HTML body (paragraphs, lists, etc.) — no surrounding <body>. */
  body: string;
  /** Optional CTA button label and URL. */
  cta?: { label: string; url: string };
  /**
   * Optional small note block under the CTA — typically the human-readable
   * URL to copy if the CTA button doesn't render.
   */
  ctaFallbackNote?: string;
}

// Mirrors the app's "деловой модерн" palette (src/app/globals.css).
const COLOR_FG = "#16202e";
const COLOR_MUTED = "#5b6573";
const COLOR_BORDER = "#e7e4de";
const COLOR_PRIMARY = "#2348c8";
const COLOR_PRIMARY_DARK = "#1c399e";
const COLOR_SURFACE = "#fbfaf8";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailHtml(opts: LayoutOptions): string {
  const cta = opts.cta
    ? `
        <tr>
          <td style="padding: 8px 0 24px 0;">
            <a href="${escapeHtml(opts.cta.url)}"
               style="display: inline-block; background: ${COLOR_PRIMARY}; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 28px; border-radius: 8px; font-size: 15px;">
              ${escapeHtml(opts.cta.label)}
            </a>
          </td>
        </tr>`
    : "";

  const ctaFallback = opts.ctaFallbackNote
    ? `
        <tr>
          <td style="padding: 0 0 16px 0; color: ${COLOR_MUTED}; font-size: 13px; line-height: 1.5;">
            ${opts.ctaFallbackNote}
          </td>
        </tr>`
    : "";

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(BRAND.name)}</title>
  </head>
  <body style="margin:0; padding:0; background:${COLOR_SURFACE}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <span style="display:none !important; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden;">
      ${escapeHtml(opts.preview)}
    </span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLOR_SURFACE};">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; width:100%; background:#ffffff; border:1px solid ${COLOR_BORDER}; border-radius:12px; overflow:hidden;">
            <tr>
              <td style="padding: 24px 32px 0 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align: middle;">
                      <span style="display:inline-block; vertical-align:middle; width:36px; height:36px; line-height:36px; text-align:center; background:${COLOR_FG}; color:#fbfaf8; border-radius:8px; font-family:Georgia,'Times New Roman',serif; font-weight:600; font-size:19px;">Я</span>
                      <span style="display:inline-block; vertical-align:middle; margin-left:10px; font-family:Georgia,'Times New Roman',serif; font-size:19px; font-weight:600; color:${COLOR_FG}; letter-spacing:-0.01em;">
                        ${escapeHtml(BRAND.name)}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 32px 0 32px; color:${COLOR_FG}; font-size:15px; line-height:1.65;">
                ${opts.body}
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px;">
                ${cta}
                ${ctaFallback}
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 32px 28px 32px; border-top:1px solid ${COLOR_BORDER}; color:${COLOR_MUTED}; font-size:12px; line-height:1.6;">
                Это письмо отправлено автоматически. Если у вас возникли вопросы — напишите на
                <a href="mailto:${CONTACTS.support}" style="color:${COLOR_PRIMARY_DARK}; text-decoration: underline;">${CONTACTS.support}</a>.
                <br>
                © ${new Date().getFullYear()} ${escapeHtml(BRAND.name)} · <a href="${BRAND.publicUrl}/privacy" style="color:${COLOR_MUTED};">Конфиденциальность</a> · <a href="${BRAND.publicUrl}/terms" style="color:${COLOR_MUTED};">Соглашение</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Plain-text rendering helper. Email clients that don't render HTML (and
 * many spam filters that score plain-text fallback) will use this. Keep it
 * close to the HTML version's information content.
 */
export function renderEmailText(lines: string[], cta?: { label: string; url: string }): string {
  const body = lines.join("\n\n");
  const ctaText = cta ? `\n\n${cta.label}: ${cta.url}` : "";
  return `${body}${ctaText}\n\n—\n${BRAND.name} · ${BRAND.publicUrl}\nПоддержка: ${CONTACTS.support}\n`;
}
