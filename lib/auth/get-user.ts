export type AuthenticatedUser = { id: string };

export type UserVerificationClient<TUser extends AuthenticatedUser = AuthenticatedUser> = {
  auth: {
    getUser: () => Promise<{
      data: { user: TUser | null };
      error: unknown | null;
    }>;
  };
};

export async function getAuthenticatedUser<TUser extends AuthenticatedUser>(
  client: UserVerificationClient<TUser>,
): Promise<TUser | null> {
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}
