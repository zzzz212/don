import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ЮрИИст — AI-юрист для бизнеса",
  description:
    "Проверка договоров, генерация документов и юридические консультации с помощью искусственного интеллекта. Для малого и среднего бизнеса в РФ.",
};

// Inline script that resolves the theme BEFORE React hydrates — avoids
// the "flash of incorrect theme" (FOIT) on cold loads. Runs synchronously
// in <head>; can't use module imports, so we keep it tiny and inline.
const NO_FOIT_THEME_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('juriist:theme');
    var pref = stored === 'light' || stored === 'dark' ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var root = document.documentElement;
    if (pref === 'dark') root.classList.add('dark');
    root.style.colorScheme = pref;
  } catch (e) { /* localStorage blocked — fall through to default light */ }
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FOIT_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">
          Перейти к содержимому
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
