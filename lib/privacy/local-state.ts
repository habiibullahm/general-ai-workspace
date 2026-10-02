import { chatPreferenceKeys } from "@/lib/chat/preferences";

// Cleared after delete-all so a removed id cannot be reopened. The key lives with the other device chat preferences.
export const LAST_CONVERSATION_STORAGE_KEY = chatPreferenceKeys.lastConversation;

type KeyValueStore = { removeItem(key: string): void };

export function clearStoredConversationReference(storage: KeyValueStore | null | undefined) {
  if (!storage) return;
  try {
    storage.removeItem(LAST_CONVERSATION_STORAGE_KEY);
  } catch {
    // Blocked storage must not keep the user on a conversation that has just been deleted.
  }
}
