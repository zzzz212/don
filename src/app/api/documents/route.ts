import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json([], { status: 200 });
    }

    const documents = await prisma.document.findMany({
      where: { userId: session.user.id },
      include: { analysis: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const result = documents.map((doc) => {
      const risks = doc.analysis ? JSON.parse(doc.analysis.risks) : [];
      const topRisk = risks.find((r: { level: string }) => r.level === "critical")
        ? "critical"
        : risks.find((r: { level: string }) => r.level === "medium")
          ? "medium"
          : "low";

      return {
        id: doc.id,
        fileName: doc.fileName,
        score: doc.analysis?.score ?? 0,
        risksCount: risks.length,
        topRisk,
        createdAt: doc.createdAt.toISOString(),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Documents list error:", error);
    return NextResponse.json([], { status: 200 });
  }
}
