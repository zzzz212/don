import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Source_Serif_4 } from "next/font/google";
import { Providers } from "@/components/providers";
import { SkipLink } from "@/components/skip-link";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { InstallPrompt } from "@/components/install-prompt";
import { BRAND, CONTACTS } from "@/lib/legal-info";
import "./globals.css";

// Serif for display headings — the деловой-модерн accent. Source Serif 4
// is a variable font with full Cyrillic coverage.
const displaySerif = Source_Serif_4({
  subsets: ["latin", "cyrillic"],
  variable: "--font-source-serif",
  display: "swap",
});

// metadataBase resolves all relative OG / canonical URLs throughout the
// app to absolute ones — needed for valid Open Graph cards and for
// canonical tags in metadata exports to render correctly. Title is
// templated so per-page metadata.title (e.g. "Блог") gets brand suffix
// automatically.
export const metadata: Metadata = {
  metadataBase: new URL(BRAND.publicUrl),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s — ${BRAND.name}`,
  },
  description:
    "Проверка договоров со ссылками на ГК РФ, 20 шаблонов под российское право и история правок. Для малого и среднего бизнеса.",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: BRAND.name,
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: { index: true, follow: true },
  // PWA — Next auto-links the manifest (src/app/manifest.ts). These two
  // make the installed app feel native: applicationName is the home-
  // screen label, appleWebApp drives the iOS standalone mode + status bar.
  applicationName: BRAND.name,
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: "default",
  },
  // Stop mobile browsers turning ИНН / contract numbers into "phone" links.
  formatDetection: { telephone: false },
};

// Viewport + theme-color get their own export in Next 16. viewportFit
// "cover" lets content reach under the notch; theme-color is split
// light / dark so the status bar matches the active theme.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#14161b" },
  ],
};

// Organization JSON-LD — surfaces in Google Knowledge Panel and signals
// to crawlers that this is a real organisation, not a personal blog.
// Inlined into <head> via a script tag in the body of RootLayout below.
const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BRAND.name,
  url: BRAND.publicUrl,
  logo: `${BRAND.publicUrl}/icon`,
  description:
    "Сервис автоматического аудита договоров под право РФ: проверка по справочнику ГК и ППВС, генерация шаблонов, история правок.",
  inLanguage: "ru-RU",
  email: CONTACTS.support,
  areaServed: { "@type": "Country", name: "RU" },
};

// Inline script that resolves theme + locale BEFORE React hydrates —
// avoids the "flash of incorrect theme" / "flash of incorrect language"
// on cold loads. Runs synchronously in <head>; can't use module imports,
// so we keep it tiny and inline.
const NO_FOIT_BOOT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('yakso:theme');
    var pref = stored === 'light' || stored === 'dark' ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var root = document.documentElement;
    if (pref === 'dark') root.classList.add('dark');
    root.style.colorScheme = pref;
  } catch (e) { /* localStorage blocked — fall through to default light */ }
  try {
    var locStored = localStorage.getItem('yakso:locale');
    var loc = locStored === 'ru' || locStored === 'en' ? locStored
      : ((navigator.language || 'ru').toLowerCase().split('-')[0] === 'en' ? 'en' : 'ru');
    document.documentElement.lang = loc;
  } catch (e) { /* fall through to default ru */ }
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${GeistSans.variable} ${GeistMono.variable} ${displaySerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FOIT_BOOT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORGANIZATION_JSONLD),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          <SkipLink />
          {children}
          <InstallPrompt />
        </Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
