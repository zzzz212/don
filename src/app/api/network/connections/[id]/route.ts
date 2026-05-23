import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";

const PatchSchema = z.object({ action: z.enum(["accept", "decline"]) });

// PATCH /api/network/connections/[id]  { action: "accept" | "decline" }
// Only the addressee of a pending request may respond to it.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const parsed = PatchSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректное действие" },
        { status: 400 }
      );
    }

    const connection = await prisma.connection.findUnique({ where: { id } });
    // 404 (not 403) for non-addressees — don't reveal the row exists.
    if (!connection || connection.addresseeId !== session.user.id) {
      return NextResponse.json({ error: "Запрос не найден" }, { status: 404 });
    }
    if (connection.status !== "PENDING") {
      return NextResponse.json(
        { error: "Запрос уже рассмотрен" },
        { status: 409 }
      );
    }

    const updated = await prisma.connection.update({
      where: { id },
      data: {
        status: parsed.data.action === "accept" ? "ACCEPTED" : "DECLINED",
        respondedAt: new Date(),
      },
    });
    return NextResponse.json({ connection: updated });
  } catch (error) {
    await reportError(error, { op: "network.connections.respond" });
    return NextResponse.json(
      { error: "Не удалось обработать запрос" },
      { status: 500 }
    );
  }
}

// DELETE /api/network/connections/[id] — cancel an outgoing request or
// remove an existing connection. Either party may do this.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    const { id } = await params;

    const connection = await prisma.connection.findUnique({ where: { id } });
    if (
      !connection ||
      (connection.requesterId !== me && connection.addresseeId !== me)
    ) {
      return NextResponse.json({ error: "Связь не найдена" }, { status: 404 });
    }

    await prisma.connection.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportError(error, { op: "network.connections.delete" });
    return NextResponse.json(
      { error: "Не удалось удалить связь" },
      { status: 500 }
    );
  }
}
