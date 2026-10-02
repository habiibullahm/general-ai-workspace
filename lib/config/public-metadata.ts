import { shareImageAlt, shareImagePath, shareImageSize } from "@/lib/brand/share-image-meta";
import { getPublicAppUrl } from "@/lib/config/app-url";

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

// Production metadata must not invent an origin. Development can use the local app URL.
export function getPublicMetadataOrigin(env: Env = process.env) {
  if (!env.NEXT_PUBLIC_APP_URL && env.NODE_ENV === "production") return undefined;
  return getPublicAppUrl(env);
}

export function absolutePublicUrl(path: string, env: Env = process.env) {
  const origin = getPublicMetadataOrigin(env);
  if (!origin) return undefined;
  return new URL(path, `${origin}/`).href;
}

export function publicMetadataBase(env: Env = process.env) {
  const origin = getPublicMetadataOrigin(env);
  return origin ? new URL(origin) : undefined;
}

// Absolute share image, only when the public origin is known. Otherwise Next would bake in localhost.
export function publicShareImage(env: Env = process.env) {
  const url = absolutePublicUrl(shareImagePath, env);
  if (!url) return undefined;
  return { url, width: shareImageSize.width, height: shareImageSize.height, alt: shareImageAlt(env) };
}
