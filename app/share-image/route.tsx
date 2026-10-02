import { nibieShareImage } from "@/lib/brand/share-image";

export const dynamic = "force-static";

export function GET() {
  return nibieShareImage();
}
