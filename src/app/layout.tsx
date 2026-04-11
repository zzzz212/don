import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ЮрИИст — AI-юрист для бизнеса",
  description:
    "Проверка договоров, генерация документов и юридические консультации с помощью искусственного интеллекта. Для малого и среднего бизнеса в РФ.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
