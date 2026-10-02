import { redirect } from "next/navigation";
import { chatPath } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error")) redirect("/login?error=oauth");
  if (!code) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) redirect("/login?error=oauth");
  redirect(chatPath);
}
