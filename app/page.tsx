import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";
import { legacyConversationPath } from "@/lib/routes";
import "./landing.css";

export const metadata: Metadata = {
  description: "Nibie is your personal AI workspace for thinking, writing, coding, exploring ideas, and getting work done.",
};

export default async function HomePage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const params = await searchParams;
  const legacy = legacyConversationPath(params.conversation);
  if (legacy) redirect(legacy);
  return <LandingPage />;
}
