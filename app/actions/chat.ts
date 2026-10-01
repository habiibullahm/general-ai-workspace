"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { modelSchema, validateConversationId, validateMessage, validateTitle } from "@/lib/chat/validation";

export type ChatActionResult<T = undefined> = { data?: T; error?: string };
type ConversationRow = { id: string; title: string; selected_model: string; created_at: string; updated_at: string };

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Your session has expired. Please sign in again.");
  return { supabase, user };
}

function failure<T>(): ChatActionResult<T> {
  return { error: "We couldn't save that change. Please try again." };
}

export async function createConversationAction(model: unknown): Promise<ChatActionResult<ConversationRow>> {
  const parsedModel = modelSchema.safeParse(model);
  if (!parsedModel.success) return { error: "Choose a valid response mode." };
  try {
    const { supabase, user } = await authenticatedClient();
    const { data, error } = await supabase.from("conversations").insert({
      user_id: user.id,
      title: "New chat",
      selected_model: parsedModel.data,
    }).select("id,title,selected_model,created_at,updated_at").single();
    if (error || !data) return failure();
    revalidatePath("/");
    return { data };
  } catch {
    return { error: "Your session has expired or the service is unavailable. Please try again." };
  }
}

export async function updateConversationModelAction(id: unknown, model: unknown): Promise<ChatActionResult> {
  const parsedId = validateConversationId(id);
  const parsedModel = modelSchema.safeParse(model);
  if (!parsedId.success) return { error: "Choose a valid conversation." };
  if (!parsedModel.success) return { error: "Choose a valid response mode." };
  try {
    const { supabase } = await authenticatedClient();
    const { data, error } = await supabase.from("conversations").update({ selected_model: parsedModel.data, updated_at: new Date().toISOString() }).eq("id", parsedId.data).select("id").maybeSingle();
    if (error) return failure();
    if (!data) return { error: "That conversation is no longer available." };
    revalidatePath("/");
    return {};
  } catch {
    return { error: "Your session has expired or the service is unavailable. Please try again." };
  }
}

export async function addUserMessageAction(id: unknown, content: unknown, messageId: unknown = crypto.randomUUID()): Promise<ChatActionResult<{ id: string; position: number }>> {
  const parsedId = validateConversationId(id);
  const parsedContent = validateMessage(content);
  if (!parsedId.success) return { error: "Choose a valid conversation." };
  if (!parsedContent.success) return { error: "Messages must be between 1 and 20,000 characters." };
  const parsedMessageId = validateConversationId(messageId);
  if (!parsedMessageId.success) return { error: "Choose a valid message." };
  try {
    const { supabase } = await authenticatedClient();
    const { data: inserted, error } = await supabase.rpc("append_user_message", {
      p_conversation_id: parsedId.data, p_message_id: parsedMessageId.data, p_content: parsedContent.data,
    }).single<{ id: string; position: number }>();
    if (error?.code === "PT409") return { error: "A response is already running or this submission changed. Refresh and try again." };
    if (error?.code === "PT404") return { error: "That conversation is no longer available." };
    if (error || !inserted) return failure();
    revalidatePath("/");
    return { data: inserted };
  } catch {
    return { error: "Your session has expired or the service is unavailable. Please try again." };
  }
}

export async function editLastUserMessageAction(id: unknown, messageId: unknown, content: unknown): Promise<ChatActionResult<{ id: string; position: number }>> {
  const parsedId = validateConversationId(id);
  const parsedMessageId = validateConversationId(messageId);
  const parsedContent = validateMessage(content);
  if (!parsedId.success) return { error: "Choose a valid conversation." };
  if (!parsedMessageId.success) return { error: "Choose a valid message." };
  if (!parsedContent.success) return { error: "Messages must be between 1 and 20,000 characters." };
  try {
    const { supabase } = await authenticatedClient();
    const { data, error } = await supabase.rpc("edit_last_user_message", {
      p_conversation_id: parsedId.data, p_message_id: parsedMessageId.data, p_content: parsedContent.data,
    }).single<{ id: string; position: number }>();
    if (error?.code === "PT409") return { error: "Only the latest message can be edited while no response is running. Refresh and try again." };
    if (error?.code === "PT404") return { error: "That message is no longer available." };
    if (error || !data) return failure();
    revalidatePath("/");
    return { data };
  } catch {
    return { error: "Your session has expired or the service is unavailable. Please try again." };
  }
}

export async function renameConversationAction(id: unknown, title: unknown): Promise<ChatActionResult> {
  const parsedId = validateConversationId(id);
  const parsedTitle = validateTitle(title);
  if (!parsedId.success) return { error: "Choose a valid conversation." };
  if (!parsedTitle.success) return { error: "Titles must be between 1 and 120 characters." };
  try {
    const { supabase } = await authenticatedClient();
    const { data, error } = await supabase.from("conversations").update({ title: parsedTitle.data, updated_at: new Date().toISOString() }).eq("id", parsedId.data).select("id").maybeSingle();
    if (error) return failure();
    if (!data) return { error: "That conversation is no longer available." };
    revalidatePath("/");
    return {};
  } catch {
    return { error: "Your session has expired or the service is unavailable. Please try again." };
  }
}

export async function deleteConversationAction(id: unknown): Promise<ChatActionResult> {
  const parsedId = validateConversationId(id);
  if (!parsedId.success) return { error: "Choose a valid conversation." };
  try {
    const { supabase } = await authenticatedClient();
    const { data, error } = await supabase.from("conversations").delete().eq("id", parsedId.data).select("id").maybeSingle();
    if (error) return failure();
    if (!data) return { error: "That conversation is no longer available." };
    revalidatePath("/");
    return {};
  } catch {
    return { error: "Your session has expired or the service is unavailable. Please try again." };
  }
}
