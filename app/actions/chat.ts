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

export async function addUserMessageAction(id: unknown, content: unknown): Promise<ChatActionResult> {
  const parsedId = validateConversationId(id);
  const parsedContent = validateMessage(content);
  if (!parsedId.success) return { error: "Choose a valid conversation." };
  if (!parsedContent.success) return { error: "Messages must be between 1 and 20,000 characters." };
  try {
    const { supabase, user } = await authenticatedClient();
    const { data: conversation, error: conversationError } = await supabase.from("conversations").select("id,title").eq("id", parsedId.data).maybeSingle();
    if (conversationError || !conversation) return { error: "That conversation is no longer available." };
    const { data: last, error: positionError } = await supabase.from("messages").select("position").eq("conversation_id", parsedId.data).order("position", { ascending: false }).limit(1).maybeSingle();
    if (positionError) return failure();
    const position = (last?.position ?? 0) + 1;
    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: parsedId.data,
      user_id: user.id,
      role: "user",
      content: parsedContent.data,
      status: "complete",
      position,
    });
    if (insertError) return failure();
    const updates: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
    if (conversation.title === "New chat") updates.title = parsedContent.data.slice(0, 42).trimEnd() + (parsedContent.data.length > 42 ? "…" : "");
    const { error: updateError } = await supabase.from("conversations").update(updates).eq("id", parsedId.data);
    if (updateError) return failure();
    revalidatePath("/");
    return {};
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
