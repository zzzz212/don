// Pure clause-status reconciliation logic, extracted from src/lib/deals.ts
// so the client bundle can import it without dragging in Prisma. Used by
// the Deal Room optimistic UI to predict the new status of a clause
// immediately after a local agree/disagree action, before the server
// round-trip canonicalises everything.
//
// Rule: take each participant's most recent AGREE/DISAGREE (ignoring
// COMMENT and PROPOSE_EDIT actions). If both AGREE → AGREED. If at least
// one DISAGREE → DISPUTED. Otherwise → PENDING.

export interface ClauseActionInput {
  participantId: string;
  kind: "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT";
  createdAt: Date;
}

export type ClauseStatus = "PENDING" | "AGREED" | "DISPUTED" | "RESOLVED";

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
