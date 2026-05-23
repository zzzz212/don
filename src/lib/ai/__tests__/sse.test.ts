import { describe, it, expect } from "vitest";
import { encodeStreamEvent, encodeHeartbeat, SSE_HEADERS } from "../sse";
import type { Usage } from "../types";

const decoder = new TextDecoder();
const decode = (bytes: Uint8Array) => decoder.decode(bytes);

// Parse one encoded SSE block back into { event, data }.
function parseSse(bytes: Uint8Array): { event: string; data: unknown } {
  const raw = decode(bytes);
  const eventMatch = raw.match(/^event: (.+)$/m);
  const dataMatch = raw.match(/^data: (.+)$/m);
  return {
    event: eventMatch?.[1] ?? "",
    data: dataMatch ? JSON.parse(dataMatch[1]) : undefined,
  };
}

const SAMPLE_USAGE: Usage = {
  inputTokens: 100,
  outputTokens: 50,
  cachedInputTokens: 20,
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  latencyMs: 1234,
};

describe("encodeStreamEvent — wire format", () => {
  it("terminates every event with a blank line (block separator)", () => {
    expect(decode(encodeStreamEvent({ kind: "done" })).endsWith("\n\n")).toBe(
      true
    );
  });

  it("names the event line after the event kind", () => {
    expect(parseSse(encodeStreamEvent({ kind: "done" })).event).toBe("done");
  });

  it("delta carries the text payload", () => {
    const { event, data } = parseSse(
      encodeStreamEvent({ kind: "delta", text: "привет" })
    );
    expect(event).toBe("delta");
    expect(data).toEqual({ text: "привет" });
  });

  it("usage carries the full usage object", () => {
    const { event, data } = parseSse(
      encodeStreamEvent({ kind: "usage", usage: SAMPLE_USAGE })
    );
    expect(event).toBe("usage");
    expect(data).toEqual({ usage: SAMPLE_USAGE });
  });

  it("error carries the message", () => {
    const { event, data } = parseSse(
      encodeStreamEvent({ kind: "error", message: "boom" })
    );
    expect(event).toBe("error");
    expect(data).toEqual({ message: "boom" });
  });

  it("saved passes the payload through verbatim", () => {
    const payload = { versionId: "v_123", versionNumber: 4 };
    const { event, data } = parseSse(
      encodeStreamEvent({ kind: "saved", payload })
    );
    expect(event).toBe("saved");
    expect(data).toEqual(payload);
  });

  it("mode carries the mode and optional reason", () => {
    const { event, data } = parseSse(
      encodeStreamEvent({ kind: "mode", mode: "regen", reason: "no anchor" })
    );
    expect(event).toBe("mode");
    expect(data).toEqual({ mode: "regen", reason: "no anchor" });
  });

  it("done emits an empty data object", () => {
    expect(parseSse(encodeStreamEvent({ kind: "done" })).data).toEqual({});
  });

  it("keeps a newline-containing payload inside a single data line", () => {
    // A naive implementation that interpolated raw text would split one
    // logical event across two SSE data lines and break the framing.
    const bytes = encodeStreamEvent({ kind: "delta", text: "line1\nline2" });
    const dataLines = decode(bytes)
      .split("\n")
      .filter((l) => l.startsWith("data:"));
    expect(dataLines).toHaveLength(1);
    expect(parseSse(bytes).data).toEqual({ text: "line1\nline2" });
  });
});

describe("encodeHeartbeat", () => {
  it("emits an SSE comment line (ignored by clients)", () => {
    const raw = decode(encodeHeartbeat());
    expect(raw.startsWith(":")).toBe(true);
    expect(raw.endsWith("\n\n")).toBe(true);
  });
});

describe("SSE_HEADERS", () => {
  it("disables caching and proxy buffering for live streaming", () => {
    expect(SSE_HEADERS["Content-Type"]).toContain("text/event-stream");
    expect(SSE_HEADERS["Cache-Control"]).toContain("no-store");
    expect(SSE_HEADERS["X-Accel-Buffering"]).toBe("no");
  });
});
