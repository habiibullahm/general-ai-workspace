import { z } from "zod";

// Settings V1 account preferences. Stored values stay lowercase. Chat modes stay PascalCase elsewhere.
export const preferredLanguages = ["auto", "en", "id"] as const;
export const preferenceModels = ["fast", "balanced", "reasoning"] as const;
export const responseLengths = ["concise", "balanced", "detailed"] as const;
export const responseStyles = ["natural", "professional", "direct"] as const;

export const preferredNameLimit = 80;
export const aboutYouLimit = 1500;

const nameControls = /[\u0000-\u001F\u007F]/;
const aboutControls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const preferredNameSchema = z.string().trim().min(1).max(preferredNameLimit).refine((value) => !nameControls.test(value));
const aboutYouSchema = z.string().trim().min(1).max(aboutYouLimit).refine((value) => !aboutControls.test(value));

export const preferenceResponseSchema = z.object({
  preferredName: z.string().nullable(),
  preferredLanguage: z.enum(preferredLanguages),
  defaultModel: z.enum(preferenceModels),
  responseLength: z.enum(responseLengths),
  responseStyle: z.enum(responseStyles),
  aboutYou: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const preferencePatchSchema = z.object({
  preferredName: z.union([z.null(), preferredNameSchema]).optional(),
  preferredLanguage: z.enum(preferredLanguages).optional(),
  defaultModel: z.enum(preferenceModels).optional(),
  responseLength: z.enum(responseLengths).optional(),
  responseStyle: z.enum(responseStyles).optional(),
  aboutYou: z.union([z.null(), aboutYouSchema]).optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0);

export type PreferenceResponse = z.infer<typeof preferenceResponseSchema>;
export type PreferencePatch = z.infer<typeof preferencePatchSchema>;

export function defaultPreferenceResponse(): PreferenceResponse {
  return {
    preferredName: null,
    preferredLanguage: "auto",
    defaultModel: "balanced",
    responseLength: "balanced",
    responseStyle: "natural",
    aboutYou: null,
    createdAt: null,
    updatedAt: null,
  };
}

// A blank name or note clears the field. Unknown keys are left untouched so strict validation still rejects them.
export function normalizePreferencePatch(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const patch = { ...(input as Record<string, unknown>) };
  for (const key of ["preferredName", "aboutYou"]) {
    if (typeof patch[key] === "string" && patch[key].trim() === "") patch[key] = null;
  }
  return patch;
}

export function parsePreferencePatch(input: unknown): { data: PreferencePatch } | { error: string } {
  const parsed = preferencePatchSchema.safeParse(normalizePreferencePatch(input));
  if (!parsed.success) return { error: preferenceValidationMessage(parsed.error) };
  return { data: parsed.data };
}

function preferenceValidationMessage(error: z.ZodError): string {
  const field = error.issues[0]?.path[0];
  if (field === "preferredName") return "Preferred name must be 80 characters or fewer, with no line breaks.";
  if (field === "aboutYou") return "About you must be 1,500 characters or fewer.";
  return "Choose a valid preference.";
}
