import { prisma } from "@/lib/prisma";
import { seedLegalKnowledge } from "@/lib/legal-seed-data";
import { NextResponse } from "next/server";

// This is an admin-only endpoint - in production, add proper authentication
export async function POST(request: Request) {
  try {
    // Check for admin key in header or environment
    const adminKey = request.headers.get("x-admin-key");
    const expectedKey = process.env.ADMIN_SEED_KEY || "dev-seed-key";

    if (adminKey !== expectedKey) {
      return NextResponse.json(
        { error: "Unauthorized - invalid admin key" },
        { status: 401 }
      );
    }

    await seedLegalKnowledge(prisma);

    return NextResponse.json({
      success: true,
      message: "Legal knowledge seeded successfully",
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
