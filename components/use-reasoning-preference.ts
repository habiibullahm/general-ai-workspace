"use client";

import { useCallback, useSyncExternalStore } from "react";
import { reasoningEffortSchema, type ReasoningEffort } from "@/lib/chat/models";

// The reasoning level is a per-device preference (like the theme). It is kept separate from the model choice, which is saved per conversation.
export const reasoningStorageKey = "nibie-reasoning";
const changeEvent = "nibie-reasoning-change";
const defaultComposerReasoning: ReasoningEffort = "medium";

function read(): ReasoningEffort {
  try {
    const parsed = reasoningEffortSchema.safeParse(localStorage.getItem(reasoningStorageKey));
    // Legacy Auto has no explicit effort. Use the new UI default without overwriting stored preferences.
    return parsed.success && parsed.data !== "auto" ? parsed.data : defaultComposerReasoning;
  } catch { return defaultComposerReasoning; }
}
function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(changeEvent, notify); window.removeEventListener("storage", notify); };
}

export function useReasoningPreference() {
  // The stored value is read right after hydration; the server renders the Medium UI default.
  const value = useSyncExternalStore(subscribe, read, () => defaultComposerReasoning);
  const set = useCallback((next: ReasoningEffort) => {
    try { localStorage.setItem(reasoningStorageKey, next); } catch { /* the choice is simply not remembered */ }
    window.dispatchEvent(new Event(changeEvent));
  }, []);
  return [value, set] as const;
}
