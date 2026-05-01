import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Handlebars from "handlebars";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const isDemo =
      process.env.NODE_ENV === "development" &&
      process.env.DEMO_MODE !== "false";

    if (!isDemo && !session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session?.user?.id || "demo-user";
    const { templateCode, variables, documentName } = await request.json();

    if (!templateCode || !variables) {
      return NextResponse.json(
        { error: "templateCode and variables required" },
        { status: 400 }
      );
    }

    // Get template
    const template = await prisma.contractTemplate.findUnique({
      where: { code: templateCode },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Compile and render template
    const hbs = Handlebars.create();
    const compiled = hbs.compile(template.content);
    const renderedContent = compiled(variables);

    // Create generated document record
    const generatedDoc = await prisma.generatedDocument.create({
      data: {
        userId,
        templateId: template.id,
        templateCode: template.code,
        name: documentName || `${template.name} - ${new Date().toLocaleDateString("ru-RU")}`,
        content: renderedContent,
        formData: variables,
        status: "draft",
      },
    });

    console.log(`[Templates] Generated document: ${generatedDoc.id} (${templateCode})`);

    return NextResponse.json({
      success: true,
      document: {
        id: generatedDoc.id,
        name: generatedDoc.name,
        templateCode: generatedDoc.templateCode,
        content: generatedDoc.content,
        status: generatedDoc.status,
        createdAt: generatedDoc.createdAt,
      },
    });
  } catch (error) {
    console.error("[Templates] Generate error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate document",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
