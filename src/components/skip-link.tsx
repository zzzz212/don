"use client";

import { useT } from "@/components/i18n-provider";

// Translated skip-to-content link. Lives outside Header so it's the
// first focusable element on the page even when Header isn't rendered
// (auth pages, error pages).

export function SkipLink() {
  const t = useT();
  return (
    <a href="#main-content" className="skip-link">
      {t("skip.toContent")}
    </a>
  );
}
