import { NextRequest, NextResponse } from "next/server";
import { diffLines } from "diff";
import { auth } from "@/lib/auth";
import { parseDocument } from "@/lib/parsers";
import { compareContracts } from "@/lib/ai/compare";
import { getActiveProvider } from "@/lib/ai/client";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/telemetry";

// The AI comparison runs on the smart tier over two contracts — give it
// the same headroom as the analyze route.
export const maxDuration = 300;

// POST /api/compare-contracts — multipart { fileA, fileB }. Parses both
// documents, computes a line-level diff and an AI explanation of the
// substantive changes. Stateless — nothing is persisted.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Войдите в аккаунт, чтобы сравнивать договоры." },
        { status: 401 }
      );
    }

    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    const rl = await rateLimit(ip, "analyze");
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Слишком много запросов. Подождите немного." },
        { status: 429 }
      );
    }

    const form = await request.formData().catch(() => null);
    const fileA = form?.get("fileA");
    const fileB = form?.get("fileB");
    if (!(fileA instanceof File) || !(fileB instanceof File)) {
      return NextResponse.json(
        { error: "Приложите оба файла" },
        { status: 400 }
      );
    }

    let textA: string;
    let textB: string;
    try {
      const [a, b] = await Promise.all([
        parseDocument(fileA),
        parseDocument(fileB),
      ]);
      textA = a.text;
      textB = b.text;
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message || "Не удалось прочитать файлы" },
        { status: 400 }
      );
    }

    if (textA.trim().length < 100 || textB.trim().length < 100) {
      return NextResponse.json(
        {
          error:
            "В одном из файлов не удалось извлечь текст. Сканы пока не поддерживаются здесь.",
        },
        { status: 400 }
      );
    }

    if (getActiveProvider() === "demo") {
      return NextResponse.json({ demo: true });
    }

    const ai = await compareContracts(textA, textB);

    // Line-level diff for the literal text view.
    const diff = diffLines(textA, textB).map((part) => ({
      value: part.value,
      added: part.added ?? false,
      removed: part.removed ?? false,
    }));

    return NextResponse.json({
      ai,
      diff,
      fileA: fileA.name,
      fileB: fileB.name,
    });
  } catch (error) {
    await reportError(error, { op: "compare-contracts" });
    return NextResponse.json(
      { error: "Не удалось сравнить договоры. Попробуйте ещё раз." },
      { status: 500 }
    );
  }
}
