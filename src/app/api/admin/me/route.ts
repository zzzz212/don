import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminUserId } from "@/lib/admin";

// GET /api/admin/me
//   Boolean check the OrgSwitcher uses to decide whether to render the
//   "Админ-панель" entry. Always 200 — the response payload tells the
//   client whether the user is admin.
export async function GET() {
  const session = await auth();
  return NextResponse.json({
    isAdmin: isAdminUserId(session?.user?.id),
  });
}
