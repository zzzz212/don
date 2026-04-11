import { NextRequest, NextResponse } from "next/server";
import { analyzeContract } from "@/lib/ai/analyze";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const text = formData.get("text") as string | null;

    let contractText = text || "";

    if (file) {
      // For MVP, read the file as text directly
      // In production, we'd use pdf-parse and mammoth for PDF/DOCX
      contractText = await file.text();
    }

    if (!contractText.trim()) {
      return NextResponse.json(
        { error: "Не удалось извлечь текст из документа" },
        { status: 400 }
      );
    }

    // Limit text length for API
    const truncatedText = contractText.slice(0, 15000);

    const analysis = await analyzeContract(truncatedText);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Ошибка при анализе документа. Попробуйте позже." },
      { status: 500 }
    );
  }
}
