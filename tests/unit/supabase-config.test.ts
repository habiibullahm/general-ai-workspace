import { describe, expect, it } from "vitest";
import { getSupabasePublicConfig, hasSupabasePublicConfig } from "../../lib/config/supabase";

describe("getSupabasePublicConfig", () => {
  const validConfig = {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-anon-key",
  };

  it("accepts a valid project URL and publishable key", () => {
    expect(getSupabasePublicConfig(validConfig)).toEqual({
      url: "https://project.supabase.co",
      publishableKey: "public-anon-key",
    });
  });

  it("accepts the legacy public anon-key variable for existing Supabase projects", () => {
    expect(
      getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
      }),
    ).toEqual({ url: "https://project.supabase.co", publishableKey: "public-anon-key" });
  });

  it("rejects service-role credentials even if placed in a public-key variable", () => {
    const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
    expect(() =>
      getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `header.${payload}.signature`,
      }),
    ).toThrow(/public/);
  });

  it("fails closed when either public Supabase setting is missing", () => {
    expect(() => getSupabasePublicConfig({})).toThrow(/Supabase/);
    expect(() =>
      getSupabasePublicConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" }),
    ).toThrow(/Supabase/);
  });

  it("rejects malformed project URLs", () => {
    expect(() =>
      getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-anon-key",
      }),
    ).toThrow(/Supabase/);
  });

  it("reports whether configuration is complete without exposing values", () => {
    expect(hasSupabasePublicConfig(validConfig)).toBe(true);
    expect(hasSupabasePublicConfig({})).toBe(false);
  });
});
