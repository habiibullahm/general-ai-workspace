import type { UserPreferences } from "@/lib/preferences/types";

export type ContextSourceType = "core" | "profile" | "thread_summary" | "recent_messages" | "current_request";

export type ContextAuthority = "policy" | "untrusted_data";

export type ExclusionReason = "absent" | "not_needed" | "defaults_only" | "read_failed" | "budget" | "stale";

export type DialogueRole = "user" | "assistant";

export type ContextBlock = {
  id: ContextSourceType;
  authority: ContextAuthority;
  priority: number;
  required: boolean;
  text: string;
  tokenEstimate: number;
  included: boolean;
  exclusionReason: ExclusionReason | null;
  dialogueRole?: DialogueRole;
};

export type ContextSourceDiagnostic = {
  type: "profile" | "thread_summary" | "recent_messages";
  label: "Your profile" | "Thread summary" | "Recent conversation";
  state: "included" | "not_used";
  reason: string;
};

export type ContextDiagnostics = {
  sources: ContextSourceDiagnostic[];
  recentMessageCount: number;
};

export type BudgetReport = {
  inputBudgetTokens: number;
  outputReserveTokens: number;
  estimatedTokens: number;
  truncated: boolean;
};

export type ContextPlan = {
  policyVersion: "context-policy-v1";
  blocks: ContextBlock[];
  diagnostics: ContextDiagnostics;
  budget: BudgetReport;
};

export type ModelContextCapabilities = {
  contextWindowTokens: number;
  maxOutputTokens: number;
};

export type ThreadMessage = {
  role: DialogueRole;
  content: string;
  position: number;
};

export type ThreadSummary = {
  objective: string;
  importantContext: string;
  decisions: string;
  completedWork: string;
  currentState: string;
  openQuestions: string;
  coversThroughPosition: number;
  updatedAt: string;
};

export type BuildContextInput = {
  capabilities: ModelContextCapabilities;
  preferences: UserPreferences;
  preferenceReadFailed: boolean;
  summary: ThreadSummary | null;
  messages: ThreadMessage[];
  currentPosition: number;
};

export class ContextBuildError extends Error {
  constructor() {
    super("Context could not be built.");
    this.name = "ContextBuildError";
  }
}
