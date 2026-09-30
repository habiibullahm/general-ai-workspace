export type OpenAiStreamEvent = { type: "delta"; text: string } | { type: "done" };

export async function* readOpenAiSse(body: ReadableStream<Uint8Array>): AsyncGenerator<OpenAiStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") { yield { type: "done" }; continue; }
        try {
          const value = JSON.parse(payload) as { choices?: { delta?: { content?: unknown } }[] };
          const text = value.choices?.[0]?.delta?.content;
          if (typeof text === "string" && text) yield { type: "delta", text };
        } catch { /* Ignore malformed or non-content provider events. */ }
      }
    }
  } finally { reader.releaseLock(); }
}
