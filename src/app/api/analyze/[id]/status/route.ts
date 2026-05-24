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
    select: {
      id: true,
      status: true,
      stage: true,
      progress: true,
      errorMessage: true,
      finishedAt: true,
      document: { select: { userId: true } },
    },
  });
  if (!analysis) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  if (analysis.document.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    status: analysis.status,
    stage: analysis.stage,
    progress: analysis.progress,
    errorMessage: analysis.errorMessage,
    finishedAt: analysis.finishedAt?.toISOString() ?? null,
  });
}
