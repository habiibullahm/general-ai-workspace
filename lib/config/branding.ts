export function getProductName(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return env.NEXT_PUBLIC_APP_NAME?.trim() || "Nibie";
}

// Drop-in slot for the final logo. Put the file in /public/brand and set its path here; until then the temporary "n" monogram is shown.
// The mark should be a square SVG that reads on both dark and light surfaces (see docs/BRAND.md for the full asset list).
export const brandAssets: { mark: string | null } = { mark: null };

// The wordmark is the product name in lowercase, set in the heading weight of the lockup.
export function getWordmark(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return getProductName(env).toLowerCase();
}
