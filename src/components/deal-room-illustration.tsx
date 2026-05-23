// Bespoke SVG for the Deal Room empty state — two sheets of paper
// overlapping with a terracotta thread between them, evoking a sealed
// agreement. Hand-drawn line work (not gradient blobs), tuned to read
// at small sizes too. Stroke colours bind to currentColor / theme
// tokens so it adapts to both palettes automatically.

import { type SVGProps } from "react";

export function DealRoomIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 240 160"
      role="img"
      aria-label="Два договора со скрепляющей нитью"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        {/* Subtle paper shadow — a single soft drop, no halo. */}
        <filter
          id="deal-paper-shadow"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
          <feOffset dy="1.5" result="off" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.18" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Sheet A — left, slightly rotated counter-clockwise. */}
      <g
        transform="translate(28 22) rotate(-4)"
        filter="url(#deal-paper-shadow)"
      >
        <rect
          x="0"
          y="0"
          width="92"
          height="120"
          rx="2"
          fill="var(--card)"
          stroke="currentColor"
          strokeOpacity="0.16"
          strokeWidth="1"
        />
        {/* Hairline contract lines */}
        <line
          x1="12"
          y1="20"
          x2="64"
          y2="20"
          stroke="currentColor"
          strokeOpacity="0.32"
          strokeWidth="1.2"
        />
        <line
          x1="12"
          y1="34"
          x2="78"
          y2="34"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
        <line
          x1="12"
          y1="46"
          x2="68"
          y2="46"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
        <line
          x1="12"
          y1="58"
          x2="80"
          y2="58"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
        <line
          x1="12"
          y1="70"
          x2="58"
          y2="70"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
        {/* Signature line at the bottom */}
        <line
          x1="12"
          y1="98"
          x2="48"
          y2="98"
          stroke="currentColor"
          strokeOpacity="0.42"
          strokeWidth="1.4"
        />
        <text
          x="12"
          y="110"
          fontSize="6"
          fill="currentColor"
          fillOpacity="0.4"
          fontFamily="Georgia, serif"
          fontStyle="italic"
        >
          сторона А
        </text>
      </g>

      {/* ── Sheet B — right, mirror tilt, slight overlap with sheet A. */}
      <g
        transform="translate(120 18) rotate(5)"
        filter="url(#deal-paper-shadow)"
      >
        <rect
          x="0"
          y="0"
          width="92"
          height="120"
          rx="2"
          fill="var(--card)"
          stroke="currentColor"
          strokeOpacity="0.16"
          strokeWidth="1"
        />
        <line
          x1="12"
          y1="20"
          x2="64"
          y2="20"
          stroke="currentColor"
          strokeOpacity="0.32"
          strokeWidth="1.2"
        />
        <line
          x1="12"
          y1="34"
          x2="78"
          y2="34"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
        <line
          x1="12"
          y1="46"
          x2="72"
          y2="46"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
        <line
          x1="12"
          y1="58"
          x2="78"
          y2="58"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
        <line
          x1="12"
          y1="70"
          x2="62"
          y2="70"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
        <line
          x1="12"
          y1="98"
          x2="48"
          y2="98"
          stroke="currentColor"
          strokeOpacity="0.42"
          strokeWidth="1.4"
        />
        <text
          x="12"
          y="110"
          fontSize="6"
          fill="currentColor"
          fillOpacity="0.4"
          fontFamily="Georgia, serif"
          fontStyle="italic"
        >
          сторона Б
        </text>
      </g>

      {/* ── The thread — a single arched terracotta line connecting the
            two signature spots. The visual centre of gravity for the
            illustration; everything else is paper-coloured so this
            reads as the one bright accent. */}
      <path
        d="M 64 138 Q 120 102 188 132"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Seal — terracotta filled dot at the apex of the thread. */}
      <circle
        cx="120"
        cy="112"
        r="5"
        fill="var(--primary)"
      />
      <circle
        cx="120"
        cy="112"
        r="9"
        fill="none"
        stroke="var(--primary)"
        strokeOpacity="0.3"
        strokeWidth="1.2"
      />
    </svg>
  );
}
