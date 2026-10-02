import { expect } from "vitest";
import { buildApp, type BuildAppOptions } from "../src/app.js";

export const validEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  LOG_LEVEL: "silent",
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function expectUuid(value: unknown) {
  expect(typeof value).toBe("string");
  expect(uuidPattern.test(String(value))).toBe(true);
}

export function buildTestApp(
  env: Record<string, string | undefined> = validEnv,
  verifyToken?: BuildAppOptions["verifyToken"],
  extra?: Pick<BuildAppOptions, "logStream">,
) {
  return buildApp({ env, verifyToken, ...extra });
}
