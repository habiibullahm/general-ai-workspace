"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPublicAppUrl } from "@/lib/config/app-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { credentialsSchema, type AuthActionState } from "@/lib/auth/validation";

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
  redirect("/");
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
  redirect("/");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
