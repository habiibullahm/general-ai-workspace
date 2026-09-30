import { describe, expect, it } from "vitest";
import { credentialsSchema } from "../../lib/auth/validation";

describe("credentialsSchema", () => {
  it("normalizes email addresses and keeps the password exact", () => {
    expect(credentialsSchema.safeParse({ email: "  PERSON@example.test ", password: "  strong-pass-1  " })).toMatchObject({
      success: true,
      data: { email: "person@example.test", password: "  strong-pass-1  " },
    });
  });

  it("rejects malformed email addresses", () => {
    expect(credentialsSchema.safeParse({ email: "not-email", password: "strong-pass-1" }).success).toBe(false);
  });

  it("rejects passwords shorter than the minimum signup length", () => {
    expect(credentialsSchema.safeParse({ email: "person@example.test", password: "short" }).success).toBe(false);
  });
});
