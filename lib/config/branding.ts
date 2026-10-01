export function getProductName(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return env.NEXT_PUBLIC_APP_NAME?.trim() || "Nibie";
}

// Static file for the mark. The in-app lockup draws the same artwork inline so it follows data-theme.
export const brandAssets: { mark: string | null } = { mark: "/brand/mark.svg" };

// The wordmark is the product name in lowercase, set in the heading weight of the lockup.
export function getWordmark(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return getProductName(env).toLowerCase();
}
