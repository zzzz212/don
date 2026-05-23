import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
  // Cheap sanity check before mounting the client. /deal/anything-else
  // shouldn't render the heavy UI just to fail the API call.
  if (!token || !/^[0-9a-f]{48}$/.test(token)) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <Logo />
          <span className="text-sm text-muted">Согласование договора</span>
        </div>
      </header>
      <DealRoom token={token} />
    </div>
  );
}
