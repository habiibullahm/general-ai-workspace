import { notFound } from "next/navigation";
import { ChatWorkspace } from "@/components/chat-workspace";

export const dynamic = "force-dynamic";

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ChatWorkspace email="preview@nibie.local" />;
}
