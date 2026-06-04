import { NextRequest, NextResponse } from "next/server";
import { runAnalyzeJob } from "@/lib/analyze/run";
import { reportError } from "@/lib/telemetry";

// Background worker endpoint — called by kickOffBackgroundAnalyze and
// by the stuck-job cron. NOT publicly accessible: requires
// x-internal-token header matching INTERNAL_SECRET.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    console.error("[analyze.run] INTERNAL_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const tokenHeader = request.headers.get("x-internal-token");
  if (tokenHeader !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      analysisId?: string;
    };
    if (!body.analysisId || typeof body.analysisId !== "string") {
      return NextResponse.json({ error: "analysisId required" }, { status: 400 });
    }

    const result = await runAnalyzeJob(body.analysisId);
    return NextResponse.json({ ok: true, claimed: result.claimed });
  } catch (error) {
    await reportError(error, { op: "analyze.run.endpoint" });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
