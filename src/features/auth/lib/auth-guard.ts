type ActionError = {
  readonly message: string;
  readonly status?: number;
};

type CurrentUserResult = {
  readonly data: {
    readonly user: { readonly id: string } | null;
  };
  readonly error: ActionError | null;
};

type MaybeSingleResult = {
  readonly data: { readonly id: string } | null;
  readonly error: ActionError | null;
};

export type AuthGuardRepository = {
  readonly getCurrentUser: () => Promise<CurrentUserResult>;
  readonly findUserProfileByUserId: (
    userId: string,
  ) => Promise<MaybeSingleResult>;
};

export async function hasAuthenticatedUser(
  repository: AuthGuardRepository,
): Promise<boolean> {
  const { data: authData, error: authError } = await repository.getCurrentUser();

  if (authError !== null) {
    console.error(authError);
    return false;
  }

  if (authData.user === null) {
    return false;
  }

  const { data: profile, error: profileLookupError } =
    await repository.findUserProfileByUserId(authData.user.id);

  if (profileLookupError !== null) {
    console.error(profileLookupError);
    return false;
  }

  return profile !== null;
}
