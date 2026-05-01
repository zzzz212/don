import { prisma } from "@/lib/prisma";
import { CONTRACT_TEMPLATES } from "@/lib/contract-templates";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Optional: check for admin key
    const { adminKey } = await request.json().catch(() => ({}));
    const expectedKey = process.env.ADMIN_SEED_KEY || "seed-templates";

    if (adminKey !== expectedKey) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Clear existing templates (optional)
    // await prisma.contractTemplate.deleteMany();

    // Seed all templates
    const created = await Promise.all(
      CONTRACT_TEMPLATES.map((template) =>
        prisma.contractTemplate.upsert({
          where: { code: template.code },
          create: {
            code: template.code,
            name: template.name,
            category: template.category,
            description: template.description,
            content: template.content,
            variables: JSON.stringify(template.variables),
          },
          update: {
            name: template.name,
            category: template.category,
            description: template.description,
            content: template.content,
            variables: JSON.stringify(template.variables),
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      count: created.length,
      templates: created.map((t) => ({
        code: t.code,
        name: t.name,
        category: t.category,
      })),
    });
  } catch (error) {
    console.error("[Templates] Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed templates", details: String(error) },
      { status: 500 }
    );
  }
}
