"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getPublicAppUrl } from "@/lib/config/app-url";
import { createGoogleOAuthUrl } from "@/lib/auth/google";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { credentialsSchema, type AuthActionState } from "@/lib/auth/validation";
import { SIGN_OUT_SCOPE } from "@/lib/privacy/sign-out";
import { chatPath } from "@/lib/routes";

function readCredentials(formData: FormData) {
  const result = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  return result.success ? result.data : null;
}

export async function signInAction(
  _previousState: AuthActionState | null,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = readCredentials(formData);
  if (!credentials) return { error: "Enter a valid email and password (at least 8 characters)." };

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) return { error: "Email or password is incorrect." };
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again later." };
  }

  revalidatePath("/", "layout");
  redirect(chatPath);
}

export async function signInWithGoogleAction(
  _previousState: AuthActionState | null,
  formData: FormData,
): Promise<AuthActionState> {
  if (!(formData instanceof FormData)) return { error: "Google sign-in is temporarily unavailable. Please try again later." };

  let redirectUrl: string | null = null;

  try {
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    const proto = headerStore.get("x-forwarded-proto") ?? "https";
    const requestUrl = host ? `${proto}://${host}/auth/google` : getPublicAppUrl();
    const url = await createGoogleOAuthUrl(requestUrl);
    if (!url) return { error: "Google sign-in is temporarily unavailable. Please try again later." };
    redirectUrl = url;
  } catch {
    return { error: "Google sign-in is temporarily unavailable. Please try again later." };
  }

  redirect(redirectUrl);
}

export async function signUpAction(
  _previousState: AuthActionState | null,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = readCredentials(formData);
  if (!credentials) return { error: "Enter a valid email and password (at least 8 characters)." };

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      ...credentials,
      options: { emailRedirectTo: new URL("/auth/callback", getPublicAppUrl()).toString() },
    });
    if (error) return { error: "Unable to create an account with those details." };
    if (!data.session) {
      return { message: "If registration succeeded, check your email for a confirmation link." };
    }
  } catch {
    return { error: "Sign-up is temporarily unavailable. Please try again later." };
  }

  revalidatePath("/", "layout");
  redirect(chatPath);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  // Global scope revokes every session for this account. Do not narrow it to this device without an explicit product decision.
  await supabase.auth.signOut({ scope: SIGN_OUT_SCOPE });
  revalidatePath("/", "layout");
  redirect("/login");
}
