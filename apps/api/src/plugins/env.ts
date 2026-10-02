import { z } from "zod";

const logLevels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const allowedKeys = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "APP_ORIGINS",
  "API_HOST",
  "API_PORT",
  "LOG_LEVEL",
] as const;

const apiEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  APP_ORIGINS: z.string().optional(),
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(logLevels).default("info"),
});

export type ApiConfig = z.infer<typeof apiEnvSchema> & {
  origins: readonly string[];
};

export class ApiEnvError extends Error {
  constructor() {
    super("API environment is missing or invalid.");
    this.name = "ApiEnvError";
  }
}

export function readApiEnv(source: Record<string, string | undefined>): ApiConfig {
  const picked: Record<string, string | undefined> = {};
  for (const key of allowedKeys) {
    if (source[key] !== undefined) picked[key] = source[key];
  }

  const parsed = apiEnvSchema.safeParse(picked);
  if (!parsed.success || isServiceRoleKey(parsed.data.SUPABASE_PUBLISHABLE_KEY)) {
    throw new ApiEnvError();
  }

  return {
    ...parsed.data,
    origins: parseOrigins(parsed.data.APP_ORIGINS),
  };
}

export function isServiceRoleKey(key: string) {
  if (key.startsWith("sb_secret_")) return true;

  const parts = key.split(".");
  if (parts.length !== 3) return false;
  const payload = parts[1];
  if (!payload) return false;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: unknown };
    return claims.role === "service_role";
  } catch {
    return false;
  }
}

function parseOrigins(value: string | undefined): string[] {
  if (!value?.trim()) return [];

  return value.split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    if (entry.includes("*")) throw new ApiEnvError();
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      throw new ApiEnvError();
    }
    if (entry !== url.origin) throw new ApiEnvError();
    return url.origin;
  });
}
