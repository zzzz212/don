// Reconcile a freshly-polled by-token deal payload against the locally
// held state WITHOUT blind-replacing it. The Deal Room applies actions
// optimistically (synthetic ids prefixed "optimistic-", see deal-room.tsx)
// before the server round-trip. A 4-5s background poll must keep any such
// in-flight action alive until the server's own row appears, otherwise the
// user's just-cast vote visibly flickers away. We carry surviving
// optimistic actions over and re-derive each clause status with the same
// pure reconcileClauseStatus the server uses, so the merged view matches
// what the server will canonicalise to.

import {
  reconcileClauseStatus,
  type ClauseActionInput,
  type ClauseStatus,
} from "./deal-status";

export interface MergeAction {
  id: string;
  kind: string;
  body: string | null;
  // ACCEPT_PROPOSAL references the PROPOSE_EDIT it accepts; carried through
  // so the merged status reconciles settlements exactly as the server does.
  proposalId?: string | null;
  createdAt: string;
  participant: {
    id: string;
    role: "SENDER" | "RECEIVER";
    guestName: string | null;
  };
}

export interface MergeClause {
  id: string;
  status: ClauseStatus;
  actions: MergeAction[];
}

const OPTIMISTIC_PREFIX = "optimistic-";

function isOptimistic(action: MergeAction): boolean {
  return action.id.startsWith(OPTIMISTIC_PREFIX);
}

/**
 * Merge the polled (incoming) clauses over the locally-held (prev) clauses,
 * preserving optimistic actions the server has not yet echoed. Generic over
 * the concrete clause shape so the component's richer ClauseView can be
 * passed through unchanged (it structurally extends MergeClause).
 */
export function mergeDealClauses<C extends MergeClause>(
  prev: C[],
  incoming: C[],
  senderId: string,
  receiverId: string
): C[] {
  const prevById = new Map(prev.map((c) => [c.id, c]));

  return incoming.map((serverClause) => {
    const local = prevById.get(serverClause.id);
    if (!local) return serverClause;

    // Keep only optimistic actions that the server hasn't superseded yet:
    // an optimistic action is "settled" once a real (non-optimistic) action
    // of the same kind from the same participant is present in the payload.
    const survivingOptimistic = local.actions.filter((a) => {
      if (!isOptimistic(a)) return false;
      const settled = serverClause.actions.some(
        (s) =>
          !isOptimistic(s) &&
          s.participant.id === a.participant.id &&
          s.kind === a.kind
      );
      return !settled;
    });

    const mergedActions = [...serverClause.actions, ...survivingOptimistic];

    const reconciled: ClauseActionInput[] = mergedActions.map((a) => ({
      id: a.id,
      participantId: a.participant.id,
      kind: a.kind as ClauseActionInput["kind"],
      body: a.body,
      proposalId: a.proposalId ?? null,
      createdAt: new Date(a.createdAt),
    }));

    return {
      ...serverClause,
      actions: mergedActions,
      status: reconcileClauseStatus(reconciled, senderId, receiverId),
    };
  });
}
