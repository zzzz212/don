import { describe, it, expect } from "vitest";
import { mergeDealClauses, type MergeClause } from "../deal-merge";

const SENDER = "p_sender";
const RECEIVER = "p_receiver";

function clause(
  id: string,
  status: MergeClause["status"],
  actions: MergeClause["actions"]
): MergeClause {
  return { id, status, actions };
}

function action(
  id: string,
  participantId: string,
  kind: string,
  createdAt: string
): MergeClause["actions"][number] {
  return {
    id,
    kind,
    body: null,
    createdAt,
    participant: { id: participantId, role: "RECEIVER", guestName: null },
  };
}

describe("mergeDealClauses", () => {
  it("takes the server clause when there are no optimistic actions", () => {
    const prev = [clause("c1", "PENDING", [])];
    const incoming = [
      clause("c1", "DISPUTED", [
        action("srv1", RECEIVER, "DISAGREE", "2026-06-04T12:00:00.000Z"),
      ]),
    ];
    const merged = mergeDealClauses(prev, incoming, SENDER, RECEIVER);
    expect(merged[0].status).toBe("DISPUTED");
    expect(merged[0].actions.map((a) => a.id)).toEqual(["srv1"]);
  });

  it("preserves an optimistic action the server has not echoed yet", () => {
    const optimistic = action(
      "optimistic-1",
      RECEIVER,
      "AGREE",
      "2026-06-04T12:00:05.000Z"
    );
    const prev = [clause("c1", "PENDING", [optimistic])];
    const incoming = [clause("c1", "PENDING", [])]; // server hasn't seen it
    const merged = mergeDealClauses(prev, incoming, SENDER, RECEIVER);
    expect(merged[0].actions.map((a) => a.id)).toEqual(["optimistic-1"]);
  });

  it("drops the optimistic action once a real server action of same kind from same participant arrives", () => {
    const optimistic = action(
      "optimistic-1",
      RECEIVER,
      "AGREE",
      "2026-06-04T12:00:05.000Z"
    );
    const real = action(
      "srvReal",
      RECEIVER,
      "AGREE",
      "2026-06-04T12:00:06.000Z"
    );
    const prev = [clause("c1", "PENDING", [optimistic])];
    const incoming = [clause("c1", "AGREED", [real])];
    const merged = mergeDealClauses(prev, incoming, SENDER, RECEIVER);
    expect(merged[0].actions.map((a) => a.id)).toEqual(["srvReal"]);
  });

  it("recomputes status from merged actions (sender+receiver AGREE → AGREED)", () => {
    const optimistic = action(
      "optimistic-1",
      RECEIVER,
      "AGREE",
      "2026-06-04T12:00:05.000Z"
    );
    const prev = [
      clause("c1", "PENDING", [
        action("srvS", SENDER, "AGREE", "2026-06-04T11:59:00.000Z"),
        optimistic,
      ]),
    ];
    // Server payload still only shows the sender AGREE.
    const incoming = [
      clause("c1", "PENDING", [
        action("srvS", SENDER, "AGREE", "2026-06-04T11:59:00.000Z"),
      ]),
    ];
    const merged = mergeDealClauses(prev, incoming, SENDER, RECEIVER);
    expect(merged[0].actions.map((a) => a.id)).toEqual(["srvS", "optimistic-1"]);
    expect(merged[0].status).toBe("AGREED");
  });

  it("falls back to the incoming clause when prev has no match", () => {
    const prev: MergeClause[] = [];
    const incoming = [clause("c2", "PENDING", [])];
    const merged = mergeDealClauses(prev, incoming, SENDER, RECEIVER);
    expect(merged.map((c) => c.id)).toEqual(["c2"]);
  });
});
