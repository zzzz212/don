import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import type { AnalysisJobView } from "@/lib/analyze/job";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ jobs: [] });
  }

  const rl = await rateLimit(`analyze.poll:${session.user.id}`, "analyze.poll");
  if (!rl.ok) {
    return NextResponse.json({ jobs: [], error: "Слишком много запросов" }, { status: 429 });
  }

  const rows = await prisma.analysis.findMany({
    where: {
      status: { in: ["PENDING", "RUNNING"] },
      document: { userId: session.user.id },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      document: { select: { id: true, fileName: true } },
    },
  });

  const jobs: AnalysisJobView[] = rows.map((r) => ({
    analysisId: r.id,
    documentId: r.document.id,
    fileName: r.document.fileName,
    status: r.status,
    stage: r.stage,
    progress: r.progress,
    errorMessage: r.errorMessage,
    startedAt: r.startedAt?.toISOString() ?? null,
    finishedAt: r.finishedAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ jobs });
}
