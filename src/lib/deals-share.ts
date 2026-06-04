// Pure share-link builder for the Deal Room invite URL. When the sender
// skips the counterparty email (GR-1), the in-product share-sheet hands
// these deep links to Telegram / WhatsApp — the working channels for RU
// B2B contract correspondence. Kept pure + dependency-free so it carries
// a unit test (the SendAsDeal component lives under src/components with
// no jsdom env, and the route lives under src/app which vitest excludes).

export interface ShareLinks {
  telegram: string;
  whatsapp: string;
}

// Telegram's share endpoint takes a separate `url` and `text`; WhatsApp's
// wa.me has only a single `text` body, so the url is folded into the text.
export function buildShareLinks(url: string, title: string): ShareLinks {
  const safeTitle = title.trim() || "Договор на согласование";
  const telegram =
    "https://t.me/share/url?url=" +
    encodeURIComponent(url) +
    "&text=" +
    encodeURIComponent(safeTitle);
  const whatsapp =
    "https://wa.me/?text=" + encodeURIComponent(`${safeTitle} ${url}`);
  return { telegram, whatsapp };
}
