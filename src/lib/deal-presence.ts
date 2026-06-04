// Pure presence formatting for the Deal Room title-page header. Mirrors
// the dashboard's timeAgo idiom (src/app/dashboard/page.tsx) but lives in
// src/lib so it can be unit-tested (vitest excludes src/app) and takes an
// injectable `now` for deterministic tests. lastSeenAt is a soft, laggy
// signal written on every by-token GET — not a heartbeat — so "online"
// (<60s) is approximate.

const ONLINE_WINDOW_MS = 60_000;

/** True when the participant was last seen within the online window. */
export function isOnline(lastSeenAt: string | null, now: number): boolean {
  if (!lastSeenAt) return false;
  return now - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

/**
 * Editorial presence line for the counterparty, e.g.
 * "смотрит сейчас" / "смотрел 4 мин назад" / "смотрел вчера".
 * Returns null when the link has never been opened.
 */
export function formatLastSeen(lastSeenAt: string | null, now: number): string | null {
  if (!lastSeenAt) return null;
  const diff = now - new Date(lastSeenAt).getTime();
  if (diff < ONLINE_WINDOW_MS) return "смотрит сейчас";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `смотрел ${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `смотрел ${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "смотрел вчера";
  if (days < 7) return `смотрел ${days} дн назад`;
  return "смотрел давно";
}
