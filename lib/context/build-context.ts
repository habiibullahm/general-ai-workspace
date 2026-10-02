import { CONTEXT_POLICY_TEXT, CONTEXT_POLICY_VERSION } from "@/lib/context/context-policy";
import { ContextBuildError, type BuildContextInput, type ContextBlock, type ContextDiagnostics, type ContextPlan, type ContextSourceDiagnostic, type ThreadMessage } from "@/lib/context/context-types";
import { profilePieces, profileReason, type ProfilePiece } from "@/lib/context/profile-context";
import { renderThreadSummary, resolveThreadSummary, selectThreadMessages } from "@/lib/context/thread-context";
import { budgetLimits, estimateTokens, PROTECTED_RECENT_COUNT, SUMMARY_TOKEN_CAP } from "@/lib/context/token-budget";

function block(partial: ContextBlock): ContextBlock {
  return partial;
}

function takeNewest(messages: ThreadMessage[], remaining: { value: number }) {
  const included: ThreadMessage[] = [];
  const dropped: ThreadMessage[] = [];
  for (const message of [...messages].reverse()) {
    const tokens = estimateTokens(message.content);
    if (tokens <= remaining.value) {
      included.push(message);
      remaining.value -= tokens;
    } else dropped.push(message);
  }
  return { included: included.reverse(), dropped };
}

export function buildContext(input: BuildContextInput): ContextPlan {
  const { contextWindowTokens, maxOutputTokens } = input.capabilities;
  if (!Number.isInteger(contextWindowTokens) || contextWindowTokens <= 0 || !Number.isInteger(maxOutputTokens) || maxOutputTokens <= 0) throw new ContextBuildError();
  const { inputBudgetTokens, outputReserveTokens } = budgetLimits(input.capabilities);
  if (inputBudgetTokens <= 0) throw new ContextBuildError();

  const selected = selectThreadMessages(input.messages, input.currentPosition);
  const current = selected.find((message) => message.position === input.currentPosition && message.role === "user");
  if (!current) throw new ContextBuildError();
  const earlier = selected.filter((message) => message !== current);
  const protectedCount = Math.max(0, PROTECTED_RECENT_COUNT - 1);
  const protectedMessages = earlier.slice(-protectedCount);
  const olderMessages = earlier.slice(0, earlier.length - protectedMessages.length);
  const resolved = resolveThreadSummary(input.summary, input.currentPosition);
  const pieces = profilePieces(input.preferences);
  const coreTokens = estimateTokens(CONTEXT_POLICY_TEXT);
  const currentTokens = estimateTokens(current.content);
  if (coreTokens + currentTokens > inputBudgetTokens) throw new ContextBuildError();

  const remaining = { value: inputBudgetTokens - coreTokens - currentTokens };
  const protectedFit = takeNewest(protectedMessages, remaining);
  const includedPieces: ProfilePiece[] = [];
  const droppedPieces: ProfilePiece[] = [];
  for (const piece of pieces) {
    const tokens = estimateTokens(piece.text);
    if (tokens <= remaining.value) {
      includedPieces.push(piece);
      remaining.value -= tokens;
    } else droppedPieces.push(piece);
  }

  let summaryText = "";
  let summaryIncluded = false;
  let summaryDroppedForBudget = false;
  const summary = resolved.summary;
  if (summary) {
    const text = renderThreadSummary(summary);
    const tokens = estimateTokens(text);
    if (tokens <= SUMMARY_TOKEN_CAP && tokens <= remaining.value) {
      summaryText = text;
      summaryIncluded = true;
      remaining.value -= tokens;
    } else summaryDroppedForBudget = true;
  }
  const olderFit = summaryIncluded ? { included: [] as ThreadMessage[], dropped: olderMessages } : takeNewest(olderMessages, remaining);
  const dialogue = [...olderFit.included, ...protectedFit.included, current];
  const droppedMessages = summaryIncluded ? protectedFit.dropped : [...olderFit.dropped, ...protectedFit.dropped];
  const truncated = droppedMessages.length > 0 || droppedPieces.length > 0 || summaryDroppedForBudget;

  const profileText = includedPieces.map((piece) => piece.text).join("\n");
  const blocks: ContextBlock[] = [
    block({ id: "core", authority: "policy", priority: 1, required: true, text: CONTEXT_POLICY_TEXT, tokenEstimate: coreTokens, included: true, exclusionReason: null }),
    block({ id: "profile", authority: "untrusted_data", priority: 4, required: false, text: profileText, tokenEstimate: profileText ? estimateTokens(profileText) : 0, included: Boolean(profileText), exclusionReason: profileText ? null : input.preferenceReadFailed ? "read_failed" : droppedPieces.length && !includedPieces.length ? "budget" : "defaults_only" }),
    block({ id: "thread_summary", authority: "untrusted_data", priority: 5, required: false, text: summaryText, tokenEstimate: summaryText ? estimateTokens(summaryText) : 0, included: summaryIncluded, exclusionReason: summaryIncluded ? null : summaryDroppedForBudget ? "budget" : resolved.exclusionReason }),
  ];
  for (const message of dialogue) {
    const isCurrent = message === current;
    blocks.push(block({
      id: isCurrent ? "current_request" : "recent_messages",
      authority: "untrusted_data",
      priority: isCurrent ? 3 : 6,
      required: isCurrent,
      text: message.content,
      tokenEstimate: estimateTokens(message.content),
      included: true,
      exclusionReason: null,
      dialogueRole: message.role,
    }));
  }

  const profileDiagnostic: ContextSourceDiagnostic = profileText
    ? { type: "profile", label: "Your profile", state: "included", reason: profileReason(includedPieces.flatMap((piece) => piece.categories)) }
    : { type: "profile", label: "Your profile", state: "not_used", reason: input.preferenceReadFailed ? "Preferences couldn't be loaded, so Nibie used defaults." : "No extra profile details are set." };
  const earlierIncluded = dialogue.length - 1;
  const recentDiagnostic: ContextSourceDiagnostic = earlierIncluded > 0 || droppedMessages.length > 0
    ? { type: "recent_messages", label: "Recent conversation", state: earlierIncluded > 0 ? "included" : "not_used", reason: droppedMessages.length ? "Older messages left out so this reply stays focused." : "The latest messages in this thread." }
    : { type: "recent_messages", label: "Recent conversation", state: "not_used", reason: "No earlier messages yet." };
  const summaryDiagnostic: ContextSourceDiagnostic = summaryIncluded
    ? { type: "thread_summary", label: "Thread summary", state: "included", reason: "Older parts of this conversation." }
    : { type: "thread_summary", label: "Thread summary", state: "not_used", reason: summaryDroppedForBudget ? "Not used for this reply." : "Not needed yet." };

  let diagnostics: ContextDiagnostics;
  try {
    diagnostics = { sources: [profileDiagnostic, recentDiagnostic, summaryDiagnostic], recentMessageCount: dialogue.length };
  } catch {
    diagnostics = { sources: [], recentMessageCount: dialogue.length };
  }

  const estimatedTokens = blocks.filter((item) => item.included).reduce((sum, item) => sum + item.tokenEstimate, 0);
  return {
    policyVersion: CONTEXT_POLICY_VERSION,
    blocks,
    diagnostics,
    budget: { inputBudgetTokens, outputReserveTokens, estimatedTokens, truncated },
  };
}
