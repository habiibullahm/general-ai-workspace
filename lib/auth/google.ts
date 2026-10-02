import { oauthCallbackOrigin } from "@/lib/config/app-url";
import { getSupabasePublicConfig } from "@/lib/config/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function allowedOAuthUrl(value: string, supabaseUrl: string) {
  try {
    const target = new URL(value);
    const allowed = new URL(supabaseUrl);
    if (target.origin !== allowed.origin || !target.pathname.startsWith("/auth/v1/")) return null;
    return target.toString();
  } catch {
    return null;
  }
}

// Called from a route handler so the PKCE verifier cookie is on the redirect to Google.
export async function createGoogleOAuthUrl(requestUrl: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/auth/callback", oauthCallbackOrigin(requestUrl)).toString(),
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) return null;
  return allowedOAuthUrl(data.url, getSupabasePublicConfig().url);
}
