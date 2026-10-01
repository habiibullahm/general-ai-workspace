import { describe, expect, it, vi } from "vitest";
import { readChatSse, readOpenAiSse } from "../../lib/ai/sse";

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

  it("handles split UTF-8, CRLF, and an unterminated final DONE line", async () => {
    const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"你好 👋"}}]}\r\n\r\ndata: [DONE]');
    const body = new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
    expect(await Array.fromAsync(readOpenAiSse(body))).toEqual([{ type: "delta", text: "你好 👋" }, { type: "done" }]);
  });

  it("fails on provider errors and malformed content events", async () => {
    for (const source of ['data: {"error":{"message":"private detail"}}\n\n', 'data: malformed\n\n']) {
      await expect(Array.fromAsync(readOpenAiSse(bodyOf(source)))).rejects.toThrow();
    }
  });

  it("cancels a pending provider reader on abort", async () => {
    const cancel = vi.fn();
    const aborter = new AbortController();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const pending = Array.fromAsync(readOpenAiSse(body, aborter.signal));
    aborter.abort();
    await expect(pending).rejects.toThrow("aborted");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("requires the client stream to confirm persistence before DONE", async () => {
    const start = 'event: start\ndata: {"id":"e3b624e6-d792-47a8-8ff2-46724452c1ca","position":2}\n\n';
    const delta = 'event: delta\ndata: {"text":"Hello"}\n\n';
    const status = 'event: status\ndata: {"status":"complete"}\n\n';
    const done = 'event: done\ndata: {}\n\n';
    expect(await Array.fromAsync(readChatSse(bodyOf(start + delta + status + done)))).toHaveLength(4);
    await expect(Array.fromAsync(readChatSse(bodyOf(start + delta)))).rejects.toThrow("before it was saved");
    await expect(Array.fromAsync(readChatSse(bodyOf(start + delta + done)))).rejects.toThrow("before it was saved");
    await expect(Array.fromAsync(readChatSse(bodyOf('event: error\ndata: {"error":"Response unavailable."}\n\n')))).rejects.toThrow("Response unavailable");
  });
});

function bodyOf(source: string) {
  return new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(source)); controller.close(); } });
}
