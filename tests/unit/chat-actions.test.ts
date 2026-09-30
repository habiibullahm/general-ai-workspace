import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addUserMessageAction, createConversationAction, deleteConversationAction, renameConversationAction, updateConversationModelAction } from "../../app/actions/chat";

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
});
