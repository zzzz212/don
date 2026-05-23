import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";

// Dynamic OG image for /deal/[token]. When the invite link is pasted
// into Telegram/WhatsApp/Mail, the preview should look like an actual
// contract title page — title on cream paper, the sender's name as a
// from-line, terracotta drop cap. Better than no preview, better than
// a generic "Яксо" splash.
//
// Satori (next/og) caveats:
// - No CSS variables — every colour is a hex literal.
// - Any container with more than one child needs explicit display flex.
// - No web fonts; Georgia is a safe Cyrillic-capable serif fallback for
//   Source Serif 4.

export const alt = "Договор на согласование — Яксо";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'Inter, system-ui, sans-serif';

const COLOR_BG = "#f5eddf";
const COLOR_INK = "#1f1b16";
const COLOR_PRIMARY = "#c2613f";
const COLOR_MUTED = "#6b6258";
const COLOR_RULE = "rgba(31, 27, 22, 0.18)";

interface DealMeta {
  title: string | null;
  ownerName: string | null;
}

async function loadDeal(token: string): Promise<DealMeta | null> {
  // Token format check matches the page-level guard. Skip the DB hit
  // entirely on bad input — OG bots / link previewers don't deserve a
  // query they'll never see render.
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  try {
    const deal = await prisma.deal.findUnique({
      where: { inviteToken: token },
      select: {
        title: true,
        owner: { select: { name: true } },
      },
    });
    if (!deal) return null;
    return { title: deal.title, ownerName: deal.owner?.name ?? null };
  } catch {
    return null;
  }
}

// Truncate long titles cleanly — OG previews on Telegram crop fairly
// aggressively; keep the rendered string under ~64 chars so the card
// fills with type rather than a single ellipsis.
function truncate(s: string, max = 60): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export default async function DealOpengraphImage({
  params,
}: {
  params: { token: string };
}) {
  const meta = await loadDeal(params.token);
  const title = truncate(meta?.title ?? "Договор");
  const fromLine = meta?.ownerName
    ? `от ${meta.ownerName}`
    : "от отправителя";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: COLOR_BG,
          padding: 80,
          fontFamily: SANS,
        }}
      >
        {/* ── Top row: brand mark + section label, like a printed letterhead. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: COLOR_INK,
                color: "#fcf7ef",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 600,
                fontFamily: SERIF,
              }}
            >
              Я
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: COLOR_INK,
                fontFamily: SERIF,
                letterSpacing: -0.3,
              }}
            >
              Яксо
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 14,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: COLOR_MUTED,
              fontWeight: 600,
            }}
          >
            Deal Room
          </div>
        </div>

        {/* ── Hairline rule under the letterhead. */}
        <div
          style={{
            display: "flex",
            height: 1,
            background: COLOR_RULE,
            marginTop: 36,
          }}
        />

        {/* ── Eyebrow above the title. */}
        <div
          style={{
            display: "flex",
            marginTop: 60,
            fontSize: 16,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: COLOR_MUTED,
            fontWeight: 600,
          }}
        >
          Договор на согласование
        </div>

        {/* ── Title — serif, large, two stacked block divs because
              Satori needs explicit display:flex on multi-child blocks. */}
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 72,
            lineHeight: 1.08,
            fontFamily: SERIF,
            fontWeight: 600,
            color: COLOR_INK,
            letterSpacing: -1.5,
          }}
        >
          {title}
        </div>

        {/* ── From line. */}
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 26,
            color: COLOR_INK,
            fontFamily: SERIF,
            fontStyle: "italic",
          }}
        >
          {fromLine}
        </div>

        {/* ── Footer: CTA + brand mark. flex-1 pushes the whole row to
              the bottom of the card. */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 12,
                height: 12,
                borderRadius: 12,
                background: COLOR_PRIMARY,
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: 20,
                color: COLOR_INK,
                fontWeight: 500,
              }}
            >
              Откройте, чтобы посмотреть разбор и согласовать пункты
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 14,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: COLOR_PRIMARY,
              fontWeight: 700,
            }}
          >
            yakso.ru
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
