// Pure decision logic for the receiver→sender conversion CTA. Kept out
// of the page component so the client bundle stays thin and the logic is
// unit-testable (vitest excludes src/app). The CTA closes the network-
// first loop: a contractor who just dissected a real contract is at peak
// intent — show them the door to analysing their own, but only the
// RECEIVER and only once they have engaged.

export interface ReceiverCtaState {
  myRole: "SENDER" | "RECEIVER" | null;
  /** True once this participant has cast at least one AGREE/DISAGREE. */
  hasVoted: boolean;
  dealStatus: "ACTIVE" | "AGREED";
}

export function shouldShowReceiverCta(state: ReceiverCtaState): boolean {
  if (state.myRole !== "RECEIVER") return false;
  return state.hasVoted || state.dealStatus === "AGREED";
}
