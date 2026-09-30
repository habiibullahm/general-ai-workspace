import { describe, expect, it } from "vitest";
import { getProductName } from "../../lib/config/branding";

describe("getProductName", () => {
  it("uses the configured public product name", () => {
    expect(getProductName({ NEXT_PUBLIC_APP_NAME: "  Nibie  " })).toBe("Nibie");
  });

  it("falls back to the approved product name when unset or blank", () => {
    expect(getProductName({})).toBe("Nibie");
    expect(getProductName({ NEXT_PUBLIC_APP_NAME: "  " })).toBe("Nibie");
  });
});
