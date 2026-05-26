// Pure ICS (RFC 5545) calendar builder. Used to export contract
// deadlines as a downloadable .ics file. Day-level events only — no
// timezones, no recurring. Outputs CRLF line endings as required by
// the spec, and folds lines longer than 75 octets per §3.1.

export interface IcsEvent {
  uid: string;
  /** Day-level date (time ignored — DTSTART is VALUE=DATE) */
  date: Date;
  summary: string;
  description: string;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

function formatDateOnly(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function formatDateTime(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

// RFC 5545 escape: backslash, semicolon, comma, newline.
// Order matters — backslash MUST be escaped first to avoid double-escaping
// the backslashes we just added for the others.
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

// RFC 5545 §3.1 line folding. Lines longer than 75 octets (UTF-8 bytes,
// not characters) are split on byte boundaries and rejoined with CRLF
// followed by a single space. Continuation lines themselves count their
// leading space toward the 75-octet limit, so they're chunked at 74.
//
// Cyrillic content is the main reason this matters here — "Срок оплаты
// по договору" inside a SUMMARY easily blows past 75 octets even though
// it's only ~25 characters.
export function foldLine(line: string, maxOctets = 75): string {
  const enc = new TextEncoder();
  const bytes = enc.encode(line);
  if (bytes.length <= maxOctets) return line;

  const dec = new TextDecoder();
  const parts: string[] = [];
  let offset = 0;
  let limit = maxOctets;
  while (offset < bytes.length) {
    const remaining = bytes.length - offset;
    let chunkLen = Math.min(remaining, limit);
    // If we're not consuming the rest of the buffer, back up to a UTF-8
    // start byte. Continuation bytes match the pattern 10xxxxxx.
    if (offset + chunkLen < bytes.length) {
      while (chunkLen > 0 && (bytes[offset + chunkLen] & 0xc0) === 0x80) {
        chunkLen--;
      }
    }
    parts.push(dec.decode(bytes.subarray(offset, offset + chunkLen)));
    offset += chunkLen;
    limit = maxOctets - 1; // continuation lines lose one octet to the leading WSP
  }
  return parts.join("\r\n ");
}

export function buildIcsCalendar(events: IcsEvent[], now: Date = new Date()): string {
  const stamp = formatDateTime(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Yakso//Contract Deadlines//RU",
    "CALSCALE:GREGORIAN",
  ];
  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${formatDateOnly(ev.date)}`,
      `SUMMARY:${escapeText(ev.summary)}`,
      `DESCRIPTION:${escapeText(ev.description)}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map((l) => foldLine(l)).join("\r\n") + "\r\n";
}
