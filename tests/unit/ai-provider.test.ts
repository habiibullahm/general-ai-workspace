import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { openAiCompatibleProvider } from "../../lib/ai/provider";

describe("OpenAI-compatible provider adapter", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("sends the selected configured model server-side and returns the streaming body", async () => {
    vi.stubEnv("AI_PROVIDER", "openai-compatible"); vi.stubEnv("AI_BASE_URL", "https://provider.invalid/v1"); vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL_FAST", "fast-model"); vi.stubEnv("AI_MODEL_BALANCED", "balanced-model"); vi.stubEnv("AI_MODEL_REASONING", "reason-model");
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 })); vi.stubGlobal("fetch", fetchMock);
    const result = await openAiCompatibleProvider.stream("Balanced", [{ role: "user", content: "hello" }], new AbortController().signal);
    expect(result).toBe(body);
    expect(fetchMock).toHaveBeenCalledWith("https://provider.invalid/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer test-key" }),
      body: JSON.stringify({ model: "balanced-model", messages: [{ role: "user", content: "hello" }], stream: true }),
    }));
  });
});
