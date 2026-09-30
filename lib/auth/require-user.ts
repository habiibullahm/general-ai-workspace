import "server-only";
import { redirect } from "next/navigation";
import { hasSupabasePublicConfig } from "@/lib/config/supabase";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAuthenticatedUser() {
  if (!hasSupabasePublicConfig()) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    redirect("/login");
  }

  return user;
}
