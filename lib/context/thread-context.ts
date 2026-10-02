import { ContextBuildError, type ExclusionReason, type ThreadMessage, type ThreadSummary } from "@/lib/context/context-types";
import { FETCH_CAP } from "@/lib/context/token-budget";

const summaryFields = ["objective", "importantContext", "decisions", "completedWork", "currentState", "openQuestions"] as const;

function wellFormed(summary: ThreadSummary) {
  return summaryFields.every((field) => typeof summary[field] === "string") && Number.isInteger(summary.coversThroughPosition) && typeof summary.updatedAt === "string";
}

export function selectThreadMessages(messages: ThreadMessage[], currentPosition: number) {
  const inRange = messages.filter((message) => Number.isInteger(message.position) && message.position <= currentPosition);
  if (inRange.some((message) => (message.role === "user" || message.role === "assistant") && typeof message.content !== "string")) throw new ContextBuildError();
  return inRange
    .filter((message): message is ThreadMessage => (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
    .sort((left, right) => left.position - right.position)
    .slice(-FETCH_CAP);
}

export function renderThreadSummary(summary: ThreadSummary) {
  return [
    `Objective\n${summary.objective}`,
    `Important context\n${summary.importantContext}`,
    `Decisions\n${summary.decisions}`,
    `Completed work\n${summary.completedWork}`,
    `Current state\n${summary.currentState}`,
    `Open questions\n${summary.openQuestions}`,
  ].join("\n\n");
}

// Null, malformed, and stale summaries are absent. A summary that covers the current message is stale.
export function resolveThreadSummary(summary: ThreadSummary | null, currentPosition: number): { summary: ThreadSummary | null; exclusionReason: ExclusionReason | null } {
  if (summary == null) return { summary: null, exclusionReason: "not_needed" };
  if (!wellFormed(summary)) return { summary: null, exclusionReason: "absent" };
  if (summary.coversThroughPosition >= currentPosition) return { summary: null, exclusionReason: "stale" };
  return { summary, exclusionReason: null };
}
