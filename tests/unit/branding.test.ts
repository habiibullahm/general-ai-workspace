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
  it("sets the wordmark with a capital first letter from the product name", () => {
    expect(getWordmark({})).toBe("Nibie");
    expect(getWordmark({ NEXT_PUBLIC_APP_NAME: "Nibie" })).toBe("Nibie");
    expect(getWordmark({ NEXT_PUBLIC_APP_NAME: "nIBIE" })).toBe("Nibie");
  });

  it("points the mark slot at the logo asset", () => {
    expect(brandAssets.mark).toBe("/brand/mark.svg");
  });
});
