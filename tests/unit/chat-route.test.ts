import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, stream, claim } = vi.hoisted(() => ({ createClient: vi.fn(), stream: vi.fn(), claim: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: createClient }));
vi.mock("@/lib/ai/provider", () => ({ chatProvider: { stream } }));

import { POST } from "../../app/api/chat/route";
const assistantId = "e3b624e6-d792-47a8-8ff2-46724452c1ca";
const assistant = { id: assistantId, position: 3, content: "…", status: "streaming", replayed: false };

describe("POST /api/chat", () => {
  beforeEach(() => { createClient.mockReset(); stream.mockReset(); claim.mockReset().mockReturnValue(query({ data: assistant, error: null })); });
  afterEach(() => vi.useRealTimers());

  it("returns 401 before reading request data or invoking a provider", async () => {
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: new Error("no session") }) } });
    const response = await POST(new Request("http://localhost/api/chat", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
    expect(stream).not.toHaveBeenCalled();
  });

  it("rejects malformed conversation requests before querying user data", async () => {
    const from = vi.fn();
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from });
    const response = await POST(new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: "other-user-id", userMessageId: "bad" }) }));
    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
    expect(stream).not.toHaveBeenCalled();
  });

  it("keeps RLS-hidden conversations indistinguishable and never calls the model", async () => {
    const from = vi.fn(() => query({ data: null, error: null }));
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from });
    const response = await POST(validRequest());
    expect(response.status).toBe(404);
    expect(stream).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-origin and non-JSON requests before querying user data", async () => {
    const from = vi.fn();
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from });
    const crossOrigin = validRequest();
    crossOrigin.headers.set("origin", "https://attacker.invalid");
    expect((await POST(crossOrigin)).status).toBe(403);
    const nonJson = validRequest();
    nonJson.headers.set("content-type", "text/plain");
    expect((await POST(nonJson)).status).toBe(415);
    expect(from).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
    expect(stream).not.toHaveBeenCalled();
  });

  it("revalidates stored prompt bounds before starting a provider request", async () => {
    const from = vi.fn((table: string) => query({ data: table === "conversations" ? { id: "conversation", selected_model: "Balanced" } : { id: "user-message", position: 1, content: "x".repeat(20_001) }, error: null }));
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from });
    expect((await POST(validRequest())).status).toBe(400);
    expect(claim).not.toHaveBeenCalled();
    expect(stream).not.toHaveBeenCalled();
  });

  it("stores an assistant placeholder, streams provider deltas, and completes the row", async () => {
    const rows = [{ role: "user", content: "hello", status: "complete", position: 1 }, { role: "assistant", content: "stale placeholder", status: "error", position: 2 }];
    const writes: unknown[] = [];
    const outcomes = [
      { data: { id: "user-message", position: 1, content: "hello" }, error: null },
      { data: rows, error: null },
      { data: { id: assistantId }, error: null },
    ];
    const from = vi.fn((table: string) => {
      if (table === "conversations") return query({ data: { id: "conversation", selected_model: "Balanced" }, error: null });
      if (table === "messages") return query(outcomes.shift()!, (write) => writes.push(write));
      return query({ data: null, error: null });
    });
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from, rpc: claim });
    stream.mockResolvedValue(sseBody("Hello"));
    const response = await POST(validRequest());
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain('event: delta\ndata: {"text":"Hello"}');
    expect(body).toContain('event: status\ndata: {"status":"complete"}');
    expect(stream).toHaveBeenCalledWith("Balanced", [{ role: "user", content: "hello" }], expect.any(AbortSignal));
    expect(claim).toHaveBeenCalledWith("claim_assistant_message", { p_conversation_id: "conversation", p_user_message_id: "b79e56e1-b479-46f4-97d3-30b2e22be90e" });
    expect(body).toContain(`event: start\ndata: {"id":"${assistantId}","position":3}`);
    expect(writes).toContainEqual(expect.objectContaining({ content: "Hello", status: "complete" }));
  });

  it("does not announce completion when the assistant response failed to persist", async () => {
    const writes: unknown[] = [];
    const results = [
      { data: { id: "user-message", position: 1, content: "hello" }, error: null },
      { data: [{ role: "user", content: "hello", status: "complete", position: 1 }], error: null },
      { data: null, error: { message: "database unavailable" } },
      { data: { id: "assistant-message" }, error: null },
    ];
    const from = vi.fn((table: string) => table === "conversations"
      ? query({ data: { id: "conversation", selected_model: "Balanced" }, error: null })
      : query(results.shift()!, (write) => writes.push(write)));
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from, rpc: claim });
    stream.mockResolvedValue(sseBody("Hello"));
    const response = await POST(validRequest());
    const body = await response.text();
    expect(body).not.toContain('event: status\ndata: {"status":"complete"}');
    expect(body).toContain('event: error');
    expect(writes).toContainEqual(expect.objectContaining({ content: "Hello", status: "error" }));
  });

  it("stores a safe error state when the provider fails without exposing its failure details", async () => {
    const writes: unknown[] = [];
    const results = [
      { data: { id: "user-message", position: 1, content: "hello" }, error: null },
      { data: [{ role: "user", content: "hello", status: "complete", position: 1 }], error: null },
      { data: null, error: null },
    ];
    const from = vi.fn((table: string) => table === "conversations"
      ? query({ data: { id: "conversation", selected_model: "Fast" }, error: null })
      : query(results.shift()!, (write) => writes.push(write)));
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from, rpc: claim });
    stream.mockRejectedValue(new Error("provider body or credential must not be returned"));
    const response = await POST(validRequest());
    const body = await response.text();
    expect(response.status).toBe(502);
    expect(body).not.toContain("credential");
    expect(writes).toContainEqual(expect.objectContaining({ content: "Response unavailable.", status: "error" }));
  });

  it("aborts the provider request and persists interrupted state when the client disconnects", async () => {
    const writes: unknown[] = [];
    const results = [
      { data: { id: "user-message", position: 1, content: "hello" }, error: null },
      { data: [{ role: "user", content: "hello", status: "complete", position: 1 }], error: null },
      { data: null, error: null },
    ];
    const from = vi.fn((table: string) => table === "conversations"
      ? query({ data: { id: "conversation", selected_model: "Fast" }, error: null })
      : query(results.shift()!, (write) => writes.push(write)));
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from, rpc: claim });
    stream.mockImplementation((_model: string, _messages: unknown[], signal: AbortSignal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })));
    const aborter = new AbortController();
    const pending = POST(validRequest(aborter.signal));
    await vi.waitFor(() => expect(stream).toHaveBeenCalled());
    aborter.abort();
    const response = await pending;
    expect(response.status).toBe(502);
    expect(writes).toContainEqual(expect.objectContaining({ content: "Response stopped.", status: "interrupted" }));
  });

  it("replays a saved response without invoking the provider", async () => {
    readyClient([]);
    claim.mockReturnValue(query({ data: { ...assistant, content: "Already saved", status: "complete", replayed: true }, error: null }));
    const response = await POST(validRequest());
    expect(await response.text()).toContain('data: {"text":"Already saved"}');
    expect(stream).not.toHaveBeenCalled();
  });

  it("rejects an overlapping claim without invoking the provider", async () => {
    readyClient([]);
    claim.mockReturnValue(query({ data: null, error: { code: "PT409" } }));
    expect((await POST(validRequest())).status).toBe(409);
    expect(stream).not.toHaveBeenCalled();
  });

  it("persists partial output as error when the provider ends without DONE", async () => {
    const writes: unknown[] = [];
    readyClient(writes);
    stream.mockResolvedValue(new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'));
      controller.close();
    } }));
    const response = await POST(validRequest());
    const body = await response.text();
    expect(body).toContain("event: error");
    expect(body).not.toContain('data: {"status":"complete"}');
    expect(writes).toContainEqual({ content: "partial", status: "error" });
  });

  it("aborts and persists partial output when the consumer cancels during streaming", async () => {
    const writes: unknown[] = [];
    const cancel = vi.fn();
    readyClient(writes);
    stream.mockResolvedValue(new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'));
    }, cancel }));
    const response = await POST(validRequest());
    const reader = response.body!.getReader();
    await reader.read();
    await reader.read();
    await reader.cancel();
    await vi.waitFor(() => expect(writes).toContainEqual({ content: "partial", status: "interrupted" }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.mock.calls[0][2].aborted).toBe(true);
  });

  it("bounds a stalled stream with a timeout and persists an error", async () => {
    vi.useFakeTimers();
    const writes: unknown[] = [];
    readyClient(writes);
    stream.mockResolvedValue(new ReadableStream<Uint8Array>());
    const response = await POST(validRequest());
    const pending = response.text();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await pending).toContain("event: error");
    expect(writes).toContainEqual({ content: "Response unavailable.", status: "error" });
    expect(stream.mock.calls[0][2].aborted).toBe(true);
  });

  it("does not claim a saved completion when a fenced update affects no row", async () => {
    const writes: unknown[] = [];
    const from = readyClient(writes, [{ data: null, error: null }, { data: null, error: null }]);
    stream.mockResolvedValue(sseBody("Hello"));
    const body = await (await POST(validRequest())).text();
    expect(body).not.toContain('data: {"status":"complete"}');
    expect(body).toContain("event: error");
    expect(from.mock.results.at(-1)?.value.eq).toHaveBeenCalledWith("status", "streaming");
    expect(from.mock.results.at(-1)?.value.eq).toHaveBeenCalledWith("id", assistantId);
  });
});

const encoder = new TextEncoder();
function readyClient(writes: unknown[], updates: unknown[] = [{ data: { id: assistantId }, error: null }]) {
  const results = [
    { data: { id: "user-message", position: 1, content: "hello" }, error: null },
    { data: [{ role: "user", content: "hello", status: "complete", position: 1 }], error: null },
    ...updates,
  ];
  const from = vi.fn((table: string) => table === "conversations"
    ? query({ data: { id: "conversation", selected_model: "Balanced" }, error: null })
    : query(results.shift(), (write) => writes.push(write)));
  createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from, rpc: claim });
  return from;
}

function validRequest(signal?: AbortSignal) {
  return new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: "5e9bdcca-9205-4fea-a773-13952bb78c44", userMessageId: "b79e56e1-b479-46f4-97d3-30b2e22be90e" }), signal });
}

function query(result: unknown, onWrite?: (write: unknown) => void) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "lte", "order", "limit"]) builder[method] = () => builder;
  builder.eq = vi.fn(() => builder);
  builder.insert = (write: unknown) => { onWrite?.(write); return builder; };
  builder.update = (write: unknown) => { onWrite?.(write); return builder; };
  builder.maybeSingle = async () => result;
  builder.single = async () => result;
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

function sseBody(text: string) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
    controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close();
  } });
}
