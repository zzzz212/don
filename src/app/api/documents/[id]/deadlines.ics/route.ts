import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildIcsCalendar, type IcsEvent } from "@/lib/ics";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  expiry: "Истечение договора",
  renewal: "Автопролонгация",
  payment: "Оплата",
  notice: "Уведомление",
  other: "Срок",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      fileName: true,
      deadlines: {
        where: { dismissed: false },
        orderBy: { dueDate: "asc" },
      },
    },
  });
  if (!doc) {
    return new Response("Not found", { status: 404 });
  }
  if (doc.userId !== session.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  const events: IcsEvent[] = doc.deadlines.map((d) => ({
    uid: `${doc.id}-${d.id}@yakso.ru`,
    date: d.dueDate,
    summary: `${KIND_LABEL[d.kind] ?? "Срок"} — ${d.label}`,
    description: `Договор: ${doc.fileName}`,
  }));

  const ics = buildIcsCalendar(events);

  // Sanitise filename for Content-Disposition (no quotes, no semicolons).
  const safeFile = doc.fileName.replace(/[";\r\n]/g, "_").slice(0, 80);

  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${safeFile}-deadlines.ics"`,
    },
  });
}
