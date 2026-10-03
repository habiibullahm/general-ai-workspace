import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getAiConfig, getModelOptions, resolveLogicalModel } from "../../lib/ai/registry";
import { reasoningAllowed, reasoningEffortSchema, resolveMode } from "../../lib/chat/models";

const base = { AI_PROVIDER: "openai-compatible", AI_BASE_URL: "https://provider.example/v1/", AI_API_KEY: "never-print" };

describe("logical AI model registry", () => {
  const env = { ...base, AI_MODEL_FAST: "fast-id", AI_MODEL_BALANCED: "balanced-id", AI_MODEL_REASONING: "reason-id" };
  it("maps persisted choices to configured provider model names", () => {
    const config = getAiConfig(env);
    expect(config.baseUrl).toBe("https://provider.example/v1");
    expect(["Fast", "Balanced", "Reasoning"].map((name) => resolveLogicalModel(name as "Fast", config))).toEqual(["fast-id", "balanced-id", "reason-id"]);
  });
  it("reports missing variable names without values", () => {
    expect(() => getAiConfig({ AI_PROVIDER: "openai-compatible" })).toThrow("AI_BASE_URL, AI_API_KEY, AI_MODEL_FAST, AI_MODEL_BALANCED, AI_MODEL_REASONING");
  });
  it("works with a subset of models and refuses to resolve one that is not configured", () => {
    const config = getAiConfig({ ...base, AI_MODEL_BALANCED: "balanced-id", AI_MODEL_FAST: "  " });
    expect(Object.keys(config.models)).toEqual(["Balanced"]);
    expect(resolveLogicalModel("Balanced", config)).toBe("balanced-id");
    expect(() => resolveLogicalModel("Fast", config)).toThrow("Unavailable model mode: Fast");
  });
});

describe("model options offered to the UI", () => {
  it("lists only configured modes, in product order, with the configured model name", () => {
    const options = getModelOptions({ ...base, AI_MODEL_REASONING: "reason-id", AI_MODEL_FAST: "fast-id" });
    expect(options.models).toEqual([{ id: "Fast", label: "Model 1", model: "Model 1" }, { id: "Reasoning", label: "Model 2", model: "Model 2" }]);
  });

  it("never includes the provider, its URL or its key", () => {
    const serialized = JSON.stringify(getModelOptions({ ...base, AI_MODEL_FAST: "fast-id" }));
    expect(serialized).not.toContain("never-print");
    expect(serialized).not.toContain("provider.example");
    expect(serialized).not.toContain("openai-compatible");
  });

  it("does not throw when the provider itself is not configured", () => {
    expect(getModelOptions({})).toEqual({ models: [], reasoningModes: [] });
  });

  it("offers no reasoning control unless the server declares support", () => {
    const env = { ...base, AI_MODEL_FAST: "f", AI_MODEL_REASONING: "r" };
    expect(getModelOptions(env).reasoningModes).toEqual([]);
    expect(getModelOptions({ ...env, AI_REASONING_MODES: "Reasoning" }).reasoningModes).toEqual(["Reasoning"]);
    expect(getAiConfig({ ...env, AI_REASONING_MODES: "Reasoning" }).reasoningModes).toEqual(["Reasoning"]);
  });

  it("ignores reasoning declarations for unknown or unconfigured modes", () => {
    const env = { ...base, AI_MODEL_FAST: "f", AI_REASONING_MODES: "Reasoning, turbo ,Fast,," };
    expect(getModelOptions(env).reasoningModes).toEqual(["Fast"]);
  });
});

describe("mode resolution and reasoning allowlist", () => {
  it("offers clean configured names and GPT-6 Luna's verified native reasoning", () => {
    const env = { ...base, AI_MODEL_FAST: "MiniMax-M2.7-highspeed", AI_MODEL_BALANCED: "deepseek-v4.1-flash:netra", AI_MODEL_REASONING: "gpt-6-luna" };
    const offered = getModelOptions(env);
    expect(offered.models.map((model) => model.label)).toEqual(["MiniMax M2.7", "DeepSeek V4.1 Flash", "GPT-6 Luna"]);
    expect(JSON.stringify(offered)).not.toContain(":netra");
    expect(offered.reasoningModes).toEqual(["Reasoning"]);
    expect(getModelOptions({ ...env, AI_REASONING_MODES: "" }).reasoningModes).toEqual([]);
  });
  it("keeps a saved mode that is available and otherwise falls back to Balanced, Fast, Reasoning", () => {
    expect(resolveMode("Fast", ["Fast", "Balanced"])).toBe("Fast");
    expect(resolveMode("Reasoning", ["Fast", "Balanced"])).toBe("Balanced");
    expect(resolveMode("default", ["Fast", "Reasoning"])).toBe("Fast");
    expect(resolveMode(undefined, ["Reasoning"])).toBe("Reasoning");
    expect(resolveMode("Fast", [])).toBeNull();
  });

  it("only knows auto, low, medium and high", () => {
    for (const value of ["auto", "low", "medium", "high"]) expect(reasoningEffortSchema.safeParse(value).success).toBe(true);
    for (const value of ["minimal", "xhigh", "Auto", "", undefined]) expect(reasoningEffortSchema.safeParse(value).success).toBe(false);
  });

  it("allows a reasoning effort only for modes declared as supporting it; auto is always allowed", () => {
    expect(reasoningAllowed("auto", "Fast", [])).toBe(true);
    expect(reasoningAllowed("low", "Fast", [])).toBe(false);
    expect(reasoningAllowed("high", "Reasoning", ["Reasoning"])).toBe(true);
    expect(reasoningAllowed("high", "Balanced", ["Reasoning"])).toBe(false);
  });
});
