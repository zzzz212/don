// Browser-side SSE parser for fetch() streams (EventSource is GET-only,
// so we hand-roll the same wire format we emit on the server).
//
// Usage:
//   for await (const event of parseSseStream(response.body!)) {
//     if (event.kind === "delta") setText((t) => t + event.text);
//     else if (event.kind === "usage") {...}
//     else if (event.kind === "done") break;
//     else if (event.kind === "error") setError(event.message);
//   }

export type ClientStreamEvent =
  | { kind: "delta"; text: string }
  | { kind: "usage"; usage: Record<string, unknown> }
  | { kind: "error"; message: string }
  | { kind: "done" };

export async function* parseSseStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<ClientStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Events are separated by a blank line ("\n\n").
      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex !== -1) {
        const block = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        const parsed = parseEventBlock(block);
        if (parsed) yield parsed;
        separatorIndex = buffer.indexOf("\n\n");
      }
    }

    // Flush any trailing partial event (shouldn't happen with well-formed
    // SSE, but be defensive).
    const tail = buffer.trim();
    if (tail.length > 0) {
      const parsed = parseEventBlock(tail);
      if (parsed) yield parsed;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEventBlock(block: string): ClientStreamEvent | null {
  const lines = block.split("\n");
  let event = "";
  let dataRaw = "";

  for (const line of lines) {
    if (line.startsWith(":")) continue; // comment / heartbeat
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataRaw += line.slice(5).trim();
    }
  }

  if (!event) return null;

  let data: Record<string, unknown> = {};
  if (dataRaw) {
    try {
      data = JSON.parse(dataRaw) as Record<string, unknown>;
    } catch {
      return { kind: "error", message: "Malformed SSE payload" };
    }
  }

  if (event === "delta" && typeof data.text === "string") {
    return { kind: "delta", text: data.text };
  }
  if (event === "usage") {
    return {
      kind: "usage",
      usage: (data.usage as Record<string, unknown>) ?? {},
    };
  }
  if (event === "error") {
    return {
      kind: "error",
      message: typeof data.message === "string" ? data.message : "Unknown error",
    };
  }
  if (event === "done") {
    return { kind: "done" };
  }
  return null;
}
