import { describe, it, expect } from "vitest";
import { _redactForTests as redact } from "../audit";

describe("audit redact", () => {
  it("strips top-level sensitive keys", () => {
    const out = redact({ password: "hunter2", role: "OWNER" }) as Record<
      string,
      unknown
    >;
    expect(out.password).toBe("[redacted]");
    expect(out.role).toBe("OWNER");
  });

  it("strips email + phone — defensive PII", () => {
    const out = redact({ email: "x@y.z", phone: "+7..." }) as Record<
      string,
      unknown
    >;
    expect(out.email).toBe("[redacted]");
    expect(out.phone).toBe("[redacted]");
  });

  it("strips nested sensitive keys", () => {
    const out = redact({
      action: "checkout",
      data: { token: "secret-token", amount: 100 },
    }) as Record<string, unknown>;
    const inner = out.data as Record<string, unknown>;
    expect(inner.token).toBe("[redacted]");
    expect(inner.amount).toBe(100);
  });

  it("strips inside arrays", () => {
    const out = redact({
      list: [
        { apiKey: "k1", id: "a" },
        { apiKey: "k2", id: "b" },
      ],
    }) as Record<string, unknown>;
    const list = out.list as Array<Record<string, unknown>>;
    expect(list[0].apiKey).toBe("[redacted]");
    expect(list[0].id).toBe("a");
    expect(list[1].apiKey).toBe("[redacted]");
  });

  it("preserves null and primitives", () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact(42)).toBe(42);
    expect(redact("hi")).toBe("hi");
    expect(redact(true)).toBe(true);
  });

  it("preserves the shape of safe objects", () => {
    const input = {
      action: "member.invited",
      role: "ADMIN",
      target: "membership_xyz",
      payload: { newRole: "ADMIN", oldRole: "MEMBER" },
    };
    expect(redact(input)).toEqual(input);
  });
});
