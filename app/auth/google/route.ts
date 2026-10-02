import { redirect } from "next/navigation";
import { createGoogleOAuthUrl } from "@/lib/auth/google";

export async function GET(request: Request) {
  let url: string | null = null;
  try {
    url = await createGoogleOAuthUrl(request.url);
  } catch {
    redirect("/login?error=oauth");
  }
  if (!url) redirect("/login?error=oauth");
  redirect(url);
}
