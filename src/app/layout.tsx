import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/providers";
import { SkipLink } from "@/components/skip-link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ЮрИИст — AI-юрист для бизнеса",
  description:
    "Проверка договоров, генерация документов и юридические консультации с помощью искусственного интеллекта. Для малого и среднего бизнеса в РФ.",
};

// Inline script that resolves theme + locale BEFORE React hydrates —
// avoids the "flash of incorrect theme" / "flash of incorrect language"
// on cold loads. Runs synchronously in <head>; can't use module imports,
// so we keep it tiny and inline.
const NO_FOIT_BOOT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('juriist:theme');
    var pref = stored === 'light' || stored === 'dark' ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var root = document.documentElement;
    if (pref === 'dark') root.classList.add('dark');
    root.style.colorScheme = pref;
  } catch (e) { /* localStorage blocked — fall through to default light */ }
  try {
    var locStored = localStorage.getItem('juriist:locale');
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
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FOIT_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          <SkipLink />
          {children}
        </Providers>
      </body>
    </html>
  );
}
