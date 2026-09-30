import { describe, expect, it } from "vitest";
import { readOpenAiSse } from "../../lib/ai/sse";

describe("OpenAI compatible SSE parsing", () => {
  it("preserves events split across network chunks and ignores non-text events", async () => {
    const source = "data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"role\":\"assistant\"}}]}\n\ndata: [DONE]\n\n";
    const bytes = new TextEncoder().encode(source);
    const chunks = [bytes.slice(0, 42), bytes.slice(42, 71), bytes.slice(71)];
    const body = new ReadableStream<Uint8Array>({ start(controller) { chunks.forEach((chunk) => controller.enqueue(chunk)); controller.close(); } });
    const events = [];
    for await (const event of readOpenAiSse(body)) events.push(event);
    expect(events).toEqual([{ type: "delta", text: "Hello" }, { type: "done" }]);
  });
});
