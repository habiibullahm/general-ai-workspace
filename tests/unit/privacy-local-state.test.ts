import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAST_CONVERSATION_STORAGE_KEY, clearStoredConversationReference } from "../../lib/privacy/local-state";

describe("stale conversation reference", () => {
  it("clears the stored last conversation", () => {
    const removed: string[] = [];
    clearStoredConversationReference({ removeItem: (key) => { removed.push(key); } });
    expect(LAST_CONVERSATION_STORAGE_KEY).toBe("nibie-last-conversation");
    expect(removed).toEqual(["nibie-last-conversation"]);
  });

  it("is cleared when delete-all returns the workspace to a new chat", () => {
    const workspace = readFileSync(new URL("../../components/chat-workspace.tsx", import.meta.url), "utf8");
    expect(workspace).toContain("clearStoredConversationReference");
    expect(workspace).toContain("openConversation(null)");
    expect(workspace).toContain("setLocalConversations([])");
    expect(workspace).toContain("setLocalMessages({})");
  });

  it("still finishes when storage is missing or blocked", () => {
    expect(() => clearStoredConversationReference(null)).not.toThrow();
    expect(() => clearStoredConversationReference(undefined)).not.toThrow();
    expect(() => clearStoredConversationReference({ removeItem() { throw new Error("blocked"); } })).not.toThrow();
  });
});
