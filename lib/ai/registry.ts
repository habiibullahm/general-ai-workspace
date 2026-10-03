import "server-only";

import { modelSchema, type ChatModel } from "@/lib/chat/validation";
import type { ModelOption } from "@/lib/chat/models";

type Env = Record<string, string | undefined>;

const modelVariables: Record<ChatModel, string> = {
  Fast: "AI_MODEL_FAST",
  Balanced: "AI_MODEL_BALANCED",
  Reasoning: "AI_MODEL_REASONING",
};
// Order in which modes are offered to the user.
const modeOrder: readonly ChatModel[] = ["Fast", "Balanced", "Reasoning"];

export type AiConfig = {
  provider: "openai-compatible";
  baseUrl: string;
  apiKey: string;
  // Only modes that are actually configured appear here.
  models: Partial<Record<ChatModel, string>>;
  // Modes whose provider model has been verified to honour a reasoning effort (AI_REASONING_MODES, comma separated).
  reasoningModes: ChatModel[];
};

function configuredModels(env: Env): Partial<Record<ChatModel, string>> {
  const models: Partial<Record<ChatModel, string>> = {};
  for (const mode of modeOrder) {
    const value = env[modelVariables[mode]]?.trim();
    if (value) models[mode] = value;
  }
  return models;
}

function reasoningModesFrom(env: Env, models: Partial<Record<ChatModel, string>>): ChatModel[] {
  const listed = (env.AI_REASONING_MODES ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  // Unknown names and modes that are not configured are ignored rather than trusted.
  // The configured GPT-6 Luna Chat Completions route supports low/medium/high natively.
  // An explicit AI_REASONING_MODES value retains the operator's capability override.
  return modeOrder.filter((mode) => models[mode] && (env.AI_REASONING_MODES === undefined
    ? models[mode] === "gpt-6-luna"
    : listed.some((value) => modelSchema.safeParse(value).data === mode)));
}

export function getAiConfig(env: Env = process.env): AiConfig {
  const models = configuredModels(env);
  const missing = ["AI_PROVIDER", "AI_BASE_URL", "AI_API_KEY"].filter((name) => !env[name]?.trim());
  // Any one configured model is enough; if none is, every model variable is reported.
  if (!Object.keys(models).length) missing.push(...Object.values(modelVariables));
  if (missing.length) throw new Error(`Missing AI configuration: ${missing.join(", ")}`);
  if (env.AI_PROVIDER !== "openai-compatible") throw new Error("Unsupported AI_PROVIDER; expected openai-compatible.");
  return {
    provider: "openai-compatible",
    baseUrl: env.AI_BASE_URL!.replace(/\/+$/, ""),
    apiKey: env.AI_API_KEY!,
    models,
    reasoningModes: reasoningModesFrom(env, models),
  };
}

export type ModelContextCapabilities = {
  contextWindowTokens: number;
  maxOutputTokens: number;
};

// Nibie policy ceilings. They can sit below a provider window. The client never sends them.
const contextCeiling: ModelContextCapabilities = { contextWindowTokens: 16_384, maxOutputTokens: 2_048 };

export function contextCapabilitiesFor(_mode: ChatModel): ModelContextCapabilities {
  return contextCeiling;
}

export function resolveLogicalModel(model: ChatModel, config: AiConfig): string {
  const resolved = config.models[model];
  if (!resolved) throw new Error(`Unavailable model mode: ${model}`);
  return resolved;
}

// What the UI may offer: only configured modes. The configured model name is shown next to each mode on purpose (secondary text);
// the provider, its base URL and its key are never part of this.
export function getModelOptions(env: Env = process.env): { models: ModelOption[]; reasoningModes: ChatModel[] } {
  const configured = configuredModels(env);
  const names: Record<string, string> = {
    "MiniMax-M2.7-highspeed": "MiniMax M2.7",
    "deepseek-v4.1-flash:netra": "DeepSeek V4.1 Flash",
    "gpt-6-luna": "GPT-6 Luna",
  };
  const models = modeOrder.filter((mode) => configured[mode]).map((mode, index) => {
    const configuredLabel = env[modelVariables[mode] + "_LABEL"]?.trim();
    const label = configuredLabel && /^[A-Za-z0-9 .()_-]{1,60}$/.test(configuredLabel)
      ? configuredLabel : names[configured[mode]!] ?? "Model " + (index + 1);
    return { id: mode, label, model: label };
  });
  return { models, reasoningModes: reasoningModesFrom(env, configured) };
}
