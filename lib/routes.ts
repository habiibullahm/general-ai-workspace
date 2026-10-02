import { validateConversationId } from "@/lib/chat/validation";

export const chatPath = "/chat";

export function conversationPath(id: string) {
  return `${chatPath}?conversation=${encodeURIComponent(id)}`;
}

// Old bookmarks used /?conversation=<uuid>. Only a real conversation id leaves the marketing page.
export function legacyConversationPath(value: unknown) {
  const parsed = validateConversationId(value);
  return parsed.success ? conversationPath(parsed.data) : null;
}
