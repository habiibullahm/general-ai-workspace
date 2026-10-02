import type { ModelContextCapabilities } from "@/lib/context/context-types";

export const FETCH_CAP = 32;
export const PROTECTED_RECENT_COUNT = 6;
export const SUMMARY_TOKEN_CAP = 800;
export const ROOM_TOKEN_CAP = 1_200;

export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

export function budgetLimits(capabilities: ModelContextCapabilities) {
  const outputReserveTokens = Math.min(capabilities.maxOutputTokens, Math.floor(capabilities.contextWindowTokens * 0.25));
  return { outputReserveTokens, inputBudgetTokens: capabilities.contextWindowTokens - outputReserveTokens };
}
