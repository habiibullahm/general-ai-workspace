import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getAiConfig, resolveLogicalModel } from "../../lib/ai/registry";

describe("logical AI model registry", () => {
  const env = { AI_PROVIDER: "openai-compatible", AI_BASE_URL: "https://provider.example/v1/", AI_API_KEY: "never-print", AI_MODEL_FAST: "fast-id", AI_MODEL_BALANCED: "balanced-id", AI_MODEL_REASONING: "reason-id" };
  it("maps persisted choices to configured provider model names", () => {
    const config = getAiConfig(env);
    expect(config.baseUrl).toBe("https://provider.example/v1");
    expect(["Fast", "Balanced", "Reasoning"].map((name) => resolveLogicalModel(name as "Fast", config))).toEqual(["fast-id", "balanced-id", "reason-id"]);
  });
  it("reports missing variable names without values", () => {
    expect(() => getAiConfig({ AI_PROVIDER: "openai-compatible" })).toThrow("AI_BASE_URL, AI_API_KEY, AI_MODEL_FAST, AI_MODEL_BALANCED, AI_MODEL_REASONING");
  });
});
