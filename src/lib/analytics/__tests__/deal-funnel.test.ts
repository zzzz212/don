import { describe, it, expect } from "vitest";
import {
  DEAL_FUNNEL_EVENTS,
  dealFunnelDistinctId,
} from "../deal-funnel";

describe("DEAL_FUNNEL_EVENTS", () => {
  it("exposes the six viral-funnel event names as a const map", () => {
    expect(DEAL_FUNNEL_EVENTS).toEqual({
      dealCreated: "deal_created",
      dealLinkOpened: "deal_link_opened",
      receiverIdentified: "receiver_identified",
      clauseAgreed: "clause_agreed",
      clauseDisputed: "clause_disputed",
      dealAgreedComplete: "deal_agreed_complete",
    });
  });

  it("maps a reconciled clause status to its funnel event, or null", () => {
    expect(clauseEventFor("AGREED")).toBe("clause_agreed");
    expect(clauseEventFor("DISPUTED")).toBe("clause_disputed");
    expect(clauseEventFor("PENDING")).toBeNull();
    expect(clauseEventFor("RESOLVED")).toBeNull();
  });
});

describe("dealFunnelDistinctId", () => {
  it("prefers the owner cuid when present", () => {
    expect(dealFunnelDistinctId({ ownerId: "user_123", sessionId: "sess_abc" })).toBe(
      "user_123"
    );
  });

  it("falls back to the session id for anonymous receivers", () => {
    expect(dealFunnelDistinctId({ ownerId: null, sessionId: "sess_abc" })).toBe(
      "sess_abc"
    );
  });

  it("never returns null and never returns an email-like value", () => {
    const id = dealFunnelDistinctId({ ownerId: null, sessionId: null });
    expect(id).toBe("anonymous");
    // PII guard: the resolver only ever sees opaque ids, never an email.
    expect(id).not.toContain("@");
  });
});

// Imported below the describe blocks so the first failing run reports the
// missing export rather than a syntax error.
import { clauseEventFor } from "../deal-funnel";
