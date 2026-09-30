import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { ChatWorkspace } from "@/components/chat-workspace";
import { getChatWorkspaceData } from "@/lib/chat/read";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const user = await requireAuthenticatedUser();
  const params = await searchParams;
  const data = await getChatWorkspaceData(params.conversation);
  return <ChatWorkspace email={user.email ?? "Your account"} initialData={data} />;
}
