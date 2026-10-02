import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, redirect, revalidatePath } = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: createClient }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { signOutAction } from "../../app/actions/auth";
import { SIGN_OUT_DESCRIPTION, SIGN_OUT_LABEL, SIGN_OUT_SCOPE } from "../../lib/privacy/sign-out";

describe("sign-out copy and behaviour", () => {
  beforeEach(() => { createClient.mockReset(); redirect.mockClear(); revalidatePath.mockClear(); });

  it("describes a global sign-out", () => {
    expect(SIGN_OUT_SCOPE).toBe("global");
    expect(SIGN_OUT_LABEL).toBe("Sign out everywhere");
    expect(SIGN_OUT_DESCRIPTION).toContain("every device");
    expect(SIGN_OUT_DESCRIPTION.toLowerCase()).not.toContain("this device only");
    const sidebar = readFileSync(new URL("../../components/chat-sidebar.tsx", import.meta.url), "utf8");
    const dialog = readFileSync(new URL("../../components/data-privacy-dialog.tsx", import.meta.url), "utf8");
    expect(sidebar).toContain("SIGN_OUT_LABEL");
    expect(sidebar).not.toContain(">Sign out<");
    expect(dialog).toContain("SIGN_OUT_DESCRIPTION");
    expect(dialog).toContain("Account deletion is not available yet");
  });

  it("keeps Supabase sign-out global across devices", async () => {
    const signOut = vi.fn(async (options: { scope: string }) => ({ error: options.scope === SIGN_OUT_SCOPE ? null : { message: "unexpected scope" } }));
    createClient.mockResolvedValue({ auth: { signOut } });
    await expect(signOutAction()).rejects.toThrow("REDIRECT:/login");
    expect(signOut).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(signOut.mock.calls[0][0].scope).toBe("global");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});