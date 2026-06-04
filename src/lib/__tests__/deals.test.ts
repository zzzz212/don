import { describe, it, expect } from "vitest";
import {
  generateInviteToken,
  reconcileClauseStatus,
  latestOpenProposal,
  latestAcceptedProposalText,
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
    pairs.map(([p, k], i) => ({ id: `a${i}`, participantId: p, kind: k, createdAt: new Date() }));

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
      { id: "c1", participantId: "sender", kind: "COMMENT", createdAt: new Date(0) },
      { id: "c2", participantId: "receiver", kind: "COMMENT", createdAt: new Date(1000) },
      { id: "e1", participantId: "sender", kind: "PROPOSE_EDIT", createdAt: new Date(2000) },
      { id: "e2", participantId: "receiver", kind: "PROPOSE_EDIT", createdAt: new Date(3000) },
    ];
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("PENDING");
  });

  it("AGREE wins over a later COMMENT (vote is not overridden by chatter)", () => {
    // Both participants AGREE, then both leave comments. The comments
    // must not flip the status back to PENDING — votes only react to
    // AGREE/DISAGREE actions.
    const actions: ClauseActionInput[] = [
      { id: "a1", participantId: "sender", kind: "AGREE", createdAt: new Date(0) },
      { id: "a2", participantId: "receiver", kind: "AGREE", createdAt: new Date(1000) },
      { id: "c1", participantId: "sender", kind: "COMMENT", createdAt: new Date(2000) },
      { id: "c2", participantId: "receiver", kind: "COMMENT", createdAt: new Date(3000) },
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
      { id: "a1", participantId: "sender", kind: "AGREE", createdAt: t0 },
      { id: "a2", participantId: "receiver", kind: "DISAGREE", createdAt: t1 },
      { id: "a3", participantId: "receiver", kind: "AGREE", createdAt: t2 },
    ];
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("AGREED");
  });
});

describe("reconcileClauseStatus — counter-propose → accept (RESOLVED)", () => {
  // Full action shape including proposal linkage. `id` is needed so an
  // ACCEPT_PROPOSAL can point back at the PROPOSE_EDIT it accepts.
  const at = (ms: number) => new Date(ms);

  it("RESOLVED when one side PROPOSE_EDITs and the OTHER side ACCEPT_PROPOSALs it", () => {
    const actions: ClauseActionInput[] = [
      { id: "a1", participantId: "sender", kind: "DISAGREE", createdAt: at(0) },
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Новый текст", createdAt: at(1000) },
      { id: "x1", participantId: "receiver", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
    ];
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("RESOLVED");
  });

  it("does NOT resolve when a party accepts its OWN proposal (self-accept ignored)", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Новый текст", createdAt: at(1000) },
      { id: "x1", participantId: "sender", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
    ];
    // Self-accept is not a meeting of the minds → falls through to vote logic → PENDING.
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("PENDING");
  });

  it("does NOT resolve when the ACCEPT_PROPOSAL references an unknown proposalId", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Новый текст", createdAt: at(1000) },
      { id: "x1", participantId: "receiver", kind: "ACCEPT_PROPOSAL", proposalId: "ghost", createdAt: at(2000) },
    ];
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("PENDING");
  });

  it("a later DISAGREE after acceptance demotes RESOLVED back to DISPUTED", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Новый текст", createdAt: at(1000) },
      { id: "x1", participantId: "receiver", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
      { id: "d1", participantId: "receiver", kind: "DISAGREE", createdAt: at(3000) },
    ];
    // A fresh DISAGREE outranks a stale acceptance → dispute reopens.
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("DISPUTED");
  });

  it("accepts the LATEST proposal — an older accepted proposal does not resolve a newer one", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Текст 1", createdAt: at(1000) },
      { id: "x1", participantId: "receiver", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
      { id: "p2", participantId: "sender", kind: "PROPOSE_EDIT", body: "Текст 2", createdAt: at(3000) },
    ];
    // p2 is the latest open proposal and is NOT yet accepted → not resolved.
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("PENDING");
  });
});

describe("latestOpenProposal", () => {
  const at = (ms: number) => new Date(ms);

  it("returns null when there are no PROPOSE_EDIT actions", () => {
    const actions: ClauseActionInput[] = [
      { id: "a1", participantId: "sender", kind: "AGREE", createdAt: at(0) },
    ];
    expect(latestOpenProposal(actions)).toBeNull();
  });

  it("returns the most recent PROPOSE_EDIT not yet accepted", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Старый", createdAt: at(1000) },
      { id: "p2", participantId: "sender", kind: "PROPOSE_EDIT", body: "Новый", createdAt: at(2000) },
    ];
    expect(latestOpenProposal(actions)?.id).toBe("p2");
  });

  it("returns null when the latest proposal has already been accepted by the counterparty", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Текст", createdAt: at(1000) },
      { id: "x1", participantId: "receiver", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
    ];
    expect(latestOpenProposal(actions)).toBeNull();
  });

  it("latestAcceptedProposalText returns the body of the accepted proposal", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Согласованный текст", createdAt: at(1000) },
      { id: "x1", participantId: "receiver", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
    ];
    expect(latestAcceptedProposalText(actions)).toBe("Согласованный текст");
  });

  it("latestAcceptedProposalText returns null with no acceptance", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Текст", createdAt: at(1000) },
    ];
    expect(latestAcceptedProposalText(actions)).toBeNull();
  });

  it("latestAcceptedProposalText ignores a self-accept and follows the settlement decision", () => {
    // A self-accept (sender accepting its own p1) is newer than the genuine
    // counterparty acceptance (receiver accepting p2), but it must NOT decide
    // the snapshot — otherwise the text written to agreedText disagrees with
    // the RESOLVED status, which settled on p2's "Y" (reviewer IMPORTANT).
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "X", createdAt: at(1000) },
      { id: "p2", participantId: "sender", kind: "PROPOSE_EDIT", body: "Y", createdAt: at(2000) },
      { id: "x1", participantId: "receiver", kind: "ACCEPT_PROPOSAL", proposalId: "p2", createdAt: at(3000) },
      { id: "x2", participantId: "sender", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(4000) },
    ];
    // The settlement (counterparty acceptance) is x1→p2; the self-accept x2→p1
    // is ignored. Snapshot must match the RESOLVED decision: "Y", not "X".
    expect(reconcileClauseStatus(actions, "sender", "receiver")).toBe("RESOLVED");
    expect(latestAcceptedProposalText(actions)).toBe("Y");
  });

  it("latestAcceptedProposalText returns null when the only acceptance is a self-accept", () => {
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Текст", createdAt: at(1000) },
      { id: "x1", participantId: "sender", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
    ];
    // No counterparty meeting of minds → no settled text to snapshot.
    expect(latestAcceptedProposalText(actions)).toBeNull();
  });

  it("latestOpenProposal still surfaces a proposal that only the proposer self-accepted", () => {
    // A self-accept must NOT hide the redline from the counterparty — the
    // clause is not resolved, so the other party must still be able to accept
    // (reviewer MINOR). Only a counterparty acceptance closes a proposal.
    const actions: ClauseActionInput[] = [
      { id: "p1", participantId: "sender", kind: "PROPOSE_EDIT", body: "Текст", createdAt: at(1000) },
      { id: "x1", participantId: "sender", kind: "ACCEPT_PROPOSAL", proposalId: "p1", createdAt: at(2000) },
    ];
    expect(latestOpenProposal(actions)?.id).toBe("p1");
  });
});
