import { describe, it, expect } from "vitest";
import {
  canCancelSubscription,
  resolveExpiryDowngrade,
} from "../cancel";

describe("canCancelSubscription", () => {
  it("allows cancelling an ACTIVE subscription not already scheduled to cancel", () => {
    const r = canCancelSubscription({
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
    });
    expect(r).toEqual({ ok: true });
  });

  it("rejects when there is no subscription row", () => {
    const r = canCancelSubscription(null);
    expect(r).toEqual({ ok: false, reason: "NO_SUBSCRIPTION" });
  });

  it("rejects an already-scheduled cancel as a no-op (idempotent UI guard)", () => {
    const r = canCancelSubscription({
      status: "ACTIVE",
      cancelAtPeriodEnd: true,
    });
    expect(r).toEqual({ ok: false, reason: "ALREADY_SCHEDULED" });
  });

  it("rejects a subscription that is not ACTIVE (already CANCELED / PAST_DUE)", () => {
    expect(canCancelSubscription({ status: "CANCELED", cancelAtPeriodEnd: false }))
      .toEqual({ ok: false, reason: "NOT_ACTIVE" });
    expect(canCancelSubscription({ status: "PAST_DUE", cancelAtPeriodEnd: false }))
      .toEqual({ ok: false, reason: "NOT_ACTIVE" });
  });
});

describe("resolveExpiryDowngrade", () => {
  const NOW = new Date("2026-06-04T12:00:00.000Z");
  const past = new Date("2026-06-01T00:00:00.000Z");
  const future = new Date("2026-07-01T00:00:00.000Z");

  it("downgrades a canceled paid sub whose period has ended", () => {
    const r = resolveExpiryDowngrade(
      { status: "ACTIVE", cancelAtPeriodEnd: true, currentPeriodEnd: past },
      NOW
    );
    expect(r).toEqual({ downgrade: true });
  });

  it("does NOT downgrade when the canceled period is still running", () => {
    const r = resolveExpiryDowngrade(
      { status: "ACTIVE", cancelAtPeriodEnd: true, currentPeriodEnd: future },
      NOW
    );
    expect(r).toEqual({ downgrade: false });
  });

  it("does NOT downgrade an active sub that was never canceled, even past period end (renewal owns it)", () => {
    // Auto-renew isn't built; a non-canceled sub past its end is the
    // renewal-cron's job, NOT the expiry-downgrade's — we must never
    // strip a paying user who simply hasn't been re-charged yet.
    const r = resolveExpiryDowngrade(
      { status: "ACTIVE", cancelAtPeriodEnd: false, currentPeriodEnd: past },
      NOW
    );
    expect(r).toEqual({ downgrade: false });
  });

  it("treats the exact boundary instant as not-yet-expired", () => {
    const r = resolveExpiryDowngrade(
      { status: "ACTIVE", cancelAtPeriodEnd: true, currentPeriodEnd: NOW },
      NOW
    );
    expect(r).toEqual({ downgrade: false });
  });

  it("returns no downgrade for a null subscription", () => {
    expect(resolveExpiryDowngrade(null, NOW)).toEqual({ downgrade: false });
  });

  it("does not re-downgrade an already-CANCELED row (idempotent)", () => {
    // Once applied, status flips to CANCELED. A second pass must be a
    // no-op so we don't churn writes on every status read.
    const r = resolveExpiryDowngrade(
      { status: "CANCELED", cancelAtPeriodEnd: true, currentPeriodEnd: past },
      NOW
    );
    expect(r).toEqual({ downgrade: false });
  });
});
