"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  defaultChatPreferences,
  forgetStoredLastConversationId,
  parseLastConversationId,
  readStoredFlag,
  readStoredLastConversationId,
  writeStoredFlag,
  writeStoredLastConversationId,
  type ChatPreferenceFlag,
  type PreferenceStorage,
} from "@/lib/chat/preferences";

const changeEvent = "nibie-chat-preferences-change";

function browserStorage(): PreferenceStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function notify() {
  window.dispatchEvent(new Event(changeEvent));
}

export function subscribeChatPreferences(onStoreChange: () => void) {
  window.addEventListener(changeEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(changeEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function readChatFlag(flag: ChatPreferenceFlag): boolean {
  const storage = browserStorage();
  if (!storage) return defaultChatPreferences[flag];
  return readStoredFlag(storage, flag);
}

export function writeChatFlag(flag: ChatPreferenceFlag, value: boolean) {
  const storage = browserStorage();
  if (storage) writeStoredFlag(storage, flag, value);
  notify();
}

export function readLastConversationId(): string | null {
  const storage = browserStorage();
  return storage ? readStoredLastConversationId(storage) : null;
}

export function writeLastConversationId(id: string) {
  const storage = browserStorage();
  if (!storage || !parseLastConversationId(id)) return;
  writeStoredLastConversationId(storage, id);
}

export function forgetLastConversationId(id?: string) {
  const storage = browserStorage();
  if (storage) forgetStoredLastConversationId(storage, id);
}

const readClient = {
  enterToSend: () => readChatFlag("enterToSend"),
  autoFollow: () => readChatFlag("autoFollow"),
  showTimestamps: () => readChatFlag("showTimestamps"),
  restoreLastChat: () => readChatFlag("restoreLastChat"),
} as const;

const readServer = {
  enterToSend: () => defaultChatPreferences.enterToSend,
  autoFollow: () => defaultChatPreferences.autoFollow,
  showTimestamps: () => defaultChatPreferences.showTimestamps,
  restoreLastChat: () => defaultChatPreferences.restoreLastChat,
} as const;

// The server render uses the default. The stored value is read after hydration, so the markup matches.
export function useChatFlag(flag: ChatPreferenceFlag) {
  const value = useSyncExternalStore(subscribeChatPreferences, readClient[flag], readServer[flag]);
  const set = useCallback((next: boolean) => writeChatFlag(flag, next), [flag]);
  return [value, set] as const;
}
