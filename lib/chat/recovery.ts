import { ChatStreamServerError } from "@/lib/ai/sse";

// Decides what the client may conclude when a response stream ends badly. The server persists the terminal state of every
// generation, so only a failure the server reported itself is final; everything else must be confirmed against the server.
export const recoveryPollMs = 2500;
export const recoveryMaxPolls = 30;

export type StreamFailureKind =
  | "stopped" // the user pressed Stop
  | "in-progress" // 409: another generation is still running or a newer message exists
  | "server-error" // the stream carried an `error` event: the server saved a failed state
  | "request-failed" // an HTTP error before any stream: the server saved a failed state (or rejected the request)
  | "lost-connection"; // network error, truncated stream, or an unreadable stream: the outcome is unknown

export function classifyStreamFailure(input: { error: unknown; aborted: boolean; httpStatus?: number }): StreamFailureKind {
  if (input.aborted) return "stopped";
  if (input.httpStatus === 409) return "in-progress";
  if (input.error instanceof ChatStreamServerError) return "server-error";
  if (input.httpStatus !== undefined) return "request-failed";
  return "lost-connection";
}

export function needsServerCheck(kind: StreamFailureKind) {
  return kind === "stopped" || kind === "in-progress" || kind === "lost-connection";
}

type StatusRow = { id: string; role: string; status?: string; position: number };

export function hasActiveGeneration(messages: readonly StatusRow[]) {
  return messages.some((message) => message.status === "streaming");
}

// Fresh server data settles a recovery once no response is running and, when we know which reply we were waiting for, that reply has a final state.
export function isRecoverySettled(messages: readonly StatusRow[], assistantId: string | null) {
  if (hasActiveGeneration(messages)) return false;
  return assistantId === null || messages.some((message) => message.id === assistantId && message.status !== "streaming");
}

// After the server has settled, a failure is only worth showing when the latest reply really ended in an error.
export function latestReplyFailed(messages: readonly StatusRow[]) {
  const latest = messages.filter((message) => message.role === "assistant").sort((left, right) => right.position - left.position)[0];
  return latest?.status === "error";
}
