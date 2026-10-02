import { getWordmark } from "@/lib/config/branding";

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export const shareImagePath = "/share-image";
export const shareImageSize = { width: 1200, height: 630 };
export const shareImageContentType = "image/png";

export function shareImageAlt(env?: Env) {
  return `${getWordmark(env)}, a quieter place to think with AI`;
}
