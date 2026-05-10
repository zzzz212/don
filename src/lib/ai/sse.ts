// Server-Sent Events helpers. We hand-roll the wire format because the
// browser's EventSource API only supports GET, and we POST a JSON body of
// chat history to /api/chat — so the consumer reads via fetch().body and
// parses the same SSE format manually (see src/lib/sse-client.ts).
//
// Format (one event per blank-line-separated block):
//   event: <name>\n
//   data: <json>\n
//   \n

import type { StreamEvent } from "./types";

const ENCODER = new TextEncoder();

/** Encode a single StreamEvent into the SSE wire format. */
export function encodeStreamEvent(event: StreamEvent): Uint8Array {
  const data = JSON.stringify(
    event.kind === "delta"
      ? { text: event.text }
      : event.kind === "usage"
        ? { usage: event.usage }
        : event.kind === "error"
          ? { message: event.message }
          : {}
  );
  return ENCODER.encode(`event: ${event.kind}\ndata: ${data}\n\n`);
}

/** Heartbeat / keep-alive ping — comment line ignored by SSE clients. */
export function encodeHeartbeat(): Uint8Array {
  return ENCODER.encode(`: heartbeat ${Date.now()}\n\n`);
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  Connection: "keep-alive",
  // Hint Vercel / nginx-style proxies to flush eagerly:
  "X-Accel-Buffering": "no",
} as const;

/**
 * Wrap an AsyncGenerator<StreamEvent> as a ReadableStream of SSE bytes that
 * Next.js Route Handlers can return as a Response body.
 */
export function streamToSSE(
  source: AsyncGenerator<StreamEvent>
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await source.next();
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(encodeStreamEvent(next.value));
      } catch (e) {
        controller.enqueue(
          encodeStreamEvent({
            kind: "error",
            message: (e as Error).message,
          })
        );
        controller.close();
      }
    },
    async cancel() {
      // Consumer (browser tab closed, fetch aborted) gave up — let the
      // generator clean up if it has return() handlers.
      await source.return?.(undefined);
    },
  });
}
