import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) redirect("/login");
  redirect("/");
}
