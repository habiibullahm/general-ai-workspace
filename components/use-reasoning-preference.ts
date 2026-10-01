"use client";

import { useCallback, useSyncExternalStore } from "react";
import { defaultReasoningEffort, reasoningEffortSchema, type ReasoningEffort } from "@/lib/chat/models";

// The reasoning level is a per-device preference (like the theme). It is kept separate from the model choice, which is saved per conversation.
export const reasoningStorageKey = "nibie-reasoning";
const changeEvent = "nibie-reasoning-change";

function read(): ReasoningEffort {
  try {
    const parsed = reasoningEffortSchema.safeParse(localStorage.getItem(reasoningStorageKey));
    return parsed.success ? parsed.data : defaultReasoningEffort;
  } catch { return defaultReasoningEffort; }
}
function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(changeEvent, notify); window.removeEventListener("storage", notify); };
}

export function useReasoningPreference() {
  // The server render assumes Auto; the stored value is read right after hydration, so there is no mismatch.
  const value = useSyncExternalStore(subscribe, read, () => defaultReasoningEffort);
  const set = useCallback((next: ReasoningEffort) => {
    try { localStorage.setItem(reasoningStorageKey, next); } catch { /* the choice is simply not remembered */ }
    window.dispatchEvent(new Event(changeEvent));
  }, []);
  return [value, set] as const;
}
