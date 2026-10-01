import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addUserMessageAction, createConversationAction, deleteConversationAction, editLastUserMessageAction, renameConversationAction, updateConversationModelAction } from "../../app/actions/chat";

describe("chat server action input boundaries", () => {
  beforeEach(() => createClient.mockReset());

  it("rejects unsupported models before opening an authenticated client", async () => {
    await expect(createConversationAction("default")).resolves.toEqual({ error: "Choose a valid response mode." });
    await expect(updateConversationModelAction("5e9bdcca-9205-4fea-a773-13952bb78c44", "unknown")).resolves.toEqual({ error: "Choose a valid response mode." });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects malformed IDs and invalid message/title content before database access", async () => {
    await expect(addUserMessageAction("someone-elses-id", "hello")).resolves.toMatchObject({ error: expect.any(String) });
    await expect(addUserMessageAction("5e9bdcca-9205-4fea-a773-13952bb78c44", " ")).resolves.toMatchObject({ error: expect.any(String) });
    await expect(renameConversationAction("5e9bdcca-9205-4fea-a773-13952bb78c44", " ")).resolves.toMatchObject({ error: expect.any(String) });
    await expect(deleteConversationAction("not-a-uuid")).resolves.toMatchObject({ error: expect.any(String) });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("validates edit input before database access and maps the RPC outcomes to safe messages", async () => {
    const conversation = "5e9bdcca-9205-4fea-a773-13952bb78c44";
    const message = "b79e56e1-b479-46f4-97d3-30b2e22be90e";
    await expect(editLastUserMessageAction("bad", message, "hello")).resolves.toMatchObject({ error: expect.any(String) });
    await expect(editLastUserMessageAction(conversation, "bad", "hello")).resolves.toMatchObject({ error: expect.any(String) });
    await expect(editLastUserMessageAction(conversation, message, "   ")).resolves.toMatchObject({ error: expect.any(String) });
    expect(createClient).not.toHaveBeenCalled();
    const rpc = vi.fn(() => ({ single: async () => ({ data: { id: message, position: 1 }, error: null }) }));
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, rpc });
    expect(await editLastUserMessageAction(conversation, message, " edited ")).toEqual({ data: { id: message, position: 1 } });
    expect(rpc).toHaveBeenCalledWith("edit_last_user_message", { p_conversation_id: conversation, p_message_id: message, p_content: "edited" });
    for (const code of ["PT409", "PT404", "XX000"]) {
      const failing = vi.fn(() => ({ single: async () => ({ data: null, error: { code, message: "internal detail must not leak" } }) }));
      createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, rpc: failing });
      const result = await editLastUserMessageAction(conversation, message, "edited");
      expect(result.data).toBeUndefined();
      expect(result.error).toBeTruthy();
      expect(result.error).not.toContain("internal detail");
    }
  });

  it("passes a stable submission id to the transactional append RPC", async () => {
    const conversation = "5e9bdcca-9205-4fea-a773-13952bb78c44";
    const message = "b79e56e1-b479-46f4-97d3-30b2e22be90e";
    const rpc = vi.fn(() => ({ single: async () => ({ data: { id: message, position: 1 }, error: null }) }));
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, rpc });
    expect(await addUserMessageAction(conversation, " hello ", message)).toEqual({ data: { id: message, position: 1 } });
    expect(rpc).toHaveBeenCalledWith("append_user_message", { p_conversation_id: conversation, p_message_id: message, p_content: "hello" });
  });
});
