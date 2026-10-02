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

// Google must return to the host that started sign-in, or the preview session cookie never matches the callback.
// Only this deployment's own URLs are allowed. A request Host header cannot choose an arbitrary origin.
export function oauthCallbackOrigin(requestUrl: string, env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  let requestOrigin: string | null = null;
  try {
    const parsed = new URL(requestUrl);
    if (parsed.protocol === "https:" || (env.NODE_ENV !== "production" && parsed.protocol === "http:" && parsed.hostname === "localhost")) {
      requestOrigin = parsed.origin;
    }
  } catch {
    requestOrigin = null;
  }

  const allowed = new Set<string>();
  try {
    allowed.add(getPublicAppUrl(env));
  } catch {
    // Production without a configured URL still accepts this deployment's own host below.
  }
  for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (typeof host === "string" && host && !host.includes("://")) allowed.add(`https://${host}`);
  }
  if (env.NODE_ENV !== "production") allowed.add("http://localhost:3000");
  if (requestOrigin && allowed.has(requestOrigin)) return requestOrigin;
  return getPublicAppUrl(env);
}
