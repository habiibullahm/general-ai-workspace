import { describe, expect, it } from "vitest";
import { buildTestApp, validEnv } from "./fixture.js";

const verifyToken = async (token: string) => (token === "valid-token" ? { sub: "user-123" } : null);

async function identityApp() {
  const app = await buildTestApp(validEnv, verifyToken);
  app.post("/__test/identity", async (request) => ({ userId: request.auth?.userId ?? null }));
  return app;
}

describe("auth", () => {
  it("rejects a missing bearer token", async () => {
    const app = await identityApp();
    const response = await app.inject({
      method: "POST",
      url: "/__test/identity",
      payload: { user_id: "attacker-id" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("unauthorized");
    expect(response.json().error.message).toBe("Authentication required.");
    await app.close();
  });

  it("rejects a malformed bearer token", async () => {
    const app = await identityApp();
    const response = await app.inject({
      method: "POST",
      url: "/__test/identity",
      headers: { authorization: "Token valid-token" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("unauthorized");
    await app.close();
  });

  it("rejects an invalid bearer token", async () => {
    const app = await identityApp();
    const response = await app.inject({
      method: "POST",
      url: "/__test/identity",
      headers: { authorization: "Bearer wrong-token" },
      payload: { user_id: "attacker-id" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("unauthorized");
    await app.close();
  });

  it("uses the verified sub and ignores a body user_id", async () => {
    const app = await identityApp();
    const response = await app.inject({
      method: "POST",
      url: "/__test/identity",
      headers: { authorization: "Bearer valid-token" },
      payload: { user_id: "attacker-id", userId: "attacker-id", user: "attacker-id" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: "user-123" });
    await app.close();
  });
});
