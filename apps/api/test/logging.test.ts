import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { buildTestApp, validEnv } from "./fixture.js";

describe("logging", () => {
  it("does not log credentials or request content", async () => {
    const lines: string[] = [];
    const logStream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    const app = await buildTestApp(
      { ...validEnv, LOG_LEVEL: "info" },
      async (token) => (token === "valid-token" ? { sub: "user-123" } : null),
      { logStream },
    );
    app.post("/__test/identity", async (request) => ({ userId: request.auth?.userId ?? null }));

    const response = await app.inject({
      method: "POST",
      url: "/__test/identity",
      headers: {
        authorization: "Bearer valid-token",
        cookie: "sb-access-token=secret-cookie",
      },
      payload: { user_id: "attacker-id", password: "secret-password", prompt: "private prompt" },
    });

    const logs = lines.join("\n");
    expect(response.statusCode).toBe(200);
    expect(logs).toContain("\"method\":\"POST\"");
    expect(logs).toContain("\"path\":\"/__test/identity\"");
    expect(logs).not.toContain("valid-token");
    expect(logs).not.toContain("secret-cookie");
    expect(logs).not.toContain("secret-password");
    expect(logs).not.toContain("private prompt");
    expect(logs).not.toContain("attacker-id");
    await app.close();
  });
});
