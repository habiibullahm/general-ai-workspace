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

  it("adds reasoning_effort only for an explicit effort, never for auto or when omitted", async () => {
    vi.stubEnv("AI_PROVIDER", "openai-compatible"); vi.stubEnv("AI_BASE_URL", "https://provider.invalid/v1"); vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL_REASONING", "reason-model"); vi.stubEnv("AI_REASONING_MODES", "Reasoning");
    const fetchMock = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } }), { status: 200 })); vi.stubGlobal("fetch", fetchMock);
    const sentBody = (call: number) => JSON.parse((fetchMock.mock.calls[call] as unknown as [string, { body: string }])[1].body);
    const messages = [{ role: "user" as const, content: "hello" }];
    await openAiCompatibleProvider.stream("Reasoning", messages, new AbortController().signal);
    await openAiCompatibleProvider.stream("Reasoning", messages, new AbortController().signal, { reasoning: "auto" });
    for (const reasoning of ["low", "medium", "high"] as const) await openAiCompatibleProvider.stream("Reasoning", messages, new AbortController().signal, { reasoning });
    expect(sentBody(0)).not.toHaveProperty("reasoning_effort");
    expect(sentBody(1)).not.toHaveProperty("reasoning_effort");
    for (const [index, reasoning] of ["low", "medium", "high"].entries()) {
      expect(sentBody(index + 2)).toEqual({ model: "reason-model", messages, stream: true, reasoning_effort: reasoning });
    }
    vi.stubEnv("AI_REASONING_MODES", "");
    await expect(openAiCompatibleProvider.stream("Reasoning", messages, new AbortController().signal, { reasoning: "high" })).rejects.toThrow("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("fails without calling the provider when the requested mode has no configured model", async () => {
    vi.stubEnv("AI_PROVIDER", "openai-compatible"); vi.stubEnv("AI_BASE_URL", "https://provider.invalid/v1"); vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL_BALANCED", "balanced-model"); vi.stubEnv("AI_MODEL_FAST", ""); vi.stubEnv("AI_MODEL_REASONING", "");
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(openAiCompatibleProvider.stream("Fast", [{ role: "user", content: "hello" }], new AbortController().signal)).rejects.toThrow("AI provider request failed.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
