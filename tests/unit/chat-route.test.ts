import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, stream } = vi.hoisted(() => ({ createClient: vi.fn(), stream: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: createClient }));
vi.mock("@/lib/ai/provider", () => ({ chatProvider: { stream } }));

import { POST } from "../../app/api/chat/route";

describe("POST /api/chat", () => {
  beforeEach(() => { createClient.mockReset(); stream.mockReset(); });

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

  it("stores an assistant placeholder, streams provider deltas, and completes the row", async () => {
    const rows = [{ role: "user", content: "hello", status: "complete", position: 1 }, { role: "assistant", content: "stale placeholder", status: "error", position: 2 }];
    const writes: unknown[] = [];
    const outcomes = [
      { data: { id: "user-message", position: 1 }, error: null },
      { data: rows, error: null },
      { data: { position: 2 }, error: null },
      { data: { id: "assistant-message" }, error: null },
      { data: { id: "assistant-message" }, error: null },
    ];
    const from = vi.fn((table: string) => {
      if (table === "conversations") return query({ data: { id: "conversation", selected_model: "Balanced" }, error: null });
      if (table === "messages") return query(outcomes.shift()!, (write) => writes.push(write));
      return query({ data: null, error: null });
    });
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from });
    stream.mockResolvedValue(sseBody("Hello"));
    const response = await POST(validRequest());
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain('event: delta\ndata: {"text":"Hello"}');
    expect(body).toContain('event: status\ndata: {"status":"complete"}');
    expect(stream).toHaveBeenCalledWith("Balanced", [{ role: "user", content: "hello" }], expect.any(AbortSignal));
    expect(writes).toContainEqual(expect.objectContaining({ role: "assistant", content: "…", status: "streaming", position: 3 }));
    expect(writes).toContainEqual(expect.objectContaining({ content: "Hello", status: "complete" }));
  });

  it("does not announce completion when the assistant response failed to persist", async () => {
    const writes: unknown[] = [];
    const results = [
      { data: { id: "user-message", position: 1 }, error: null },
      { data: [{ role: "user", content: "hello", status: "complete", position: 1 }], error: null },
      { data: { position: 1 }, error: null },
      { data: { id: "assistant-message" }, error: null },
      { data: null, error: { message: "database unavailable" } },
      { data: { id: "assistant-message" }, error: null },
    ];
    const from = vi.fn((table: string) => table === "conversations"
      ? query({ data: { id: "conversation", selected_model: "Balanced" }, error: null })
      : query(results.shift()!, (write) => writes.push(write)));
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from });
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
      { data: { id: "user-message", position: 1 }, error: null },
      { data: [{ role: "user", content: "hello", status: "complete", position: 1 }], error: null },
      { data: { position: 1 }, error: null },
      { data: { id: "assistant-message" }, error: null },
      { data: null, error: null },
    ];
    const from = vi.fn((table: string) => table === "conversations"
      ? query({ data: { id: "conversation", selected_model: "Fast" }, error: null })
      : query(results.shift()!, (write) => writes.push(write)));
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from });
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
      { data: { id: "user-message", position: 1 }, error: null },
      { data: [{ role: "user", content: "hello", status: "complete", position: 1 }], error: null },
      { data: { position: 1 }, error: null },
      { data: { id: "assistant-message" }, error: null },
      { data: null, error: null },
    ];
    const from = vi.fn((table: string) => table === "conversations"
      ? query({ data: { id: "conversation", selected_model: "Fast" }, error: null })
      : query(results.shift()!, (write) => writes.push(write)));
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from });
    stream.mockImplementation((_model: string, _messages: unknown[], signal: AbortSignal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })));
    const aborter = new AbortController();
    const pending = POST(validRequest(aborter.signal));
    await vi.waitFor(() => expect(stream).toHaveBeenCalled());
    aborter.abort();
    const response = await pending;
    expect(response.status).toBe(502);
    expect(writes).toContainEqual(expect.objectContaining({ content: "Response stopped.", status: "interrupted" }));
  });
});

function validRequest(signal?: AbortSignal) {
  return new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: "5e9bdcca-9205-4fea-a773-13952bb78c44", userMessageId: "b79e56e1-b479-46f4-97d3-30b2e22be90e" }), signal });
}

function query(result: unknown, onWrite?: (write: unknown) => void) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "lte", "order", "limit"]) builder[method] = () => builder;
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
