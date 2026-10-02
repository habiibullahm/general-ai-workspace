import { describe, expect, it } from "vitest";
import { buildTestApp, expectUuid } from "./fixture.js";

describe("errors", () => {
  it("returns a not_found envelope for an unknown route", async () => {
    const app = await buildTestApp();
    const requestId = "6f1c2b4e-8a0d-4e2b-9c1a-0b7e5d3a1f20";
    const response = await app.inject({
      method: "GET",
      url: "/v1/missing",
      headers: { "x-request-id": requestId },
    });
    const body = response.json() as { error: { code: string; message: string; requestId: string } };

    expect(response.statusCode).toBe(404);
    expect(body).toEqual({
      error: {
        code: "not_found",
        message: "Not found.",
        requestId,
      },
    });
    expect(response.headers["x-request-id"]).toBe(requestId);
    expect(JSON.stringify(body)).not.toMatch(/stack|sql|token|cookie|secret/i);
    expect(Object.keys(body.error).sort()).toEqual(["code", "message", "requestId"]);
    await app.close();
  });

  it("replaces an invalid request id", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/missing",
      headers: { "x-request-id": "not-a-uuid" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["x-request-id"]).not.toBe("not-a-uuid");
    expectUuid(response.headers["x-request-id"]);
    expect(response.json().error.requestId).toBe(response.headers["x-request-id"]);
    await app.close();
  });
});
