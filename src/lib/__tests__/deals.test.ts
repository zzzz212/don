import { describe, it, expect } from "vitest";
import {
  generateInviteToken,
  reconcileClauseStatus,
  type ClauseActionInput,
} from "../deals";

describe("generateInviteToken", () => {
  it("produces a 48-char hex string (192 bits)", () => {
    const token = generateInviteToken();
    expect(token).toMatch(/^[0-9a-f]{48}$/);
  });

  it("is different across consecutive calls", () => {
    const tokens = new Set([
      generateInviteToken(),
      generateInviteToken(),
      generateInviteToken(),
    ]);
    expect(tokens.size).toBe(3);
  });
});

describe("reconcileClauseStatus", () => {
  // Helper: produce a ClauseActionInput[] from terse [participantId, kind] pairs.
  const acts = (pairs: Array<[string, "AGREE" | "DISAGREE"]>): ClauseActionInput[] =>
    pairs.map(([p, k]) => ({ participantId: p, kind: k, createdAt: new Date() }));

  it("returns PENDING when there are no actions", () => {
    expect(reconcileClauseStatus(acts([]), "sender", "receiver")).toBe("PENDING");
  });

  it("returns PENDING when only one side has acted", () => {
    expect(reconcileClauseStatus(acts([["sender", "AGREE"]]), "sender", "receiver"))
      .toBe("PENDING");
  });

  it("returns AGREED when both sides AGREE", () => {
    expect(
      reconcileClauseStatus(
        acts([["sender", "AGREE"], ["receiver", "AGREE"]]),
        "sender",
        "receiver"
      )
    ).toBe("AGREED");
  });

  it("returns DISPUTED when at least one side DISAGREEs", () => {
    expect(
      reconcileClauseStatus(
        acts([["sender", "AGREE"], ["receiver", "DISAGREE"]]),
        "sender",
        "receiver"
      )
    ).toBe("DISPUTED");
  });

  it("ignores COMMENT and PROPOSE_EDIT actions when computing status", () => {
    // Both participants only commented + proposed edits — no AGREE/DISAGREE.
    // Should stay PENDING despite the activity.
    const actions: ClauseActionInput[] = [
      { participantId: "sender", kind: "COMMENT", createdAt: new Date(0) },
      { participantId: "receiver", kind: "COMMENT", createdAt: new Date(1000) },
      { participantId: "sender", kind: "PROPOSE_EDIT", createdAt: new Date(2000) },
      { participantId: "receiver", kind: "PROPOSE_EDIT", createdAt: new Date(3000) },
    ];
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("PENDING");
  });

  it("AGREE wins over a later COMMENT (vote is not overridden by chatter)", () => {
    // Both participants AGREE, then both leave comments. The comments
    // must not flip the status back to PENDING — votes only react to
    // AGREE/DISAGREE actions.
    const actions: ClauseActionInput[] = [
      { participantId: "sender", kind: "AGREE", createdAt: new Date(0) },
      { participantId: "receiver", kind: "AGREE", createdAt: new Date(1000) },
      { participantId: "sender", kind: "COMMENT", createdAt: new Date(2000) },
      { participantId: "receiver", kind: "COMMENT", createdAt: new Date(3000) },
    ];
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("AGREED");
  });

  it("uses the LATEST action per participant (overrides earlier votes)", () => {
    // Three actions in time order — receiver first DISAGREEs then AGREEs.
    // Spacing the timestamps so the LATEST AGREE wins.
    const t0 = new Date(0);
    const t1 = new Date(1000);
    const t2 = new Date(2000);
    const actions: ClauseActionInput[] = [
      { participantId: "sender", kind: "AGREE", createdAt: t0 },
      { participantId: "receiver", kind: "DISAGREE", createdAt: t1 },
      { participantId: "receiver", kind: "AGREE", createdAt: t2 },
    ];
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("AGREED");
  });
});
