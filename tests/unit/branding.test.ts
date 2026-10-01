import { describe, expect, it } from "vitest";
import { brandAssets, getProductName, getWordmark } from "../../lib/config/branding";

describe("getProductName", () => {
  it("uses the configured public product name", () => {
    expect(getProductName({ NEXT_PUBLIC_APP_NAME: "  Nibie  " })).toBe("Nibie");
  });

  it("falls back to the approved product name when unset or blank", () => {
    expect(getProductName({})).toBe("Nibie");
    expect(getProductName({ NEXT_PUBLIC_APP_NAME: "  " })).toBe("Nibie");
  });
});

describe("brand slot", () => {
  it("sets the wordmark in lowercase from the product name", () => {
    expect(getWordmark({})).toBe("nibie");
    expect(getWordmark({ NEXT_PUBLIC_APP_NAME: "Nibie" })).toBe("nibie");
  });

  it("points the mark slot at the logo asset", () => {
    expect(brandAssets.mark).toBe("/brand/mark.svg");
  });
});
