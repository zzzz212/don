// Pure ICS (RFC 5545) calendar builder. Used to export contract
// deadlines as a downloadable .ics file. Day-level events only — no
// timezones, no recurring. Outputs CRLF line endings as required by
// the spec.

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
  return lines.join("\r\n") + "\r\n";
}
