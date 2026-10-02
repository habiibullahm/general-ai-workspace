import { describe, expect, it } from "vitest";
import {
  chatPreferenceKeys,
  composerEnterAction,
  decideRestoredConversation,
  defaultChatPreferences,
  parseLastConversationId,
  parseStoredFlag,
  readStoredFlag,
  readStoredLastConversationId,
  writeStoredFlag,
  writeStoredLastConversationId,
  forgetStoredLastConversationId,
  type PreferenceStorage,
} from "../../lib/chat/preferences";
import { formatMessageTimestamp } from "../../lib/chat/timestamps";

const owned = "5e9bdcca-9205-4fea-a773-13952bb78c44";
const other = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

function memory(initial: Record<string, string> = {}): PreferenceStorage & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => { items.set(key, value); },
    removeItem: (key) => { items.delete(key); },
  };
}

const blocked: PreferenceStorage = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("blocked"); },
  removeItem() { throw new Error("blocked"); },
};

describe("stored chat flags", () => {
  it("uses the defaults that preserve today's chat", () => {
    expect(defaultChatPreferences).toEqual({ enterToSend: true, autoFollow: true, showTimestamps: false, restoreLastChat: false });
    const storage = memory();
    expect(readStoredFlag(storage, "enterToSend")).toBe(true);
    expect(readStoredFlag(storage, "autoFollow")).toBe(true);
    expect(readStoredFlag(storage, "showTimestamps")).toBe(false);
    expect(readStoredFlag(storage, "restoreLastChat")).toBe(false);
  });

  it("accepts on and off, and rejects anything else", () => {
    expect(parseStoredFlag("on", false)).toBe(true);
    expect(parseStoredFlag(" OFF ", true)).toBe(false);
    expect(parseStoredFlag("true", false)).toBe(true);
    expect(parseStoredFlag("0", true)).toBe(false);
    expect(parseStoredFlag("yes", true)).toBe(true);
    expect(parseStoredFlag("yes", false)).toBe(false);
    expect(parseStoredFlag("enabled", false)).toBe(false);
    expect(parseStoredFlag("<script>", true)).toBe(true);
    expect(parseStoredFlag(1, false)).toBe(false);
    expect(parseStoredFlag(null, true)).toBe(true);

    const storage = memory({
      [chatPreferenceKeys.enterToSend]: "sometimes",
      [chatPreferenceKeys.showTimestamps]: "yes",
      [chatPreferenceKeys.autoFollow]: "off",
      [chatPreferenceKeys.restoreLastChat]: "on",
    });
    expect(readStoredFlag(storage, "enterToSend")).toBe(true);
    expect(readStoredFlag(storage, "showTimestamps")).toBe(false);
    expect(readStoredFlag(storage, "autoFollow")).toBe(false);
    expect(readStoredFlag(storage, "restoreLastChat")).toBe(true);
  });

  it("falls back to defaults when storage is blocked", () => {
    expect(readStoredFlag(blocked, "enterToSend")).toBe(true);
    expect(readStoredFlag(blocked, "showTimestamps")).toBe(false);
    expect(readStoredLastConversationId(blocked)).toBeNull();
    expect(writeStoredFlag(blocked, "enterToSend", false)).toBe(false);
    expect(writeStoredLastConversationId(blocked, owned)).toBe(false);
    expect(forgetStoredLastConversationId(blocked)).toBe(false);
  });

  it("stores flags as on or off", () => {
    const storage = memory();
    expect(writeStoredFlag(storage, "showTimestamps", true)).toBe(true);
    expect(storage.items.get(chatPreferenceKeys.showTimestamps)).toBe("on");
    writeStoredFlag(storage, "showTimestamps", false);
    expect(storage.items.get(chatPreferenceKeys.showTimestamps)).toBe("off");
  });
});

describe("last conversation id", () => {
  it("keeps only a conversation id", () => {
    expect(parseLastConversationId(owned)).toBe(owned);
    expect(parseLastConversationId(`  ${owned}  `)).toBe(owned);
    expect(parseLastConversationId("not-a-uuid")).toBeNull();
    expect(parseLastConversationId("<script>")).toBeNull();
    expect(parseLastConversationId("")).toBeNull();
    expect(parseLastConversationId(null)).toBeNull();
    const storage = memory({ [chatPreferenceKeys.lastConversation]: "deleted" });
    expect(readStoredLastConversationId(storage)).toBeNull();
  });

  it("refuses to remember an id that is not a conversation", () => {
    const storage = memory();
    expect(writeStoredLastConversationId(storage, "preview-writing")).toBe(false);
    expect(storage.items.has(chatPreferenceKeys.lastConversation)).toBe(false);
    expect(writeStoredLastConversationId(storage, owned)).toBe(true);
    expect(forgetStoredLastConversationId(storage, other)).toBe(false);
    expect(storage.items.get(chatPreferenceKeys.lastConversation)).toBe(owned);
    expect(forgetStoredLastConversationId(storage, owned)).toBe(true);
    expect(storage.items.has(chatPreferenceKeys.lastConversation)).toBe(false);
  });
});

describe("restore last conversation", () => {
  const base = { enabled: true, storedId: owned, accessibleIds: [owned], requestedId: null, historyAvailable: true };

  it("returns the last chat only when it is still accessible", () => {
    expect(decideRestoredConversation(base)).toEqual({ conversationId: owned, forgetStoredId: false });
  });

  it("stays on a new chat when the preference is off", () => {
    expect(decideRestoredConversation({ ...base, enabled: false })).toEqual({ conversationId: null, forgetStoredId: false });
  });

  it("does not override an explicit conversation in the URL", () => {
    expect(decideRestoredConversation({ ...base, requestedId: other })).toEqual({ conversationId: null, forgetStoredId: false });
  });

  it("forgets a deleted or inaccessible id and opens a new chat", () => {
    expect(decideRestoredConversation({ ...base, accessibleIds: [] })).toEqual({ conversationId: null, forgetStoredId: true });
    expect(decideRestoredConversation({ ...base, accessibleIds: [other] })).toEqual({ conversationId: null, forgetStoredId: true });
    expect(decideRestoredConversation({ ...base, storedId: "not-a-uuid" })).toEqual({ conversationId: null, forgetStoredId: true });
    expect(decideRestoredConversation({ ...base, storedId: "<script>" })).toEqual({ conversationId: null, forgetStoredId: true });
  });

  it("does not wipe a stored id when history failed to load or nothing was stored", () => {
    expect(decideRestoredConversation({ ...base, historyAvailable: false, storedId: "not-a-uuid" })).toEqual({ conversationId: null, forgetStoredId: false });
    expect(decideRestoredConversation({ ...base, storedId: null })).toEqual({ conversationId: null, forgetStoredId: false });
    expect(decideRestoredConversation({ ...base, storedId: "" })).toEqual({ conversationId: null, forgetStoredId: false });
  });
});

describe("Enter to send", () => {
  const key = (overrides: Partial<Parameters<typeof composerEnterAction>[0]>) => composerEnterAction({
    key: "Enter", shiftKey: false, metaKey: false, ctrlKey: false, composing: false, enterToSend: true, ...overrides,
  });

  it("sends on Enter and keeps Shift+Enter as a newline", () => {
    expect(key({})).toBe("send");
    expect(key({ shiftKey: true })).toBe("newline");
    expect(key({ ctrlKey: true })).toBe("send");
    expect(key({ metaKey: true })).toBe("send");
  });

  it("inserts a newline on Enter and sends on Cmd or Ctrl+Enter when Enter to send is off", () => {
    expect(key({ enterToSend: false })).toBe("newline");
    expect(key({ enterToSend: false, shiftKey: true })).toBe("newline");
    expect(key({ enterToSend: false, ctrlKey: true })).toBe("send");
    expect(key({ enterToSend: false, metaKey: true })).toBe("send");
    expect(key({ enterToSend: false, ctrlKey: true, shiftKey: true })).toBe("newline");
  });

  it("leaves other keys and an in-progress composition alone", () => {
    expect(key({ key: "a" })).toBeNull();
    expect(key({ composing: true })).toBeNull();
    expect(key({ enterToSend: false, composing: true, ctrlKey: true })).toBeNull();
  });
});

describe("message timestamps", () => {
  const now = new Date(2026, 9, 2, 15, 4, 0).getTime();
  const sameDay = new Date(2026, 9, 2, 8, 31, 0).toISOString();
  const older = new Date(2026, 9, 1, 8, 31, 0).toISOString();

  it("shows a clock for today and a short date for earlier messages", () => {
    const timeOnly = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(sameDay));
    const olderTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(older));
    expect(formatMessageTimestamp(sameDay, now, "en-US")).toBe(timeOnly);
    expect(formatMessageTimestamp(older, now, "en-US")).toBe(`Oct 1 · ${olderTime}`);
  });

  it("hides an unreadable time", () => {
    expect(formatMessageTimestamp("not-a-time", now, "en-US")).toBeNull();
    expect(formatMessageTimestamp("", now, "en-US")).toBeNull();
  });
});
