import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg } from "@/lib/org";
import { checkQuotaSafe } from "@/lib/quota";
import { reportError } from "@/lib/telemetry";
import { getTemplate } from "@/lib/templates";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(session.user.id));

    const documents = await prisma.generatedDocument.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        templateId: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error fetching generated documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// POST /api/generated  { templateId, name, content, formData }
//   Persist a deterministically-generated document. Templates are pure
//   string-interpolation client-side (src/lib/contracts/templates.ts) —
//   without this endpoint, the user would generate a doc on /templates/[id],
//   download the DOCX, and watch their dashboard stay empty because the
//   document never reached the database. This is the bug fix path.
//
// We still apply the "generate" quota even though no AI tokens were
// burned: it's the value-driver that pushes FREE users toward Pro and
// keeps the limits described on /offer honest.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Войдите в аккаунт, чтобы сохранить документ." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      templateId?: unknown;
      name?: unknown;
      content?: unknown;
      formData?: unknown;
    };

    const templateId =
      typeof body.templateId === "string" ? body.templateId : "";
    const content = typeof body.content === "string" ? body.content : "";
    const name =
      typeof body.name === "string" && body.name.trim().length > 0
        ? body.name.trim()
        : null;
    // Sanitize formData to a plain string-string record before Prisma —
    // its Json scalar wants InputJsonValue, and our templates only ever
    // collect string fields anyway.
    const formData: Record<string, string> = {};
    if (body.formData && typeof body.formData === "object") {
      for (const [k, v] of Object.entries(
        body.formData as Record<string, unknown>
      )) {
        if (typeof v === "string") formData[k] = v;
        else if (typeof v === "number" || typeof v === "boolean") {
          formData[k] = String(v);
        }
      }
    }

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId обязателен" },
        { status: 400 }
      );
    }
    if (!content || content.length < 100) {
      return NextResponse.json(
        { error: "Содержимое документа пустое или слишком короткое" },
        { status: 400 }
      );
    }

    const template = getTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        { error: "Шаблон не найден" },
        { status: 404 }
      );
    }

    const userId = session.user.id;
    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(userId));

    // Plan quota — same gate as the AI-driven /api/generate route, so a
    // FREE user can't bypass the 2-doc/month limit by switching to the
    // template path.
    const quota = await checkQuotaSafe(orgId, "generate");
    if (quota && !quota.allowed) {
      return NextResponse.json(
        {
          error: `Лимит тарифа ${quota.plan} исчерпан: ${quota.used} из ${quota.limit} генераций в этом месяце. Перейдите на «Про» для безлимита.`,
          code: "QUOTA_EXCEEDED",
          quota: {
            feature: quota.feature,
            used: quota.used,
            limit: quota.limit,
            plan: quota.plan,
            resetsAt: quota.resetsAt.toISOString(),
          },
        },
        { status: 402 }
      );
    }

    const doc = await prisma.generatedDocument.create({
      data: {
        userId,
        orgId,
        templateId,
        name: name ?? template.name,
        content,
        formData,
      },
      select: {
        id: true,
        templateId: true,
        name: true,
        createdAt: true,
      },
    });

    // Record usage so the FREE quota counter actually counts. Provider /
    // model fields fixed because no AI was used; latency is 0 by
    // construction (deterministic string interpolation client-side).
    await prisma.aiUsage.create({
      data: {
        userId,
        orgId,
        feature: "generate",
        provider: "template",
        model: "deterministic",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
      },
    });

    return NextResponse.json({
      id: doc.id,
      templateId: doc.templateId,
      name: doc.name,
      createdAt: doc.createdAt,
    });
  } catch (error) {
    await reportError(error, { op: "generated.create" });
    return NextResponse.json(
      { error: "Не удалось сохранить документ. Попробуйте ещё раз." },
      { status: 500 }
    );
  }
}
