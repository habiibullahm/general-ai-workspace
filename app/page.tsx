import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { ChatWorkspace } from "@/components/chat-workspace";
import { getChatWorkspaceData } from "@/lib/chat/read";
import { getModelOptions } from "@/lib/ai/registry";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const params = await searchParams;
  // Verifying the session and loading the owner's data are independent round trips, so they run together.
  // The data is only rendered when verification succeeds (otherwise the user is redirected), and RLS scopes every query.
  const [user, data] = await Promise.all([requireAuthenticatedUser(), getChatWorkspaceData(params.conversation)]);
  // Only configured modes are offered; this reads environment variable names, never the provider URL or key.
  const { models, reasoningModes } = getModelOptions();
  return <ChatWorkspace email={user.email ?? "Your account"} initialData={data} models={models} reasoningModes={reasoningModes} />;
}
