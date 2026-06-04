import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`analyze.poll:${session.user.id}`, "analyze.poll");
  if (!rl.ok) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: {
      document: {
        select: {
          id: true,
          userId: true,
          fileName: true,
          rawText: true,
        },
      },
    },
  });
  if (!analysis) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  if (analysis.document.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (analysis.status !== "COMPLETED") {
    return NextResponse.json(
      { status: analysis.status, progress: analysis.progress, stage: analysis.stage },
      { status: 425 } // Too Early
    );
  }

  // Parse risks JSON for client (matches old /api/analyze response shape).
  let parsedRisks: unknown = [];
  try {
    parsedRisks = JSON.parse(analysis.risks);
  } catch {
    parsedRisks = [];
  }
  let parsedMetadata: Record<string, unknown> = {};
  if (analysis.metadata) {
    try {
      parsedMetadata = JSON.parse(analysis.metadata) as Record<string, unknown>;
    } catch {
      parsedMetadata = {};
    }
  }

  return NextResponse.json({
    documentId: analysis.document.id,
    fileName: analysis.document.fileName,
    score: analysis.score,
    summary: analysis.summary,
    risks: parsedRisks,
    ...parsedMetadata,
  });
}
