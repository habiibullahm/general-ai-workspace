"use server";

import { readOwnerPreferences, writeOwnerPreferences, type PreferencesResult } from "@/lib/preferences/store";

export type { PreferencesResult };

export async function getPreferencesAction(): Promise<PreferencesResult> {
  return readOwnerPreferences();
}

export async function updatePreferencesAction(patch: unknown): Promise<PreferencesResult> {
  return writeOwnerPreferences(patch);
}
