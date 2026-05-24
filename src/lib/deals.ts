import { randomBytes } from "crypto";

// 192-bit (24 bytes → 48 hex chars) unguessable token used as the
// public `/deal/[token]` URL. Uniqueness is enforced by the DB schema's
// @unique constraint; callers should wrap creation in a retry loop on
// the rare collision (same pattern as referralCode — foot-gun #38).
export function generateInviteToken(): string {
  return randomBytes(24).toString("hex");
}

export {
  reconcileClauseStatus,
  type ClauseActionInput,
  type ClauseStatus,
} from "./deal-status";

import { prisma } from "./db";
import { Prisma } from "@prisma/client";
import type { AnalysisRisk } from "./ai/schemas/analyze";

export interface CreateDealArgs {
  ownerId: string;
  orgId: string;
  documentId: string;
  counterpartyEmail: string;
  counterpartyName?: string;
  title?: string;
}

export interface CreateDealResult {
  deal: { id: string; inviteToken: string };
  clauseCount: number;
}

// Create a Deal from an already-analysed Document. Materialises one
// DealClause per AnalysisRisk (clauses without risks aren't tracked —
// only the contentious points need negotiation). Also creates the
// SENDER and RECEIVER DealParticipant rows. The RECEIVER row starts
// blank (no sessionId, no userId) — it gets filled in when the
// receiver first opens /deal/[token].
//
// Throws if the document has no Analysis (caller must wait for analyze
// to finish). Sprint 14 keeps this synchronous for simplicity; if it
// becomes a perf issue, Sprint 15 promotes to background job.
export async function createDealFromDocument(
  args: CreateDealArgs
): Promise<CreateDealResult> {
  // Owner check is scoped to BOTH userId AND orgId. A user who is a
  // member of multiple workspaces could otherwise create a deal in
  // workspace A referencing a document from workspace B — broken
  // org-scoping in downstream queries.
  const doc = await prisma.document.findFirst({
    where: { id: args.documentId, userId: args.ownerId, orgId: args.orgId },
    include: { analysis: true },
  });
  if (!doc) throw new Error("Document not found or not owned by sender");
  if (!doc.analysis) throw new Error("Document has not been analysed yet");

  // Analysis.risks is a JSON string column. Parse and verify shape —
  // a malformed-but-valid JSON value (e.g. legacy '"string"' or '{}')
  // would otherwise crash .map() at the call site with a TypeError.
  let parsedRisks: AnalysisRisk[];
  try {
    const raw: unknown = JSON.parse(doc.analysis.risks);
    if (!Array.isArray(raw)) {
      throw new Error("Analysis.risks is not an array");
    }
    parsedRisks = raw as AnalysisRisk[];
  } catch (err) {
    throw new Error(
      err instanceof Error && err.message.includes("not an array")
        ? "Analysis.risks is not an array"
        : "Analysis.risks is malformed JSON"
    );
  }

  // Unique inviteToken via retry. Collisions on 192-bit are
  // astronomically unlikely but the @unique constraint will catch it.
  // The loop verifies the LAST generated token, not just the first three —
  // breaking out the moment a non-colliding token appears, throwing on
  // exhaustion rather than silently using an unverified token.
  let token = generateInviteToken();
  let attempt = 0;
  while (true) {
    const existing = await prisma.deal.findUnique({
      where: { inviteToken: token },
      select: { id: true },
    });
    if (!existing) break;
    attempt += 1;
    if (attempt >= 5) {
      throw new Error("Failed to generate unique inviteToken after 5 attempts");
    }
    token = generateInviteToken();
  }

  const clauseData = parsedRisks.map((risk, idx) => ({
    ord: idx,
    text: risk.originalText,
    riskLevel: risk.level,
    yourSide: {
      description: risk.description,
      consequence: risk.consequence ?? null,
      recommendation: risk.recommendation,
      legalReference: risk.legalReference,
      // NB: risk.recommendedText is intentionally NOT stored on the
      // clause. The clause is exposed to the receiver via the public
      // by-token endpoint, and the sender's proposed replacement text
      // is a negotiating position — leaking it up-front gives away
      // their opening offer. If the sender needs it, the original
      // Analysis row still has it.
    } as Prisma.InputJsonValue,
    // Prisma requires Prisma.JsonNull (not plain null) for nullable
    // JSON columns when explicitly setting null (foot-gun: JSON? fields).
    theirSide: (risk.counterPerspective ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
  }));

  const deal = await prisma.$transaction(async (tx) => {
    return tx.deal.create({
      data: {
        ownerId: args.ownerId,
        orgId: args.orgId,
        documentId: args.documentId,
        title: args.title ?? doc.fileName,
        inviteToken: token,
        participants: {
          create: [
            { role: "SENDER", userId: args.ownerId },
            { role: "RECEIVER", guestEmail: args.counterpartyEmail, guestName: args.counterpartyName },
          ],
        },
        clauses: {
          create: clauseData,
        },
      },
      select: { id: true, inviteToken: true },
    });
  });

  return {
    deal: { id: deal.id, inviteToken: deal.inviteToken },
    clauseCount: clauseData.length,
  };
}
