export function getProductName(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return env.NEXT_PUBLIC_APP_NAME?.trim() || "Nibie";
}
