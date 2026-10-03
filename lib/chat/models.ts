import { z } from "zod";
import { modelSchema, type ChatModel } from "@/lib/chat/validation";

export const modelChoiceSchema = modelSchema.or(z.literal("Auto"));
export type ModelChoice = z.infer<typeof modelChoiceSchema>;

// Product-facing model choices. The client only ever names one of these three modes; which provider model sits behind each mode
// is decided on the server (AI_MODEL_FAST / AI_MODEL_BALANCED / AI_MODEL_REASONING) and a mode is offered only when it is configured.
export type ModelOption = { id: ChatModel; label: string; model: string };

export const reasoningEffortSchema = z.enum(["auto", "low", "medium", "high"]);
export type ReasoningEffort = z.infer<typeof reasoningEffortSchema>;
export const defaultReasoningEffort: ReasoningEffort = "auto";

// Used when a conversation's saved mode is not (or no longer) configured.
const fallbackOrder: readonly ChatModel[] = ["Balanced", "Fast", "Reasoning"];

export function resolveMode(saved: unknown, available: readonly ChatModel[]): ChatModel | null {
  const parsed = modelSchema.safeParse(saved);
  if (parsed.success && available.includes(parsed.data)) return parsed.data;
  return fallbackOrder.find((mode) => available.includes(mode)) ?? null;
}

// Reasoning effort is only meaningful for modes the server has declared as supporting it; "auto" never sends a parameter.
export function reasoningAllowed(effort: ReasoningEffort, mode: ChatModel, reasoningModes: readonly ChatModel[]) {
  return effort === "auto" || reasoningModes.includes(mode);
}
