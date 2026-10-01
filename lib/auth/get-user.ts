export type AuthenticatedUser = { id: string; email?: string };

// The slice of the Supabase auth client this helper needs (getClaims verifies the access token's signature and expiry locally).
export type ClaimsClient = {
  auth: {
    getClaims: () => Promise<{
      data: { claims: { sub?: string; email?: unknown } } | null;
      error: unknown | null;
    }>;
  };
};

// Identifies the signed-in user from the verified access token, without a round trip to Supabase Auth.
// This is the same token PostgREST validates for row-level security, so every data read and write is still scoped to its owner;
// the difference from getUser() is that a session revoked server-side stays valid until its (short-lived) token expires.
export async function getAuthenticatedUser(client: ClaimsClient): Promise<AuthenticatedUser | null> {
  let result: Awaited<ReturnType<ClaimsClient["auth"]["getClaims"]>>;
  // getClaims() can throw (for example when the signing keys cannot be fetched); that must fail closed, never pass as signed in.
  try { result = await client.auth.getClaims(); } catch { return null; }
  const id = result.data?.claims.sub;
  if (result.error || typeof id !== "string" || !id) return null;
  const email = result.data?.claims.email;
  return { id, email: typeof email === "string" ? email : undefined };
}
