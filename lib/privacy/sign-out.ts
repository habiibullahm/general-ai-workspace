// supabase.auth.signOut defaults to this scope: every refresh token for the account is revoked, on every device.
// The server action passes it explicitly so a later SDK default cannot silently narrow the session.
export const SIGN_OUT_SCOPE = "global" as const;

export const SIGN_OUT_LABEL = "Sign out everywhere";

export const SIGN_OUT_DESCRIPTION =
  "This ends your Nibie session on every device where you are signed in. It does not delete your account or your conversations.";
