import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { modelSchema, validateConversationId } from "@/lib/chat/validation";
import { chatProvider } from "@/lib/ai/provider";
import { readOpenAiSse } from "@/lib/ai/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const safeError = "Nibie couldn't complete that response. Please try again.";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function event(type: string, data: unknown) { return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`; }

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const value = body as { conversationId?: unknown; userMessageId?: unknown };
  const parsedId = validateConversationId(value?.conversationId);
  if (!parsedId.success || typeof value?.userMessageId !== "string" || !uuid.test(value.userMessageId)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { data: conversation } = await supabase.from("conversations").select("id,selected_model").eq("id", parsedId.data).maybeSingle();
  const selected = conversation && modelSchema.safeParse(conversation.selected_model);
  if (!conversation || !selected?.success) return NextResponse.json({ error: "Conversation unavailable." }, { status: 404 });
  const { data: userMessage } = await supabase.from("messages").select("id,position").eq("id", value.userMessageId).eq("conversation_id", conversation.id).eq("role", "user").eq("status", "complete").maybeSingle();
  if (!userMessage) return NextResponse.json({ error: "Message unavailable." }, { status: 404 });
  const { data: rows, error: readError } = await supabase.from("messages").select("role,content,status,position").eq("conversation_id", conversation.id).lte("position", userMessage.position).order("position", { ascending: true });
  if (readError || !rows?.length) return NextResponse.json({ error: safeError }, { status: 503 });
  const context = rows.filter((row) => row.status === "complete" && (row.role === "user" || row.role === "assistant")).map((row) => ({ role: row.role as "user" | "assistant", content: row.content }));
  const { data: last } = await supabase.from("messages").select("position").eq("conversation_id", conversation.id).order("position", { ascending: false }).limit(1).maybeSingle();
  const position = (last?.position ?? 0) + 1;
  const { data: assistant, error: insertError } = await supabase.from("messages").insert({ conversation_id: conversation.id, user_id: user.id, role: "assistant", content: "…", status: "streaming", position }).select("id").single();
  if (insertError || !assistant) return NextResponse.json({ error: "Another response is already starting. Refresh and try again." }, { status: 409 });

  const aborter = new AbortController();
  let clientCancelled = false;
  const onRequestAbort = () => { clientCancelled = true; aborter.abort(); };
  request.signal.addEventListener("abort", onRequestAbort, { once: true });
  if (request.signal.aborted) onRequestAbort();
  let responseStream: ReadableStream<Uint8Array>;
  try { responseStream = await chatProvider.stream(selected.data, context, aborter.signal); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing AI configuration:")) console.error(error.message);
    await supabase.from("messages").update({ content: clientCancelled ? "Response stopped." : "Response unavailable.", status: clientCancelled ? "interrupted" : "error" }).eq("id", assistant.id);
    request.signal.removeEventListener("abort", onRequestAbort);
    return NextResponse.json({ error: safeError }, { status: 502 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let output = ""; let completed = false;
      const persist = async (status: "complete" | "interrupted" | "error") => {
        const content = output || (status === "interrupted" ? "Response stopped." : "Response unavailable.");
        await supabase.from("messages").update({ content, status }).eq("id", assistant.id);
      };
      try {
        for await (const item of readOpenAiSse(responseStream)) {
          if (item.type === "done") { completed = true; continue; }
          output += item.text; controller.enqueue(encoder.encode(event("delta", { text: item.text })));
        }
        if (clientCancelled || request.signal.aborted) { await persist("interrupted"); if (!clientCancelled) controller.enqueue(encoder.encode(event("status", { status: "interrupted" }))); }
        else if (completed && output.length > 0) { await persist("complete"); controller.enqueue(encoder.encode(event("status", { status: "complete" }))); }
        else { await persist("error"); controller.enqueue(encoder.encode(event("error", { error: safeError }))); }
      } catch {
        const interrupted = clientCancelled || request.signal.aborted;
        await persist(interrupted ? "interrupted" : "error");
        if (!interrupted) controller.enqueue(encoder.encode(event("error", { error: safeError })));
      } finally {
        request.signal.removeEventListener("abort", onRequestAbort);
        if (!clientCancelled) { controller.enqueue(encoder.encode(event("done", {}))); controller.close(); }
      }
    },
    cancel() { clientCancelled = true; aborter.abort(); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
