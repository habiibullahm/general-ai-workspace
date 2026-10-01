import "server-only";

import type { ChatModel } from "@/lib/chat/validation";

const modelVariables: Record<ChatModel, string> = {
  Fast: "AI_MODEL_FAST",
  Balanced: "AI_MODEL_BALANCED",
  Reasoning: "AI_MODEL_REASONING",
};

export type AiConfig = { provider: "openai-compatible"; baseUrl: string; apiKey: string; models: Record<ChatModel, string> };

export function getAiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  const names = ["AI_PROVIDER", "AI_BASE_URL", "AI_API_KEY", ...Object.values(modelVariables)];
  const missing = names.filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`Missing AI configuration: ${missing.join(", ")}`);
  if (env.AI_PROVIDER !== "openai-compatible") throw new Error("Unsupported AI_PROVIDER; expected openai-compatible.");
  return {
    provider: "openai-compatible",
    baseUrl: env.AI_BASE_URL!.replace(/\/+$/, ""),
    apiKey: env.AI_API_KEY!,
    models: { Fast: env.AI_MODEL_FAST!, Balanced: env.AI_MODEL_BALANCED!, Reasoning: env.AI_MODEL_REASONING! },
  };
}

export function resolveLogicalModel(model: ChatModel, config: AiConfig): string {
  return config.models[model];
}
