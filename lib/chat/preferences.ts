import { validateConversationId } from "@/lib/chat/validation";

// Device chat preferences. Values are the strings "on" and "off" so a bad write cannot be mistaken for a choice.
export const chatPreferenceKeys = {
  enterToSend: "nibie-enter-to-send",
  autoFollow: "nibie-auto-follow",
  showTimestamps: "nibie-show-timestamps",
  restoreLastChat: "nibie-restore-last-chat",
  lastConversation: "nibie-last-conversation",
} as const;

export const defaultChatPreferences = {
  enterToSend: true,
  autoFollow: true,
  showTimestamps: false,
  restoreLastChat: false,
} as const;

export type ChatPreferenceFlag = keyof typeof defaultChatPreferences;

export type PreferenceStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const enabledValues = new Set(["on", "true", "1"]);
const disabledValues = new Set(["off", "false", "0"]);

export function parseStoredFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (enabledValues.has(normalized)) return true;
  if (disabledValues.has(normalized)) return false;
  return fallback;
}

export function readStoredFlag(storage: PreferenceStorage, flag: ChatPreferenceFlag, fallback = defaultChatPreferences[flag]): boolean {
  try {
    return parseStoredFlag(storage.getItem(chatPreferenceKeys[flag]), fallback);
  } catch {
    return fallback;
  }
}

export function writeStoredFlag(storage: PreferenceStorage, flag: ChatPreferenceFlag, value: boolean): boolean {
  try {
    storage.setItem(chatPreferenceKeys[flag], value ? "on" : "off");
    return true;
  } catch {
    return false;
  }
}

export function parseLastConversationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = validateConversationId(value.trim());
  return parsed.success ? parsed.data : null;
}

export function readStoredLastConversationId(storage: PreferenceStorage): string | null {
  try {
    return parseLastConversationId(storage.getItem(chatPreferenceKeys.lastConversation));
  } catch {
    return null;
  }
}

export function writeStoredLastConversationId(storage: PreferenceStorage, id: string): boolean {
  const parsed = parseLastConversationId(id);
  if (!parsed) return false;
  try {
    storage.setItem(chatPreferenceKeys.lastConversation, parsed);
    return true;
  } catch {
    return false;
  }
}

// Removes the stored id. When `id` is passed, a different conversation is left untouched.
export function forgetStoredLastConversationId(storage: PreferenceStorage, id?: string): boolean {
  try {
    if (id) {
      const current = storage.getItem(chatPreferenceKeys.lastConversation);
      if (current !== id) return false;
    }
    storage.removeItem(chatPreferenceKeys.lastConversation);
    return true;
  } catch {
    return false;
  }
}

export type RestoreLastChatDecision = {
  conversationId: string | null;
  forgetStoredId: boolean;
};

// Opening the workspace may return to the last chat. An explicit conversation in the URL wins.
// A stored id is used only when it is a real id the caller has already confirmed this user can access.
export function decideRestoredConversation(input: {
  enabled: boolean;
  storedId: unknown;
  accessibleIds: readonly string[];
  requestedId: unknown;
  historyAvailable: boolean;
}): RestoreLastChatDecision {
  if (typeof input.requestedId === "string" && input.requestedId.length > 0) {
    return { conversationId: null, forgetStoredId: false };
  }
  if (!input.enabled || !input.historyAvailable) return { conversationId: null, forgetStoredId: false };
  if (input.storedId == null || input.storedId === "") return { conversationId: null, forgetStoredId: false };
  const id = parseLastConversationId(input.storedId);
  if (!id || !input.accessibleIds.includes(id)) return { conversationId: null, forgetStoredId: true };
  return { conversationId: id, forgetStoredId: false };
}

export type ComposerEnterAction = "send" | "newline";

// Enter sends by default. Turned off, Enter is a newline and Cmd/Ctrl+Enter sends. Shift+Enter is always a newline.
export function composerEnterAction(input: {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  composing: boolean;
  enterToSend: boolean;
}): ComposerEnterAction | null {
  if (input.composing || input.key !== "Enter") return null;
  if (input.enterToSend) return input.shiftKey ? "newline" : "send";
  if ((input.metaKey || input.ctrlKey) && !input.shiftKey) return "send";
  return "newline";
}
