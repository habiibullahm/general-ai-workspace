// Theme preference: dark by default, light on request, or follow the system. Stored per device so it applies before first paint.
export const themeStorageKey = "nibie-theme";
export const themePreferences = ["dark", "light", "system"] as const;
export type ThemePreference = (typeof themePreferences)[number];
export type ResolvedTheme = "dark" | "light";
export const defaultThemePreference: ThemePreference = "dark";

export function parseThemePreference(value: unknown): ThemePreference {
  return themePreferences.find((preference) => preference === value) ?? defaultThemePreference;
}

// "System" only switches to light when the device explicitly prefers it; otherwise Nibie stays dark.
export function resolveTheme(preference: ThemePreference, systemPrefersLight: boolean): ResolvedTheme {
  return preference === "system" ? (systemPrefersLight ? "light" : "dark") : preference;
}

// Runs synchronously in <head> (see app/layout.tsx) so the right theme is set before anything paints. It must stay self-contained.
export const themeInitScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(themeStorageKey)});if(p!=="light"&&p!=="system")p="dark";var t=p==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
