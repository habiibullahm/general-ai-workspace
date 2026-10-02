import { describe, expect, it } from "vitest";
import { buildTestApp, validEnv } from "./fixture.js";

describe("origin", () => {
  it("accepts an allowlisted origin and does not reflect any other origin", async () => {
    const app = await buildTestApp({
      ...validEnv,
      APP_ORIGINS: "https://nibie.example, https://preview.nibie.example",
    });
    const allowed = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://nibie.example" },
    });

    expect(allowed.statusCode).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://nibie.example");

    const foreign = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil.example" },
    });

    expect(foreign.statusCode).toBe(403);
    expect(foreign.json().error.code).toBe("origin_rejected");
    expect(foreign.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });

  it("keeps an empty allowlist closed", async () => {
    const app = await buildTestApp({ ...validEnv, APP_ORIGINS: "" });
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://nibie.example" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("origin_rejected");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });

  it("allows a request that has no origin header", async () => {
    const app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });
});
