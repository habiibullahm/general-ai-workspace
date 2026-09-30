import { describe, expect, it } from "vitest";
import { getPublicAppUrl } from "../../lib/config/app-url";

describe("getPublicAppUrl", () => {
  it("uses localhost as a development fallback", () => {
    expect(getPublicAppUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
  });

  it("normalizes a configured application origin", () => {
    expect(getPublicAppUrl({ NEXT_PUBLIC_APP_URL: "https://workspace.example/" })).toBe("https://workspace.example");
  });

  it("requires a configured HTTPS origin in production", () => {
    expect(() => getPublicAppUrl({ NODE_ENV: "production" })).toThrow(/NEXT_PUBLIC_APP_URL/);
    expect(() => getPublicAppUrl({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "http://workspace.example" })).toThrow(/HTTPS/);
  });

  it("rejects malformed URLs", () => {
    expect(() => getPublicAppUrl({ NEXT_PUBLIC_APP_URL: "not-a-url" })).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
