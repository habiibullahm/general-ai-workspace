import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { modelSchema, validateConversationId, validateMessage } from "@/lib/chat/validation";
import { chatProvider } from "@/lib/ai/provider";
import { readOpenAiSse } from "@/lib/ai/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const encoder = new TextEncoder();
const safeError = "Nibie couldn't complete that response. Please try again.";
function event(type: string, data: unknown) { return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`; }

export async function POST(request: Request) {
  try { return await respond(request); }
  catch { return NextResponse.json({ error: safeError }, { status: 503 }); }
}

async function respond(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return NextResponse.json({ error: "A JSON request is required." }, { status: 415 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const value = body as { conversationId?: unknown; userMessageId?: unknown; regenerate?: unknown };
  const parsedId = validateConversationId(value?.conversationId);
  const parsedMessageId = validateConversationId(value?.userMessageId);
  if (!parsedId.success || !parsedMessageId.success || (value.regenerate !== undefined && typeof value.regenerate !== "boolean")) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const regenerate = value.regenerate === true;

  const { data: conversation, error: conversationError } = await supabase.from("conversations").select("id,selected_model").eq("id", parsedId.data).maybeSingle();
  if (conversationError) return NextResponse.json({ error: safeError }, { status: 503 });
  const selected = conversation && modelSchema.safeParse(conversation.selected_model);
  if (!conversation || !selected?.success) return NextResponse.json({ error: "Conversation unavailable." }, { status: 404 });
  const { data: userMessage, error: messageError } = await supabase.from("messages").select("id,position,content").eq("id", parsedMessageId.data).eq("conversation_id", conversation.id).eq("role", "user").eq("status", "complete").maybeSingle();
  if (messageError) return NextResponse.json({ error: safeError }, { status: 503 });
  if (!userMessage) return NextResponse.json({ error: "Message unavailable." }, { status: 404 });
  if (!validateMessage(userMessage.content).success) return NextResponse.json({ error: "Invalid saved message." }, { status: 400 });
  const { data: rows, error: readError } = await supabase.from("messages").select("role,content,status,position").eq("conversation_id", conversation.id).eq("status", "complete").lte("position", userMessage.position).order("position", { ascending: false }).limit(32);
  if (readError || !rows?.length) return NextResponse.json({ error: safeError }, { status: 503 });
  // ponytail: characters approximate tokens; use model-specific tokenization if context limits require it.
  let characters = 0;
  const context = rows.filter((row) => {
    if (row.status !== "complete" || (row.role !== "user" && row.role !== "assistant")) return false;
    characters += row.content.length;
    return characters <= 64_000;
  }).reverse().map((row) => ({ role: row.role as "user" | "assistant", content: row.content }));
  const { data: assistant, error: claimError } = await supabase.rpc(regenerate ? "regenerate_assistant_message" : "claim_assistant_message", {
    p_conversation_id: conversation.id, p_user_message_id: parsedMessageId.data,
  }).single<{ id: string; position: number; content: string; status: string; replayed: boolean }>();
  if (claimError || !assistant) {
    const status = claimError?.code === "PT404" ? 404 : claimError?.code === "PT409" || claimError?.code === "23505" ? 409 : 503;
    return NextResponse.json({ error: status === 409 ? "Another response is running or a newer message was saved. Refresh and try again." : safeError }, { status });
  }
  const headers = { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform" };
  if (assistant.replayed) return new Response(event("start", { id: assistant.id, position: assistant.position }) + event("delta", { text: assistant.content }) + event("status", { status: "complete" }) + event("done", {}), { headers });

  const aborter = new AbortController();
  let clientCancelled = false;
  const onRequestAbort = () => { clientCancelled = true; aborter.abort(); };
  request.signal.addEventListener("abort", onRequestAbort, { once: true });
  if (request.signal.aborted) onRequestAbort();
  const timeout = setTimeout(() => aborter.abort(), 120_000);
  const persist = async (content: string, status: "complete" | "interrupted" | "error") => {
    const { data, error } = await supabase.from("messages").update({ content, status }).eq("id", assistant.id).eq("status", "streaming").select("id").maybeSingle();
    if (error || !data) console.error("assistant_state_persist_failed");
    return !error && Boolean(data);
  };
  let responseStream: ReadableStream<Uint8Array>;
  try { responseStream = await chatProvider.stream(selected.data, context, aborter.signal); }
  catch (error) {
    if (error instanceof Error && /^(Missing AI configuration:|Unsupported AI_PROVIDER)/.test(error.message)) console.error(error.message);
    try { await persist(clientCancelled ? "Response stopped." : "Response unavailable.", clientCancelled ? "interrupted" : "error"); }
    finally { clearTimeout(timeout); request.signal.removeEventListener("abort", onRequestAbort); }
    return NextResponse.json({ error: safeError }, { status: 502 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let output = ""; let completed = false;
      const save = async (status: "complete" | "interrupted" | "error") => {
        const content = output || (status === "interrupted" ? "Response stopped." : "Response unavailable.");
        return persist(content, status);
      };
      try {
        if (clientCancelled) throw new Error("Response aborted.");
        controller.enqueue(encoder.encode(event("start", { id: assistant.id, position: assistant.position })));
        for await (const item of readOpenAiSse(responseStream, aborter.signal)) {
          if (item.type === "done") { completed = true; break; }
          output += item.text; controller.enqueue(encoder.encode(event("delta", { text: item.text })));
        }
        if (clientCancelled || request.signal.aborted) {
          const saved = await save("interrupted");
          if (!clientCancelled) controller.enqueue(encoder.encode(saved ? event("status", { status: "interrupted" }) : event("error", { error: safeError })));
        } else if (completed && output.length > 0) {
          if (await save("complete")) controller.enqueue(encoder.encode(event("status", { status: "complete" })));
          else { await save("error"); controller.enqueue(encoder.encode(event("error", { error: safeError }))); }
        } else {
          await save("error");
          controller.enqueue(encoder.encode(event("error", { error: safeError })));
        }
      } catch {
        const interrupted = clientCancelled || request.signal.aborted;
        let saved = false;
        try { saved = await save(interrupted ? "interrupted" : "error"); } catch { console.error("assistant_state_persist_failed"); }
        if (!interrupted) controller.enqueue(encoder.encode(event("error", { error: safeError })));
        else if (!clientCancelled) controller.enqueue(encoder.encode(saved ? event("status", { status: "interrupted" }) : event("error", { error: safeError })));
      } finally {
        clearTimeout(timeout);
        aborter.abort();
        request.signal.removeEventListener("abort", onRequestAbort);
        if (!clientCancelled) { controller.enqueue(encoder.encode(event("done", {}))); controller.close(); }
      }
    },
    cancel() { clientCancelled = true; aborter.abort(); },
  });
  return new Response(stream, { headers });
}
