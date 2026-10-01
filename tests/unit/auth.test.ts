import { describe, expect, it, vi } from "vitest";
import { getAuthenticatedUser } from "../../lib/auth/get-user";

const clientWith = (result: unknown) => ({ auth: { getClaims: vi.fn().mockResolvedValue(result) } });

describe("getAuthenticatedUser", () => {
  it("returns the user from verified token claims with a single local verification", async () => {
    const client = clientWith({ data: { claims: { sub: "user-123", email: "user@example.test" } }, error: null });

    await expect(getAuthenticatedUser(client)).resolves.toEqual({ id: "user-123", email: "user@example.test" });
    expect(client.auth.getClaims).toHaveBeenCalledOnce();
  });

  it("omits the email when the token carries none", async () => {
    await expect(getAuthenticatedUser(clientWith({ data: { claims: { sub: "user-123" } }, error: null }))).resolves.toEqual({ id: "user-123", email: undefined });
  });

  it("returns null when there is no session", async () => {
    await expect(getAuthenticatedUser(clientWith({ data: null, error: null }))).resolves.toBeNull();
  });

  it("returns null when the token is rejected", async () => {
    await expect(getAuthenticatedUser(clientWith({ data: null, error: new Error("invalid token") }))).resolves.toBeNull();
    await expect(getAuthenticatedUser(clientWith({ data: { claims: { sub: "user-123" } }, error: new Error("invalid signature") }))).resolves.toBeNull();
  });

  it("fails closed when verifying the token throws, for example when the signing keys cannot be fetched", async () => {
    const client = { auth: { getClaims: vi.fn().mockRejectedValue(new Error("jwks fetch failed")) } };
    await expect(getAuthenticatedUser(client)).resolves.toBeNull();
  });

  it("returns null when the claims carry no usable subject", async () => {
    for (const sub of [undefined, "", 42]) {
      await expect(getAuthenticatedUser(clientWith({ data: { claims: { sub } }, error: null }))).resolves.toBeNull();
    }
  });
});
