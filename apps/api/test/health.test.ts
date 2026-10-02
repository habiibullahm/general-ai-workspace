import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, expectUuid, validEnv } from "./fixture.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("health", () => {
  it("returns ok for /health and /v1/health without external I/O", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", (input: unknown) => {
      calls.push(String(input));
      throw new Error("health must not call the network");
    });

    const app = await buildTestApp(validEnv);
    await app.inject({ method: "GET", url: "/health" });
    const samples: number[] = [];

    for (const url of ["/health", "/v1/health", "/health", "/v1/health", "/health"] as const) {
      const started = performance.now();
      const response = await app.inject({ method: "GET", url });
      samples.push(performance.now() - started);

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.json()).toEqual({ status: "ok" });
      expectUuid(response.headers["x-request-id"]);
    }

    samples.sort((left, right) => left - right);
    const median = samples[Math.floor(samples.length / 2)] ?? samples[0];
    expect(median).toBeLessThan(20);
    expect(calls).toEqual([]);
    await app.close();
  });

  it("preserves a valid request id", async () => {
    const app = await buildTestApp();
    const requestId = "6f1c2b4e-8a0d-4e2b-9c1a-0b7e5d3a1f20";
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": requestId },
    });

    expect(response.headers["x-request-id"]).toBe(requestId);
    await app.close();
  });
});
