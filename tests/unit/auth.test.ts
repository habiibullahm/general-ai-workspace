import { describe, expect, it, vi } from "vitest";
import { getAuthenticatedUser } from "../../lib/auth/get-user";

describe("getAuthenticatedUser", () => {
  it("returns a user only after Supabase verifies the session", async () => {
    const user = { id: "user-123", email: "user@example.test" };
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
    };

    await expect(getAuthenticatedUser(client)).resolves.toEqual(user);
    expect(client.auth.getUser).toHaveBeenCalledOnce();
  });

  it("returns null when no authenticated user exists", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    };

    await expect(getAuthenticatedUser(client)).resolves.toBeNull();
  });

  it("returns null when Supabase rejects the session", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("invalid token") }),
      },
    };

    await expect(getAuthenticatedUser(client)).resolves.toBeNull();
  });
});
