export function getPublicAppUrl(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  const configuredUrl = env.NEXT_PUBLIC_APP_URL;
  const value = configuredUrl ?? (env.NODE_ENV === "production" ? undefined : "http://localhost:3000");

  if (!value) {
    throw new Error("NEXT_PUBLIC_APP_URL must be set in production.");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid HTTP(S) origin.");
  }

  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid HTTP(S) origin without credentials.");
  }
  if (env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  }

  return parsed.origin;
}
