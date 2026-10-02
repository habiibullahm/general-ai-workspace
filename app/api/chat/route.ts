import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { modelSchema, validateConversationId, validateMessage } from "@/lib/chat/validation";
import { defaultReasoningEffort, reasoningAllowed, reasoningEffortSchema, resolveMode } from "@/lib/chat/models";
import { chatProvider } from "@/lib/ai/provider";
import { toProviderMessages } from "@/lib/ai/provider-messages";
import { contextCapabilitiesFor, getModelOptions } from "@/lib/ai/registry";
import { readOpenAiSse } from "@/lib/ai/sse";
import { buildContext } from "@/lib/context/build-context";
import { CONTEXT_POLICY_VERSION } from "@/lib/context/context-policy";
import type { RoomContextInput } from "@/lib/context/room-context";
import { roomContextFromRows, type RoomBriefRow } from "@/lib/rooms/map";
import { loadOwnerPreferences } from "@/lib/preferences/store";

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
  // The session comes from the verified access token (no Auth round trip); row-level security still scopes every query below to its owner.
  if (!await getAuthenticatedUser(supabase)) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return NextResponse.json({ error: "A JSON request is required." }, { status: 415 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const value = body as { conversationId?: unknown; userMessageId?: unknown; regenerate?: unknown; model?: unknown; reasoning?: unknown };
  const parsedId = validateConversationId(value?.conversationId);
  const parsedMessageId = validateConversationId(value?.userMessageId);
  // The client may name a mode and a reasoning effort, but only from fixed vocabularies; neither is ever a provider model id.
  const requestedModel = value?.model === undefined ? undefined : modelSchema.safeParse(value.model);
  const requestedReasoning = value?.reasoning === undefined ? undefined : reasoningEffortSchema.safeParse(value.reasoning);
  if (!parsedId.success || !parsedMessageId.success || (value.regenerate !== undefined && typeof value.regenerate !== "boolean") || requestedModel?.success === false || requestedReasoning?.success === false) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const regenerate = value.regenerate === true;
  // Only modes that are configured on the server can be used, whether the client asked for one or the conversation has one saved.
  const { models: availableModels, reasoningModes } = getModelOptions();
  const availableModes = availableModels.map((option) => option.id);
  if (requestedModel && !availableModes.includes(requestedModel.data)) return NextResponse.json({ error: "That model isn't available." }, { status: 400 });

  // The conversation, the user message and the recent context only depend on the ids in the request, so they are read together
  // (RLS hides other owners' rows from all three); the message context is trimmed to this message below.
  // Preferences are soft personalization. A failed read uses safe defaults and does not block this authenticated request.
  const [{ data: conversation, error: conversationError }, { data: userMessage, error: messageError }, { data: recent, error: readError }, preferenceState] = await Promise.all([
    supabase.from("conversations").select("id,selected_model,room_id").eq("id", parsedId.data).maybeSingle(),
    supabase.from("messages").select("id,position,content").eq("id", parsedMessageId.data).eq("conversation_id", parsedId.data).eq("role", "user").eq("status", "complete").maybeSingle(),
    supabase.from("messages").select("role,content,status,position").eq("conversation_id", parsedId.data).eq("status", "complete").order("position", { ascending: false }).limit(34),
    loadOwnerPreferences(supabase),
  ]);
  if (preferenceState.error) console.error("preference_read_failed");
  if (conversationError) return NextResponse.json({ error: safeError }, { status: 503 });
  if (!conversation) return NextResponse.json({ error: "Conversation unavailable." }, { status: 404 });
  let room: RoomContextInput | null = null;
  if (conversation.room_id) {
    const [{ data: roomRow, error: roomError }, { data: briefRow, error: briefError }] = await Promise.all([
      supabase.from("rooms").select("name,instructions").eq("id", conversation.room_id).maybeSingle(),
      supabase.from("room_briefs").select("goal,current_focus,important_decisions,open_questions,next_step").eq("room_id", conversation.room_id).maybeSingle(),
    ]);
    if (roomError || briefError) return NextResponse.json({ error: safeError }, { status: 503 });
    room = roomContextFromRows(roomRow, briefRow as RoomBriefRow | null);
  }
  const mode = requestedModel?.data ?? resolveMode(conversation.selected_model, availableModes);
  if (!mode) return NextResponse.json({ error: safeError }, { status: 503 });
  const reasoning = requestedReasoning?.data ?? defaultReasoningEffort;
  if (!reasoningAllowed(reasoning, mode, reasoningModes)) return NextResponse.json({ error: "Reasoning isn't available for this model." }, { status: 400 });
  if (messageError) return NextResponse.json({ error: safeError }, { status: 503 });
  if (!userMessage) return NextResponse.json({ error: "Message unavailable." }, { status: 404 });
  if (!validateMessage(userMessage.content).success) return NextResponse.json({ error: "Invalid saved message." }, { status: 400 });
  const rows = recent?.filter((row) => row.position <= userMessage.position && (row.role === "user" || row.role === "assistant") && row.status === "complete").slice(0, 32);
  if (readError || !rows?.length) return NextResponse.json({ error: safeError }, { status: 503 });
  const { data: assistant, error: claimError } = await supabase.rpc(regenerate ? "regenerate_assistant_message" : "claim_assistant_message", {
    p_conversation_id: conversation.id, p_user_message_id: parsedMessageId.data,
  }).single<{ id: string; position: number; content: string; status: string; replayed: boolean }>();
  if (claimError || !assistant) {
    const status = claimError?.code === "PT404" ? 404 : claimError?.code === "PT409" || claimError?.code === "23505" ? 409 : 503;
    return NextResponse.json({ error: status === 409 ? "Another response is running or a newer message was saved. Refresh and try again." : safeError }, { status });
  }
  const headers = { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform" };
  if (assistant.replayed) return new Response(event("start", { id: assistant.id, position: assistant.position }) + event("delta", { text: assistant.content }) + event("status", { status: "complete" }) + event("done", {}), { headers });

  const persist = async (content: string, status: "complete" | "interrupted" | "error") => {
    const { data, error } = await supabase.from("messages").update({ content, status }).eq("id", assistant.id).eq("status", "streaming").select("id").maybeSingle();
    if (error || !data) console.error("assistant_state_persist_failed");
    return !error && Boolean(data);
  };
  let prompt: ReturnType<typeof toProviderMessages> | undefined;
  let context: ReturnType<typeof buildContext>["diagnostics"] | undefined;
  try {
    const started = Date.now();
    const plan = buildContext({
      capabilities: contextCapabilitiesFor(mode),
      preferences: preferenceState.preferences,
      preferenceReadFailed: Boolean(preferenceState.error),
      summary: null,
      room,
      messages: rows.map((row) => ({ role: row.role as "user" | "assistant", content: row.content, position: row.position })),
      currentPosition: userMessage.position,
    });
    prompt = toProviderMessages(plan);
    context = plan.diagnostics;
    const profile = plan.blocks.some((block) => block.id === "profile" && block.included);
    const roomIncluded = plan.blocks.some((block) => block.id === "room" && block.included);
    const summary = plan.blocks.some((block) => block.id === "thread_summary" && block.included);
    console.info(JSON.stringify({
      event: "context.built",
      "context.build.duration_ms": Date.now() - started,
      "context.source.count": plan.blocks.filter((block) => block.included).length,
      "context.profile.included": profile,
      "context.room.included": roomIncluded,
      "context.summary.included": summary,
      "context.recent_message_count": plan.diagnostics.recentMessageCount,
      "context.estimated_tokens": plan.budget.estimatedTokens,
      "context.truncated": plan.budget.truncated,
      "context.policy_version": CONTEXT_POLICY_VERSION,
    }));
  } catch {
    console.error("context_build_failed");
    try { await persist("Response unavailable.", "error"); } catch { console.error("assistant_state_persist_failed"); }
    return NextResponse.json({ error: safeError }, { status: 503 });
  }
  if (!prompt || !context) return NextResponse.json({ error: safeError }, { status: 503 });

  const aborter = new AbortController();
  let clientCancelled = false;
  const onRequestAbort = () => { clientCancelled = true; aborter.abort(); };
  request.signal.addEventListener("abort", onRequestAbort, { once: true });
  if (request.signal.aborted) onRequestAbort();
  const timeout = setTimeout(() => aborter.abort(), 120_000);
  let responseStream: ReadableStream<Uint8Array>;
  try { responseStream = await chatProvider.stream(mode, prompt, aborter.signal, { reasoning }); }
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
        controller.enqueue(encoder.encode(event("start", { id: assistant.id, position: assistant.position, context })));
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
