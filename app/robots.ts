import type { MetadataRoute } from "next";
import { absolutePublicUrl } from "@/lib/config/public-metadata";

export default function robots(): MetadataRoute.Robots {
  const sitemap = absolutePublicUrl("/sitemap.xml");
  return {
    rules: { userAgent: "*", allow: "/" },
    ...(sitemap ? { sitemap } : {}),
  };
}
