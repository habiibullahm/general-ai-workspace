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
export type PersistedMessage = { id: string; role: "user" | "assistant"; content: string; position: number };

export async function getChatWorkspaceData(conversationId: unknown) {
  const supabase = await createSupabaseServerClient();
  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("id,title,selected_model,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true });
  if (conversationsError) return { conversations: [] as ConversationSummary[], messages: [] as PersistedMessage[], activeId: null, error: "Conversation history couldn't be loaded. Refresh to try again." };

  const parsedId = validateConversationId(conversationId);
  const active = parsedId.success ? conversations?.find((item) => item.id === parsedId.data) : undefined;
  if (!active) return { conversations: conversations ?? [], messages: [] as PersistedMessage[], activeId: null, error: null };

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id,role,content,position")
    .eq("conversation_id", active.id)
    .order("position", { ascending: true });
  if (messagesError) return { conversations: conversations ?? [], messages: [] as PersistedMessage[], activeId: active.id, error: "This conversation couldn't be loaded. Refresh to try again." };
  return { conversations: conversations ?? [], messages: messages ?? [], activeId: active.id, error: null };
}
