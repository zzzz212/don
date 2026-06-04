import { describe, it, expect } from "vitest";
import { formatLastSeen, isOnline } from "../deal-presence";

const NOW = new Date("2026-06-04T12:00:00.000Z").getTime();

describe("isOnline", () => {
  it("is true within 60 seconds", () => {
    expect(isOnline(new Date(NOW - 10_000).toISOString(), NOW)).toBe(true);
    expect(isOnline(new Date(NOW - 59_000).toISOString(), NOW)).toBe(true);
  });

  it("is false at or beyond 60 seconds", () => {
    expect(isOnline(new Date(NOW - 60_000).toISOString(), NOW)).toBe(false);
    expect(isOnline(new Date(NOW - 600_000).toISOString(), NOW)).toBe(false);
  });

  it("is false for null", () => {
    expect(isOnline(null, NOW)).toBe(false);
  });
});

describe("formatLastSeen", () => {
  it("returns null when never seen", () => {
    expect(formatLastSeen(null, NOW)).toBe(null);
  });

  it("reads 'смотрит сейчас' under 60s", () => {
    expect(formatLastSeen(new Date(NOW - 20_000).toISOString(), NOW)).toBe(
      "смотрит сейчас"
    );
  });

  it("reads minutes ago", () => {
    expect(formatLastSeen(new Date(NOW - 4 * 60_000).toISOString(), NOW)).toBe(
      "смотрел 4 мин назад"
    );
  });

  it("reads hours ago", () => {
    expect(formatLastSeen(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe(
      "смотрел 3 ч назад"
    );
  });

  it("reads 'вчера' at one day", () => {
    expect(
      formatLastSeen(new Date(NOW - 25 * 3_600_000).toISOString(), NOW)
    ).toBe("смотрел вчера");
  });

  it("reads days ago under a week", () => {
    expect(
      formatLastSeen(new Date(NOW - 3 * 86_400_000).toISOString(), NOW)
    ).toBe("смотрел 3 дн назад");
  });
});
