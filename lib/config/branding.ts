export function getProductName(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return env.NEXT_PUBLIC_APP_NAME?.trim() || "Nibie";
}

// Square mark in /public/brand. The in-app component redraws it so the ribbon can follow the theme.
export const brandAssets: { mark: string | null } = { mark: "/brand/mark.svg" };

// The wordmark is the product name in lowercase, set in the heading weight of the lockup.
export function getWordmark(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return getProductName(env).toLowerCase();
}
