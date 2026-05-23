import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { DealRoom } from "./deal-room";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Согласование договора",
  robots: { index: false, follow: false },
};

export default async function DealPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || !/^[0-9a-f]{48}$/.test(token)) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hairline chrome — the page is a contract, so the header has to
          step out of the way. Logo at left, single-line tracking label
          at right, no card fill. */}
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-10">
          <Link href="/" className="inline-flex">
            <Logo />
          </Link>
          <span className="text-[10px] uppercase tracking-[0.28em] text-ink-quiet">
            Deal Room
          </span>
        </div>
      </header>
      <DealRoom token={token} />
    </div>
  );
}
