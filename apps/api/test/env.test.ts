import { describe, expect, it } from "vitest";
import { readApiEnv } from "../src/plugins/env.js";
import { buildTestApp, validEnv } from "./fixture.js";

function serviceRoleJwt() {
  const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
}

describe("env", () => {
  it("fails boot when SUPABASE_URL is missing", async () => {
    const env: Record<string, string | undefined> = { ...validEnv };
    delete env.SUPABASE_URL;
    await expect(buildTestApp(env)).rejects.toThrow(/missing or invalid/i);
  });

  it("fails boot when SUPABASE_URL is invalid", async () => {
    await expect(buildTestApp({ ...validEnv, SUPABASE_URL: "not-a-url" })).rejects.toThrow(/missing or invalid/i);
  });

  it("fails boot when the publishable key is missing", async () => {
    const env: Record<string, string | undefined> = { ...validEnv };
    delete env.SUPABASE_PUBLISHABLE_KEY;
    await expect(buildTestApp(env)).rejects.toThrow(/missing or invalid/i);
  });

  it("fails boot when the publishable key is service-role material", async () => {
    await expect(buildTestApp({ ...validEnv, SUPABASE_PUBLISHABLE_KEY: "sb_secret_live" })).rejects.toThrow(/missing or invalid/i);
    await expect(buildTestApp({ ...validEnv, SUPABASE_PUBLISHABLE_KEY: serviceRoleJwt() })).rejects.toThrow(/missing or invalid/i);
  });

  it("does not copy unrelated runtime variables into API config", () => {
    const config = readApiEnv({
      ...validEnv,
      DATABASE_URL: "postgres://local/ignored",
      AI_API_KEY: "sk-test",
    });

    expect(config.SUPABASE_URL).toBe(validEnv.SUPABASE_URL);
    expect(JSON.stringify(config)).not.toContain("postgres://local/ignored");
    expect(JSON.stringify(config)).not.toContain("sk-test");
  });
});
