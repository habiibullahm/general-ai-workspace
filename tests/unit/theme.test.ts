import { describe, expect, it } from "vitest";
import { defaultThemePreference, parseThemePreference, resolveTheme, themeInitScript, themeStorageKey } from "../../lib/theme";

// Runs the exact inline script from <head> against fake browser globals and returns the data-theme it sets (null = untouched).
function runInitScript(options: { stored?: string | null; systemLight?: boolean; storageThrows?: boolean }) {
  const attributes = new Map<string, string>();
  const localStorage = { getItem: (key: string) => { if (options.storageThrows) throw new Error("blocked"); return key === themeStorageKey ? (options.stored ?? null) : null; } };
  const matchMedia = (query: string) => ({ matches: query.includes("light") && Boolean(options.systemLight) });
  const document = { documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) } };
  new Function("localStorage", "matchMedia", "document", themeInitScript)(localStorage, matchMedia, document);
  return attributes.get("data-theme") ?? null;
}

describe("theme preference", () => {
  it("defaults to dark and only accepts known values", () => {
    expect(defaultThemePreference).toBe("dark");
    expect(parseThemePreference(null)).toBe("dark");
    expect(parseThemePreference("")).toBe("dark");
    expect(parseThemePreference("blue")).toBe("dark");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("system")).toBe("system");
    expect(parseThemePreference("dark")).toBe("dark");
  });

  it("follows the device only for System, and stays dark when the device has no light preference", () => {
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
  });
});

describe("pre-paint theme script", () => {
  it("applies dark with nothing stored, even on a device that prefers light", () => {
    expect(runInitScript({ stored: null, systemLight: true })).toBe("dark");
  });

  it("applies the stored choice", () => {
    expect(runInitScript({ stored: "light" })).toBe("light");
    expect(runInitScript({ stored: "dark", systemLight: true })).toBe("dark");
  });

  it("resolves System from the device setting", () => {
    expect(runInitScript({ stored: "system", systemLight: true })).toBe("light");
    expect(runInitScript({ stored: "system", systemLight: false })).toBe("dark");
  });

  it("falls back to dark for an unknown stored value", () => {
    expect(runInitScript({ stored: "<script>" })).toBe("dark");
  });

  it("leaves the server-rendered dark default alone when storage is unavailable", () => {
    expect(runInitScript({ storageThrows: true })).toBeNull();
  });
});
