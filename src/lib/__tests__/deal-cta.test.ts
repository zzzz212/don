import { describe, it, expect } from "vitest";
import { shouldShowReceiverCta, type ReceiverCtaState } from "../deal-cta";

// The CTA is the network-first pivot's loop-closer: only the RECEIVER
// sees it, and only at peak intent — once they have cast at least one
// vote, or once the whole deal is AGREED. Senders never see it; a
// receiver who has not yet engaged does not see it either.

const base: ReceiverCtaState = {
  myRole: "RECEIVER",
  hasVoted: false,
  dealStatus: "ACTIVE",
};

describe("shouldShowReceiverCta", () => {
  it("hides for the sender even after voting on an AGREED deal", () => {
    expect(
      shouldShowReceiverCta({
        ...base,
        myRole: "SENDER",
        hasVoted: true,
        dealStatus: "AGREED",
      })
    ).toBe(false);
  });

  it("hides for an anonymous viewer with no role", () => {
    expect(
      shouldShowReceiverCta({ ...base, myRole: null, hasVoted: true })
    ).toBe(false);
  });

  it("hides for a receiver who has not yet voted on an active deal", () => {
    expect(shouldShowReceiverCta(base)).toBe(false);
  });

  it("shows for a receiver after their first vote", () => {
    expect(shouldShowReceiverCta({ ...base, hasVoted: true })).toBe(true);
  });

  it("shows for a receiver once the deal is AGREED, even with no vote", () => {
    expect(
      shouldShowReceiverCta({ ...base, hasVoted: false, dealStatus: "AGREED" })
    ).toBe(true);
  });
});
