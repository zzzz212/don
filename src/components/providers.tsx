"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { ToastProvider, ToastBridge } from "@/components/toast";
import { PostHogProvider } from "@/components/posthog-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/components/i18n-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <SessionProvider>
          <ToastProvider>
            <ToastBridge />
            {/* Suspense wrapper required by Next 16 — PostHogProvider's
                pageview tracker uses useSearchParams which is a Suspense
                boundary requirement. */}
            <Suspense fallback={null}>
              <PostHogProvider>{children}</PostHogProvider>
            </Suspense>
          </ToastProvider>
        </SessionProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
