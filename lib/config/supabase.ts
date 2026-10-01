import { z } from "zod";

const publicSupabaseConfigSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  })
  .refine(
    (config) => Boolean(config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? config.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    "A public Supabase key is required",
  )
  .refine(
    (config) => !isServiceRoleKey(config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? config.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
    "A public Supabase key is required; secret keys must not be used here",
  );

function isServiceRoleKey(key: string) {
  if (key.startsWith("sb_secret_")) return true;

  const payload = key.split(".")[1];
  if (!payload) return false;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: unknown };
    return claims.role === "service_role";
  } catch {
    return false;
  }
}

export function hasSupabasePublicConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return publicSupabaseConfigSchema.safeParse(env).success;
}

export function getSupabasePublicConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  const parsed = publicSupabaseConfigSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(
      "Supabase configuration is missing or invalid. Set NEXT_PUBLIC_SUPABASE_URL and a public NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY; never use a secret/service-role key.",
    );
  }

  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  };
}
