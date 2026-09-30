import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { ChatWorkspace } from "@/components/chat-workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireAuthenticatedUser();
  return <ChatWorkspace email={user.email ?? "Your account"} />;
}
