import { describe, it, expect } from "vitest";
import { buildIcsCalendar, foldLine, type IcsEvent } from "../ics";

describe("buildIcsCalendar", () => {
  const fixedNow = new Date("2026-05-24T10:00:00Z");

  it("wraps events in VCALENDAR + VEVENT", () => {
    const events: IcsEvent[] = [
      {
        uid: "doc1-deadline1@yakso.ru",
        date: new Date("2026-06-15T00:00:00Z"),
        summary: "Оплата",
        description: "Срок оплаты по договору",
      },
    ];
    const ics = buildIcsCalendar(events, fixedNow);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Yakso//Contract Deadlines//RU");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:doc1-deadline1@yakso.ru");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260615");
    expect(ics).toContain("SUMMARY:Оплата");
    expect(ics).toContain("DESCRIPTION:Срок оплаты по договору");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("produces empty VCALENDAR for zero events", () => {
    const ics = buildIcsCalendar([], fixedNow);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("escapes commas, semicolons, backslashes, newlines in summary/description", () => {
    const events: IcsEvent[] = [
      {
        uid: "u1",
        date: new Date("2026-07-01T00:00:00Z"),
        summary: "Step, then; another\\one",
        description: "Line 1\nLine 2",
      },
    ];
    const ics = buildIcsCalendar(events, fixedNow);
    expect(ics).toContain("SUMMARY:Step\\, then\\; another\\\\one");
    expect(ics).toContain("DESCRIPTION:Line 1\\nLine 2");
  });

  it("formats DTSTAMP using fixed now in UTC YYYYMMDDTHHmmssZ", () => {
    const events: IcsEvent[] = [
      {
        uid: "u",
        date: new Date("2026-06-15T00:00:00Z"),
        summary: "x",
        description: "y",
      },
    ];
    const ics = buildIcsCalendar(events, fixedNow);
    expect(ics).toContain("DTSTAMP:20260524T100000Z");
  });

  it("uses \\r\\n line endings (CRLF) per RFC 5545", () => {
    const ics = buildIcsCalendar(
      [
        {
          uid: "u",
          date: new Date("2026-06-15T00:00:00Z"),
          summary: "x",
          description: "y",
        },
      ],
      fixedNow
    );
    expect(ics).toMatch(/BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
  });

  it("folds output lines exceeding 75 octets per RFC 5545 §3.1", () => {
    // Cyrillic letter 'А' is 2 bytes in UTF-8. 50 copies = 100 bytes.
    // Plus "SUMMARY:" = 108 bytes total — well over 75.
    const longSummary = "А".repeat(50);
    const events: IcsEvent[] = [
      {
        uid: "u",
        date: new Date("2026-06-15T00:00:00Z"),
        summary: longSummary,
        description: "d",
      },
    ];
    const ics = buildIcsCalendar(events, fixedNow);
    // Continuation marker must appear at least once in the SUMMARY block.
    expect(ics).toMatch(/SUMMARY:[\s\S]+\r\n /);
    // Every emitted line must be ≤75 octets.
    const enc = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});

describe("foldLine", () => {
  it("returns short lines unchanged", () => {
    expect(foldLine("short", 75)).toBe("short");
  });

  it("folds ASCII strings longer than 75 octets", () => {
    const input = "a".repeat(80);
    const out = foldLine(input, 75);
    expect(out).toBe("a".repeat(75) + "\r\n " + "a".repeat(5));
  });

  it("does not split UTF-8 multi-byte sequences", () => {
    // 50 cyrillic chars (2 bytes each) = 100 bytes; must fold but never
    // mid-character, so each chunk decodes cleanly.
    const input = "А".repeat(50);
    const out = foldLine(input, 75);
    const dec = new TextDecoder("utf-8", { fatal: true });
    for (const chunk of out.split("\r\n ")) {
      // Re-encode; this would throw if a multi-byte sequence was split.
      expect(() => dec.decode(new TextEncoder().encode(chunk))).not.toThrow();
    }
    // Round-trip: unfolding (remove CRLF+space) gives the original.
    expect(out.replace(/\r\n /g, "")).toBe(input);
  });

  it("accounts for the leading WSP on continuation lines", () => {
    // 76-byte ASCII string with maxOctets=75. First chunk = 75 bytes;
    // remainder = 1 byte. Continuation gets a leading space so each
    // continuation line is bounded at 74 content bytes (75 total).
    const input = "a".repeat(76);
    const out = foldLine(input, 75);
    const enc = new TextEncoder();
    for (const line of out.split("\r\n")) {
      expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});
