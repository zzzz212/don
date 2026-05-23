"use client";

// Client-side PostHog initialization + user identification.
//
// Initializes once on first mount, identifies the user on session
// resolution, captures pageviews automatically, and exposes a small
// `track()` helper for explicit events the server can't see (e.g.
// "user clicked CTA"). Server-side events come from posthog-node via
// src/lib/analytics/server.ts — those are the source of truth for
// funnel/revenue events; the client side mostly handles pageviews and
// UI-interaction events.
//
// Privacy posture:
//   • autocapture is OFF — we capture only what we explicitly emit
//   • $ip is not masked (PostHog needs it for geo); turn off via
//     posthog.opt_out_capturing() if a user requests it
//   • Person profiles use the User.id cuid, never the email

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

let phInitialized = false;

function initOnce() {
  if (phInitialized) return;
  if (typeof window === "undefined") return;
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;
  posthog.init(apiKey, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    // We capture pageviews manually (see PostHogPageviewTracker below)
    // because Next's app router doesn't fire navigation events the
    // way PostHog's auto-capture expects.
    capture_pageview: false,
    capture_pageleave: true,
    // Off — we want explicit events only. Saves bandwidth and avoids
    // the "every click was logged" data dump that's hard to analyze.
    autocapture: false,
    // Opt into person profiles only when we identify a user. Anonymous
    // page-views still get a distinctId but aren't promoted to a full
    // profile until login — keeps the PostHog "Persons" view clean.
    person_profiles: "identified_only",
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") {
        ph.debug(false);
      }
    },
  });
  phInitialized = true;
}

interface Props {
  children: React.ReactNode;
}

export function PostHogProvider({ children }: Props) {
  const { data: session, status } = useSession();

  // Init on first client render. Idempotent.
  useEffect(() => {
    initOnce();
  }, []);

  // Identify when the user resolves. Reset on logout so we don't
  // leak the previous user's distinctId into the next session.
  useEffect(() => {
    if (!phInitialized) return;
    if (typeof window === "undefined") return;
    if (status === "loading") return;
    const userId = session?.user?.id;
    if (userId) {
      // Identify by User.id; the only "person properties" we attach are
      // the workspace id (groups) — never email/name.
      posthog.identify(userId);
      const orgId = session?.user?.activeOrgId;
      if (orgId) {
        posthog.group("workspace", orgId);
      }
    } else {
      // Logged out — make sure the next page-view doesn't carry the
      // previous identity over.
      posthog.reset();
    }
  }, [session?.user?.id, session?.user?.activeOrgId, status]);

  return (
    <>
      {children}
      <PostHogPageviewTracker />
    </>
  );
}

/**
 * App-router-friendly pageview tracker. Listens for path/query changes
 * and fires `$pageview` to PostHog. Without this, PostHog only sees the
 * very first page a user landed on — every subsequent SPA navigation
 * is invisible.
 */
function PostHogPageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!phInitialized) return;
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}${pathname}${
      searchParams?.toString() ? `?${searchParams.toString()}` : ""
    }`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Imperative event capture from client components — useful for things
 * the server can't see, like "user opened the refine panel" or "user
 * dismissed onboarding tooltip". Not for revenue/funnel events: those
 * MUST go through the server-side captureEvent so an evil client can't
 * forge them.
 */
export function track(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!phInitialized) return;
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
}
