import {
  defaultPreferenceResponse,
  preferenceModels,
  preferenceResponseSchema,
  preferredLanguages,
  responseLengths,
  responseStyles,
  type PreferencePatch,
  type PreferenceResponse,
} from "@nibie/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError } from "../plugins/error-handler.js";

const preferenceColumns = "preferred_name,preferred_language,default_model,response_length,response_style,about_you,created_at,updated_at";

const preferenceRowSchema = z.object({
  preferred_name: z.string().nullable(),
  preferred_language: z.enum(preferredLanguages),
  default_model: z.enum(preferenceModels),
  response_length: z.enum(responseLengths),
  response_style: z.enum(responseStyles),
  about_you: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

function throwForDatabaseError(error: { code?: string }): never {
  if (error.code === "42501") throw new ApiError(403, "forbidden", "Forbidden.");
  throw new ApiError(500, "internal_error", "Something went wrong.");
}

function fromRow(row: z.infer<typeof preferenceRowSchema>): PreferenceResponse {
  return preferenceResponseSchema.parse({
    preferredName: row.preferred_name,
    preferredLanguage: row.preferred_language,
    defaultModel: row.default_model,
    responseLength: row.response_length,
    responseStyle: row.response_style,
    aboutYou: row.about_you,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function toRow(userId: string, patch: PreferencePatch) {
  const row: Record<string, string | null> = { user_id: userId };
  if (patch.preferredName !== undefined) row.preferred_name = patch.preferredName;
  if (patch.preferredLanguage !== undefined) row.preferred_language = patch.preferredLanguage;
  if (patch.defaultModel !== undefined) row.default_model = patch.defaultModel;
  if (patch.responseLength !== undefined) row.response_length = patch.responseLength;
  if (patch.responseStyle !== undefined) row.response_style = patch.responseStyle;
  if (patch.aboutYou !== undefined) row.about_you = patch.aboutYou;
  return row;
}

export async function readPreferences(supabase: SupabaseClient): Promise<PreferenceResponse> {
  const { data, error } = await supabase.from("user_preferences").select(preferenceColumns).maybeSingle();
  if (error) throwForDatabaseError(error);
  if (!data) return defaultPreferenceResponse();

  const parsed = preferenceRowSchema.safeParse(data);
  if (!parsed.success) throw new ApiError(500, "internal_error", "Something went wrong.");
  return fromRow(parsed.data);
}

export async function updatePreferences(supabase: SupabaseClient, userId: string, patch: PreferencePatch): Promise<PreferenceResponse> {
  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(toRow(userId, patch), { onConflict: "user_id" })
    .select(preferenceColumns)
    .single();

  if (error) throwForDatabaseError(error);
  const parsed = preferenceRowSchema.safeParse(data);
  if (!parsed.success) throw new ApiError(500, "internal_error", "Something went wrong.");
  return fromRow(parsed.data);
}
