import "server-only";

import type { ChatModel } from "@/lib/chat/validation";
import { modelPickerCopy, type ModelOption } from "@/lib/chat/models";
import { logError } from "@/lib/observability/logger";

type Env = Record<string, string | undefined>;

// Order in which modes are offered to the user.
const modeOrder: readonly ChatModel[] = ["Fast", "Balanced", "High"];

export type ReasoningEffortSetting = "low" | "medium" | "high";
// Which backend serves a mode. Each has its own adapter in lib/ai/provider.ts.
export type ProviderId = "sumopod" | "openai";
// One authoritative server-side route per mode. Nothing here is ever sent to the browser.
export type ModelRoute = {
  provider: ProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  // Sent as reasoning_effort when set. High always sets it (default high); Balanced only when the server configures one, otherwise
  // Luna keeps the provider default (medium). Fast never does.
  reasoningEffort?: ReasoningEffortSetting;
  // Explicit output ceiling, counting hidden reasoning tokens. Set only where the provider's own default is too low to finish a long request.
  maxOutputTokens?: number;
};

export type AiConfig = {
  // Only modes whose provider is actually configured appear here.
  routes: Partial<Record<ChatModel, ModelRoute>>;
};

// Fast → the Sumopod gateway (SUMOPOD_API_KEY / SUMOPOD_BASE_URL) running DeepSeek V4.1 Flash. The earlier AI_API_KEY / AI_BASE_URL
//   names still work for the gateway so an existing deployment keeps serving Fast.
// Balanced / High → OpenAI directly (OPENAI_API_KEY, optional OPENAI_BASE_URL) running GPT-6 Luna / GPT-6.1 Sol.
// Model ids live here; each can be overridden by a server env variable without touching the client.
const defaultFastModel = "deepseek-v4.1-flash:netra";
const defaultBalancedModel = "gpt-6-luna";
const defaultHighModel = "gpt-6.1-sol";
const defaultOpenAiBaseUrl = "https://api.openai.com/v1";
// The Sumopod gateway applies a low default cap to DeepSeek, and DeepSeek spends it on hidden reasoning: a detailed request ended with
// finish_reason "length" and no visible text. This is headroom for that reasoning, not a limit on answer length.
const sumopodMaxOutputTokens = 8192;

function trimmed(value: string | undefined) {
  return value?.trim() || undefined;
}

function openAiBaseUrl(env: Env) {
  const configured = trimmed(env.OPENAI_BASE_URL);
  if (!configured) return defaultOpenAiBaseUrl;
  let url: URL;
  try { url = new URL(configured); } catch { throw new Error("OPENAI_BASE_URL must be a valid URL."); }
  if (url.protocol !== "https:") throw new Error("OPENAI_BASE_URL must use HTTPS.");
  return configured.replace(/\/+$/, "");
}

// Unset means "not configured". A value that is set must be one of low / medium / high, like OPENAI_BASE_URL it is rejected
// otherwise, so a typo can never silently change what is sent to the provider. The message names the variable, never its value.
function configuredEffort(name: string, value: string | undefined): ReasoningEffortSetting | undefined {
  const effort = trimmed(value)?.toLowerCase();
  if (effort === undefined) return undefined;
  if (effort === "low" || effort === "medium" || effort === "high") return effort;
  throw new Error(`${name} must be low, medium or high.`);
}

// GPT-6.1 Sol supports a configurable effort and High means "deeper reasoning", so High sends "high" unless configured otherwise.
function highReasoningEffort(env: Env): ReasoningEffortSetting {
  return configuredEffort("OPENAI_HIGH_REASONING_EFFORT", env.OPENAI_HIGH_REASONING_EFFORT) ?? "high";
}

// Balanced (Luna) runs at the provider default unless OPENAI_BALANCED_REASONING_EFFORT is set.
function balancedReasoningEffort(env: Env): ReasoningEffortSetting | undefined {
  return configuredEffort("OPENAI_BALANCED_REASONING_EFFORT", env.OPENAI_BALANCED_REASONING_EFFORT);
}

export function getAiConfig(env: Env = process.env): AiConfig {
  const routes: AiConfig["routes"] = {};
  const gatewayProvider = trimmed(env.AI_PROVIDER);
  if (gatewayProvider && gatewayProvider !== "openai-compatible") throw new Error("Unsupported AI_PROVIDER; expected openai-compatible.");
  const gatewayUrl = trimmed(env.SUMOPOD_BASE_URL) ?? trimmed(env.AI_BASE_URL);
  const gatewayKey = trimmed(env.SUMOPOD_API_KEY) ?? trimmed(env.AI_API_KEY);
  if (gatewayUrl && gatewayKey) {
    routes.Fast = { provider: "sumopod", baseUrl: gatewayUrl.replace(/\/+$/, ""), apiKey: gatewayKey, model: trimmed(env.SUMOPOD_MODEL_FAST) ?? defaultFastModel, maxOutputTokens: sumopodMaxOutputTokens };
  }
  const openAiKey = trimmed(env.OPENAI_API_KEY);
  if (openAiKey) {
    const baseUrl = openAiBaseUrl(env);
    const balancedEffort = balancedReasoningEffort(env);
    routes.Balanced = { provider: "openai", baseUrl, apiKey: openAiKey, model: trimmed(env.OPENAI_MODEL_BALANCED) ?? defaultBalancedModel, ...(balancedEffort ? { reasoningEffort: balancedEffort } : {}) };
    routes.High = { provider: "openai", baseUrl, apiKey: openAiKey, model: trimmed(env.OPENAI_MODEL_HIGH) ?? defaultHighModel, reasoningEffort: highReasoningEffort(env) };
  }
  if (!Object.keys(routes).length) throw new Error("Missing AI configuration: SUMOPOD_API_KEY, SUMOPOD_BASE_URL (Fast) or OPENAI_API_KEY (Balanced, High)");
  return { routes };
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

// Safe observability only: which provider serves a mode, never its URL, key or model id.
export function providerFor(mode: ChatModel, env: Env = process.env): ProviderId | null {
  try { return getAiConfig(env).routes[mode]?.provider ?? null; } catch { return null; }
}

export function resolveRoute(model: ChatModel, config: AiConfig): ModelRoute {
  const route = config.routes[model];
  if (!route) throw new Error(`Unavailable model mode: ${model}`);
  return route;
}

// What the UI may offer: only configured modes, with product copy. The provider, its URL, its key and the model id are never part of this.
export function getModelOptions(env: Env = process.env): { models: ModelOption[] } {
  let config: AiConfig;
  try { config = getAiConfig(env); } catch (error) {
    // Nothing configured is normal in some environments. An invalid value is not, so say which variable (never its value) is wrong.
    if (error instanceof Error && !error.message.startsWith("Missing AI configuration")) logError("ai.config.invalid", { reason: error.message });
    return { models: [] };
  }
  return { models: modeOrder.filter((mode) => config.routes[mode]).map((mode) => ({ id: mode, ...modelPickerCopy[mode] })) };
}
