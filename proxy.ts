import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig, hasSupabasePublicConfig } from "@/lib/config/supabase";
import { legacyConversationPath } from "@/lib/routes";

export async function proxy(request: NextRequest) {
  // Old bookmarks used /?conversation=<uuid>. Redirect before rendering so the landing page can stay static.
  if (request.nextUrl.pathname === "/") {
    const legacy = legacyConversationPath(request.nextUrl.searchParams.get("conversation"));
    if (legacy) return NextResponse.redirect(new URL(legacy, request.url));
  }

  if (!hasSupabasePublicConfig()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-icon|share-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
