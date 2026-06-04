import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership and update atomically — only PENDING or RUNNING rows
  // can be cancelled. COMPLETED / FAILED / already-CANCELLED rows: no-op.
  const result = await prisma.analysis.updateMany({
    where: {
      id,
      status: { in: ["PENDING", "RUNNING"] },
      document: { userId: session.user.id },
    },
    data: {
      status: "CANCELLED",
      finishedAt: new Date(),
    },
  });

  return NextResponse.json({ cancelled: result.count > 0 });
}
