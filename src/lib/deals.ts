import { randomBytes } from "crypto";

// 192-bit (24 bytes → 48 hex chars) unguessable token used as the
// public `/deal/[token]` URL. Uniqueness is enforced by the DB schema's
// @unique constraint; callers should wrap creation in a retry loop on
// the rare collision (same pattern as referralCode — foot-gun #38).
export function generateInviteToken(): string {
  return randomBytes(24).toString("hex");
}

export interface ClauseActionInput {
  participantId: string;
  kind: "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT";
  createdAt: Date;
}

export type ClauseStatus = "PENDING" | "AGREED" | "DISPUTED" | "RESOLVED";

// Given the full action history for a single clause and the two
// participant IDs (sender + receiver), determine the clause status.
//
// Rule: take each participant's most recent AGREE/DISAGREE (ignoring
// COMMENT and PROPOSE_EDIT actions). If both AGREE → AGREED. If at
// least one DISAGREE → DISPUTED. Otherwise → PENDING.
//
// RESOLVED is reserved for clauses that were DISPUTED but later both
// AGREE'd — the reconciliation produces AGREED for that case; the
// `RESOLVED` distinction is tracked separately in Sprint 15 (history).
export function reconcileClauseStatus(
  actions: ClauseActionInput[],
  senderId: string,
  receiverId: string
): ClauseStatus {
  const latestVote = (participantId: string): "AGREE" | "DISAGREE" | null => {
    const votes = actions
      .filter((a) => a.participantId === participantId)
      .filter((a) => a.kind === "AGREE" || a.kind === "DISAGREE")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return (votes[0]?.kind as "AGREE" | "DISAGREE" | undefined) ?? null;
  };

  const senderVote = latestVote(senderId);
  const receiverVote = latestVote(receiverId);

  if (senderVote === "DISAGREE" || receiverVote === "DISAGREE") return "DISPUTED";
  if (senderVote === "AGREE" && receiverVote === "AGREE") return "AGREED";
  return "PENDING";
}

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
  const doc = await prisma.document.findFirst({
    where: { id: args.documentId, userId: args.ownerId },
    include: { analysis: true },
  });
  if (!doc) throw new Error("Document not found or not owned by sender");
  if (!doc.analysis) throw new Error("Document has not been analysed yet");

  // Analysis.risks is a JSON string column. Parse and treat as risks[].
  let parsedRisks: AnalysisRisk[];
  try {
    parsedRisks = JSON.parse(doc.analysis.risks) as AnalysisRisk[];
  } catch {
    throw new Error("Analysis.risks is malformed JSON");
  }

  // Unique inviteToken via retry. Collisions on 192-bit are
  // astronomically unlikely but the @@unique constraint will catch it.
  let token = generateInviteToken();
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await prisma.deal.findUnique({
      where: { inviteToken: token },
    });
    if (!existing) break;
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
      recommendedText: risk.recommendedText,
      legalReference: risk.legalReference,
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
