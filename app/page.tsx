import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";
import { getPublicAppUrl } from "@/lib/config/app-url";
import { legacyConversationPath } from "@/lib/routes";
import "./landing.css";

const title = "Nibie — A quieter place to think with AI";
const description = "Nibie is a personal AI workspace for thinking, writing, coding, exploring ideas, and getting work done.";

// Dedicated Nibie Open Graph artwork is intentionally unset until a share image exists.
const landingShareImage: string | undefined = undefined;

function landingOrigin() {
  if (!process.env.NEXT_PUBLIC_APP_URL && process.env.NODE_ENV === "production") return undefined;
  return getPublicAppUrl();
}

const origin = landingOrigin();
const pageUrl = origin ? `${origin}/` : "/";

export const metadata: Metadata = {
  metadataBase: origin ? new URL(origin) : undefined,
  title: { absolute: title },
  description,
  alternates: { canonical: pageUrl },
  openGraph: {
    title,
    description,
    url: pageUrl,
    siteName: "Nibie",
    type: "website",
    ...(landingShareImage ? { images: [{ url: landingShareImage }] } : {}),
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    ...(landingShareImage ? { images: [landingShareImage] } : {}),
  },
};

export default async function HomePage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const params = await searchParams;
  const legacy = legacyConversationPath(params.conversation);
  if (legacy) redirect(legacy);
  return <LandingPage />;
}
