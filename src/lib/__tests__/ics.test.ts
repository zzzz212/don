import { describe, it, expect } from "vitest";
import { buildIcsCalendar, type IcsEvent } from "../ics";

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
});
