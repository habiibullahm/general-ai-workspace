import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateConversationId } from "@/lib/chat/validation";

export type ConversationSummary = {
  id: string;
  title: string;
  selected_model: string;
  created_at: string;
  updated_at: string;
};
export type PersistedMessage = { id: string; role: "user" | "assistant"; content: string; position: number; status?: "complete" | "streaming" | "interrupted" | "error" };

export async function getChatWorkspaceData(conversationId: unknown) {
  const supabase = await createSupabaseServerClient();
  const parsedId = validateConversationId(conversationId);
  const readMessages = (id: string) => supabase
    .from("messages")
    .select("id,role,content,position,status")
    .eq("conversation_id", id)
    .order("position", { ascending: true });

  // The history list and the selected conversation's messages are independent reads, so they run together.
  // RLS scopes both to the signed-in owner; messages are only used when the conversation is in the owner's list.
  const [{ data: conversations, error: conversationsError }, messagesResult] = await Promise.all([
    supabase
      .from("conversations")
      .select("id,title,selected_model,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true }),
    parsedId.success ? readMessages(parsedId.data) : Promise.resolve(null),
  ]);
  if (conversationsError) return { conversations: [] as ConversationSummary[], messages: [] as PersistedMessage[], activeId: null, error: "Conversation history couldn't be loaded. Refresh to try again." };

  const active = parsedId.success ? conversations?.find((item) => item.id === parsedId.data) : undefined;
  if (!active || !messagesResult) return { conversations: conversations ?? [], messages: [] as PersistedMessage[], activeId: null, error: null };

  const loadError = { conversations: conversations ?? [], messages: [] as PersistedMessage[], activeId: active.id, error: "This conversation couldn't be loaded. Refresh to try again." };
  if (messagesResult.error) return loadError;
  let messages = messagesResult.data ?? [];

  // Stale-generation recovery takes a conversation lock and a write, so only pay for it when a response is actually marked streaming.
  if (messages.some((message) => message.status === "streaming")) {
    const { error: recoveryError } = await supabase.rpc("recover_stale_chat", { p_conversation_id: active.id });
    if (recoveryError) return loadError;
    const reread = await readMessages(active.id);
    if (reread.error) return loadError;
    messages = reread.data ?? [];
  }
  return { conversations: conversations ?? [], messages, activeId: active.id, error: null };
}
