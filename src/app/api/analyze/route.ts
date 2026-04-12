import { NextRequest, NextResponse } from "next/server";
import { parseDocument } from "@/lib/parsers";
import { analyzeContract } from "@/lib/ai/analyze";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Файл не предоставлен" },
        { status: 400 }
      );
    }

    // Validate file size (10 MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Файл слишком большой. Максимальный размер — 10 МБ" },
        { status: 400 }
      );
    }

    // Parse the document
    let contractText: string;
    try {
      const parsed = await parseDocument(file);
      contractText = parsed.text;
    } catch {
      return NextResponse.json(
        { error: "Не удалось прочитать файл. Убедитесь, что формат поддерживается (PDF, DOCX, TXT)." },
        { status: 400 }
      );
    }

    if (!contractText.trim()) {
      return NextResponse.json(
        { error: "Документ пуст или не содержит текста. Возможно, PDF состоит из сканированных изображений." },
        { status: 400 }
      );
    }

    // Limit text length for API
    const truncatedText = contractText.slice(0, 15000);

    // Analyze with AI (or demo fallback)
    const analysis = await analyzeContract(truncatedText);

    // Save to DB if user is authenticated
    let documentId: string | null = null;
    if (userId) {
      const document = await prisma.document.create({
        data: {
          userId,
          fileName: file.name,
          fileSize: file.size,
          rawText: truncatedText,
          analysis: {
            create: {
              score: analysis.score,
              summary: analysis.summary,
              risks: JSON.stringify(analysis.risks),
            },
          },
        },
        include: { analysis: true },
      });
      documentId = document.id;
    }

    return NextResponse.json({
      ...analysis,
      documentId,
      fileName: file.name,
      textLength: contractText.length,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Ошибка при анализе документа. Попробуйте позже." },
      { status: 500 }
    );
  }
}
