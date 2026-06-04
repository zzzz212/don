// Pure clause-status reconciliation logic, extracted from src/lib/deals.ts
// so the client bundle can import it without dragging in Prisma. Used by
// the Deal Room optimistic UI to predict the new status of a clause
// immediately after a local action, before the server round-trip
// canonicalises everything.
//
// Status rules, in priority order:
//   1. The most recent AGREE/DISAGREE per participant is that
//      participant's standing "vote".
//   2. A PROPOSE_EDIT accepted by the COUNTERPARTY (ACCEPT_PROPOSAL whose
//      proposalId points at it) settles the clause on the new text →
//      RESOLVED, unless a fresher DISAGREE outranks the acceptance.
//   3. Otherwise: any DISAGREE → DISPUTED; both AGREE → AGREED; else PENDING.
// COMMENT and a bare PROPOSE_EDIT (without a counterparty acceptance) never
// move the status on their own.

export interface ClauseActionInput {
  id: string;
  participantId: string;
  kind: "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT" | "ACCEPT_PROPOSAL";
  // PROPOSE_EDIT carries the proposed replacement text in `body`.
  body?: string | null;
  // ACCEPT_PROPOSAL references the PROPOSE_EDIT action it accepts.
  proposalId?: string | null;
  createdAt: Date;
}

export type ClauseStatus = "PENDING" | "AGREED" | "DISPUTED" | "RESOLVED";

// A genuine settlement: an ACCEPT_PROPOSAL whose target PROPOSE_EDIT exists
// and was authored by the OTHER party (self-accepts never settle a clause —
// they are not a meeting of the minds). The single source of truth for the
// counterparty-acceptance rule, shared by reconcileClauseStatus,
// latestAcceptedProposalText, and latestOpenProposal so the settled status,
// the snapshotted text, and the rendered redline can never disagree.
interface Settlement {
  accept: ClauseActionInput;
  proposal: ClauseActionInput;
}

function latestSettlement(actions: ClauseActionInput[]): Settlement | null {
  const byId = new Map(actions.map((a) => [a.id, a]));
  return (
    actions
      .filter((a) => a.kind === "ACCEPT_PROPOSAL" && a.proposalId)
      .map((a) => ({ accept: a, proposal: byId.get(a.proposalId as string) }))
      .filter(
        (x): x is Settlement =>
          x.proposal !== undefined &&
          x.proposal.kind === "PROPOSE_EDIT" &&
          x.proposal.participantId !== x.accept.participantId
      )
      .sort(
        (a, b) => b.accept.createdAt.getTime() - a.accept.createdAt.getTime()
      )[0] ?? null
  );
}

// The most recent unaccepted PROPOSE_EDIT in the action log, or null. A
// proposal is "open" until a COUNTERPARTY acceptance settles it — a
// proposer self-accepting its own edit must NOT hide the redline, since
// the clause is not actually resolved and the other party must still be
// able to accept. Used by the clause card to render the redline + accept
// button, and by reconcileClauseStatus to detect settlement.
export function latestOpenProposal(
  actions: ClauseActionInput[]
): ClauseActionInput | null {
  const byId = new Map(actions.map((a) => [a.id, a]));
  const settledProposalIds = new Set(
    actions
      .filter((a): a is ClauseActionInput & { proposalId: string } => {
        if (a.kind !== "ACCEPT_PROPOSAL" || !a.proposalId) return false;
        const proposal = byId.get(a.proposalId);
        // Only a counterparty acceptance closes a proposal.
        return (
          proposal?.kind === "PROPOSE_EDIT" &&
          proposal.participantId !== a.participantId
        );
      })
      .map((a) => a.proposalId)
  );
  const open = actions
    .filter((a) => a.kind === "PROPOSE_EDIT" && !settledProposalIds.has(a.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return open[0] ?? null;
}

// Body text of the proposal accepted in the latest genuine settlement, or
// null. Snapshotted into DealClause.agreedText on settlement so the final
// document can export the agreed wording. Derived from the SAME settlement
// selection as reconcileClauseStatus, so the snapshotted text can never
// disagree with the RESOLVED decision (a newer self-accept does not steer it).
export function latestAcceptedProposalText(
  actions: ClauseActionInput[]
): string | null {
  return latestSettlement(actions)?.proposal.body ?? null;
}

export function reconcileClauseStatus(
  actions: ClauseActionInput[],
  senderId: string,
  receiverId: string
): ClauseStatus {
  // Latest standing vote per participant. AGREE / DISAGREE only — an
  // ACCEPT_PROPOSAL is handled separately as settlement, not as a vote.
  const latestVote = (participantId: string): "AGREE" | "DISAGREE" | null => {
    const votes = actions
      .filter((a) => a.participantId === participantId)
      .filter((a) => a.kind === "AGREE" || a.kind === "DISAGREE")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return (votes[0]?.kind as "AGREE" | "DISAGREE" | undefined) ?? null;
  };

  // Settlement: the most recent counterparty acceptance of an open edit. If
  // a DISAGREE or a fresher PROPOSE_EDIT is cast newer than the acceptance,
  // the settlement is stale and the dispute reopens.
  const settlement = latestSettlement(actions);

  if (settlement) {
    const acceptedAt = settlement.accept.createdAt.getTime();
    // A fresher DISAGREE reopens the dispute; a fresher PROPOSE_EDIT
    // supersedes the settled wording with a new, still-unaccepted offer.
    // Either outranks a stale acceptance → no longer RESOLVED.
    const supersedingAction = actions.some(
      (a) =>
        (a.kind === "DISAGREE" || a.kind === "PROPOSE_EDIT") &&
        a.createdAt.getTime() > acceptedAt
    );
    if (!supersedingAction) return "RESOLVED";
  }

  const senderVote = latestVote(senderId);
  const receiverVote = latestVote(receiverId);

  if (senderVote === "DISAGREE" || receiverVote === "DISAGREE") return "DISPUTED";
  if (senderVote === "AGREE" && receiverVote === "AGREE") return "AGREED";
  return "PENDING";
}
