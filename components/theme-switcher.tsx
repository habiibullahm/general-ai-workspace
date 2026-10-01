"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { defaultThemePreference, parseThemePreference, resolveTheme, themeStorageKey, type ThemePreference } from "@/lib/theme";

const changeEvent = "nibie-theme-change";
const lightQuery = "(prefers-color-scheme: light)";
const options: { value: ThemePreference; label: string; Icon: typeof Moon }[] = [
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
];

function readPreference(): ThemePreference {
  try { return parseThemePreference(localStorage.getItem(themeStorageKey)); } catch { return defaultThemePreference; }
}
function apply(preference: ThemePreference) {
  document.documentElement.setAttribute("data-theme", resolveTheme(preference, matchMedia(lightQuery).matches));
}
function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(changeEvent, notify); window.removeEventListener("storage", notify); };
}

export function ThemeSwitcher() {
  // The server (and the first client render) assume the default; the real value is read right after hydration.
  const preference = useSyncExternalStore(subscribe, readPreference, () => defaultThemePreference);

  // Keeps the page in sync with the stored choice (also after React's dev remount, which clears attributes set by the inline script),
  // and follows the device setting while "System" is selected.
  useEffect(() => {
    apply(preference);
    if (preference !== "system") return;
    const query = matchMedia(lightQuery);
    const onChange = () => apply("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  function choose(next: ThemePreference) {
    try { localStorage.setItem(themeStorageKey, next); } catch { /* the choice still applies for this visit */ }
    apply(next);
    window.dispatchEvent(new Event(changeEvent));
  }

  return <div className="theme-switcher" role="group" aria-label="Theme">
    {options.map(({ value, label, Icon }) => <button key={value} type="button" aria-label={`${label} theme`} title={`${label} theme`} aria-pressed={preference === value} onClick={() => choose(value)}><Icon size={14} aria-hidden="true" /></button>)}
  </div>;
}
