import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { ChatWorkspace } from "@/components/chat-workspace";
import { getChatWorkspaceData } from "@/lib/chat/read";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const params = await searchParams;
  // Verifying the session and loading the owner's data are independent round trips, so they run together.
  // The data is only rendered when verification succeeds (otherwise the user is redirected), and RLS scopes every query.
  const [user, data] = await Promise.all([requireAuthenticatedUser(), getChatWorkspaceData(params.conversation)]);
  return <ChatWorkspace email={user.email ?? "Your account"} initialData={data} />;
}
