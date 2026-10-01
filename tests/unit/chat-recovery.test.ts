import { describe, expect, it } from "vitest";
import { ChatStreamServerError, readChatSse } from "../../lib/ai/sse";
import { classifyStreamFailure, hasActiveGeneration, isRecoverySettled, latestReplyFailed, needsServerCheck } from "../../lib/chat/recovery";

const id = "e3b624e6-d792-47a8-8ff2-46724452c1ca";
const row = (status: string, extra: Partial<{ id: string; role: string; position: number }> = {}) => ({ id, role: "assistant", position: 2, status, ...extra });
const bodyOf = (text: string) => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } });
const start = `event: start\ndata: {"id":"${id}","position":2}\n\n`;
const delta = 'event: delta\ndata: {"text":"hello"}\n\n';
const status = 'event: status\ndata: {"status":"complete"}\n\n';

describe("stream failure classification (Retry showed a failure although the reply was saved)", () => {
  it("only treats a failure the server reported itself as final", async () => {
    const serverFailure = await Array.fromAsync(readChatSse(bodyOf('event: error\ndata: {"error":"Response unavailable."}\n\n'))).catch((error: unknown) => error);
    expect(serverFailure).toBeInstanceOf(ChatStreamServerError);
    expect(classifyStreamFailure({ error: serverFailure, aborted: false })).toBe("server-error");
    expect(needsServerCheck("server-error")).toBe(false);
  });

  it("treats a stream cut before its terminal event as an unknown outcome, not a failure", async () => {
    const truncated = await Array.fromAsync(readChatSse(bodyOf(start + delta))).catch((error: unknown) => error);
    expect(truncated).toBeInstanceOf(Error);
    expect(truncated).not.toBeInstanceOf(ChatStreamServerError);
    const cutAfterStatus = await Array.fromAsync(readChatSse(bodyOf(start + delta + status))).catch((error: unknown) => error);
    expect(cutAfterStatus).not.toBeInstanceOf(ChatStreamServerError);
    for (const error of [truncated, cutAfterStatus, new TypeError("network error")]) {
      const kind = classifyStreamFailure({ error, aborted: false });
      expect(kind).toBe("lost-connection");
      expect(needsServerCheck(kind)).toBe(true);
    }
  });

  it("checks with the server after Stop and after a 409 collision with a running generation", () => {
    expect(classifyStreamFailure({ error: new Error("aborted"), aborted: true })).toBe("stopped");
    expect(classifyStreamFailure({ error: new Error("Another response is running"), aborted: false, httpStatus: 409 })).toBe("in-progress");
    expect(needsServerCheck("stopped")).toBe(true);
    expect(needsServerCheck("in-progress")).toBe(true);
  });

  it("treats other HTTP errors as final because the route stores the failed state before responding", () => {
    for (const httpStatus of [400, 401, 404, 502, 503]) {
      const kind = classifyStreamFailure({ error: new Error("x"), aborted: false, httpStatus });
      expect(kind).toBe("request-failed");
      expect(needsServerCheck(kind)).toBe(false);
    }
  });
});

describe("recovery settlement against fresh server data", () => {
  it("keeps waiting while any response is still streaming", () => {
    expect(hasActiveGeneration([row("streaming")])).toBe(true);
    expect(isRecoverySettled([row("streaming")], null)).toBe(false);
    expect(isRecoverySettled([row("streaming")], id)).toBe(false);
  });

  it("settles once the awaited reply has a final state", () => {
    for (const final of ["complete", "interrupted", "error"]) expect(isRecoverySettled([row(final)], id)).toBe(true);
  });

  it("does not settle on data that does not contain the awaited reply yet", () => {
    expect(isRecoverySettled([], id)).toBe(false);
    expect(isRecoverySettled([row("complete", { id: "11111111-1111-4111-8111-111111111111" })], id)).toBe(false);
  });

  it("settles on any idle conversation when no specific reply is awaited", () => {
    expect(isRecoverySettled([], null)).toBe(true);
    expect(isRecoverySettled([row("complete")], null)).toBe(true);
  });

  it("only reports a failure when the latest reply really ended in an error", () => {
    expect(latestReplyFailed([row("complete")])).toBe(false);
    expect(latestReplyFailed([row("interrupted")])).toBe(false);
    expect(latestReplyFailed([row("error")])).toBe(true);
    expect(latestReplyFailed([row("error", { position: 2 }), row("complete", { id: "11111111-1111-4111-8111-111111111111", position: 4 })])).toBe(false);
    expect(latestReplyFailed([])).toBe(false);
  });

  it("settles on the saved reply, without a failure notice, when Stop arrives after the server already finished", () => {
    // Stop is classified as "outcome unknown", never as a failure; the server's saved state then decides what is shown.
    const kind = classifyStreamFailure({ error: new Error("aborted"), aborted: true });
    expect(kind).toBe("stopped");
    expect(needsServerCheck(kind)).toBe(true);
    const saved = [row("complete", { role: "user", id: "11111111-1111-4111-8111-111111111111", position: 1 }), row("complete")];
    expect(isRecoverySettled(saved, id)).toBe(true);
    expect(latestReplyFailed(saved)).toBe(false);
  });

  it("follows Stop, then Retry, then success: only the final saved state matters", () => {
    const afterStop = [row("interrupted")];
    expect(isRecoverySettled(afterStop, id)).toBe(true);
    expect(latestReplyFailed(afterStop)).toBe(false);
    // Retry replaces the reply with a new one that is streaming, then complete; a stale interrupted row never counts as the outcome.
    const retried = "22222222-2222-4222-8222-222222222222";
    expect(isRecoverySettled([row("streaming", { id: retried })], retried)).toBe(false);
    const finished = [row("complete", { id: retried })];
    expect(isRecoverySettled(finished, retried)).toBe(true);
    expect(latestReplyFailed(finished)).toBe(false);
  });
});
