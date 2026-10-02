import { z } from "zod";

export type OpenAiStreamEvent = { type: "delta"; text: string } | { type: "done" };

export async function* readOpenAiSse(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<OpenAiStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw new Error("Response aborted.");
      const { value, done } = await reader.read();
      if (signal?.aborted) throw new Error("Response aborted.");
      buffer += done ? decoder.decode() + "\n" : decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === "[DONE]") { yield { type: "done" }; return; }
        const parsed = JSON.parse(payload) as { error?: unknown; choices?: { delta?: { content?: unknown } }[] } | null;
        if (!parsed || parsed.error) throw new Error("AI provider stream failed.");
        const text = parsed.choices?.[0]?.delta?.content;
        if (typeof text === "string" && text) yield { type: "delta", text };
      }
      if (done) return;
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

const contextDiagnosticSchema = z.object({
  type: z.enum(["profile", "thread_summary", "recent_messages"]),
  label: z.enum(["Your profile", "Thread summary", "Recent conversation"]),
  state: z.enum(["included", "not_used"]),
  reason: z.string(),
});

const chatEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("start"),
    id: z.string().uuid(),
    position: z.number().int().positive(),
    context: z.object({ sources: z.array(contextDiagnosticSchema), recentMessageCount: z.number().int().nonnegative() }).optional(),
  }),
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({ type: z.literal("status"), status: z.enum(["complete", "interrupted"]) }),
  z.object({ type: z.literal("error"), error: z.string() }),
  z.object({ type: z.literal("done") }),
]);
export type ChatStreamEvent = z.infer<typeof chatEventSchema>;

// Thrown only when the server itself reported a failed response (an `error` event). Any other stream problem is transport-level.
export class ChatStreamServerError extends Error {}

export async function* readChatSse(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  let started = false;
  let terminal = false;
  let finished = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() + "\n\n" : decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        if (!block.trim() || block.startsWith(":")) continue;
        const type = block.match(/^event: ([^\r\n]+)$/m)?.[1];
        const payload: unknown = JSON.parse(block.match(/^data: ([^\r\n]+)$/m)?.[1] ?? "null");
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid response stream.");
        const event = chatEventSchema.parse({ ...payload, type });
        if (event.type === "error") throw new ChatStreamServerError(event.error);
        if (finished || (event.type === "start" ? started : !started) || (terminal && event.type !== "done")) throw new Error("Invalid response stream.");
        if (event.type === "start") started = true;
        if (event.type === "status") terminal = true;
        if (event.type === "done") {
          if (!terminal) throw new Error("Response ended before it was saved.");
          finished = true;
        }
        yield event;
      }
      if (done) break;
    }
    if (!finished) throw new Error("Response ended before it was saved.");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
