#!/usr/bin/env node
// Wrap `prisma db push` with exponential-backoff retry so a Vercel
// deploy doesn't fail just because the Neon serverless DB was cold-
// starting at the moment of the build. Neon free tier auto-suspends
// after ~5 min idle and a freshly-woken instance can refuse the first
// connection or two while the compute spins up.
//
// We're conservative on retries (5 attempts, 2-3-5-8-13s back-off):
// — gives Neon up to ~31s to wake up
// — fails loudly after that so a real "DB is gone" / "wrong URL"
//   doesn't get silently swallowed.

import { spawnSync } from "node:child_process";

const MAX_ATTEMPTS = 5;
const DELAYS_SEC = [2, 3, 5, 8, 13];

function sleepSync(seconds) {
  // Block the event loop for `seconds` — fine in a CLI script.
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    // busy wait; the build container has nothing else to do here.
  }
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  console.log(
    `[db-push] attempt ${attempt}/${MAX_ATTEMPTS} — prisma db push --skip-generate`
  );

  const result = spawnSync(
    "npx",
    ["prisma", "db", "push", "--skip-generate"],
    { stdio: "inherit", shell: process.platform === "win32" }
  );

  if (result.status === 0) {
    console.log(`[db-push] succeeded on attempt ${attempt}`);
    process.exit(0);
  }

  if (attempt === MAX_ATTEMPTS) {
    console.error(
      `[db-push] all ${MAX_ATTEMPTS} attempts failed. Check DATABASE_URL and Neon dashboard.`
    );
    process.exit(result.status ?? 1);
  }

  const wait = DELAYS_SEC[attempt - 1];
  console.warn(
    `[db-push] attempt ${attempt} failed (exit ${result.status}). Waiting ${wait}s and retrying…`
  );
  sleepSync(wait);
}
