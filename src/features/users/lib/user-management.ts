import { isUserRole } from "@/features/auth/lib/roles";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ManagedUser } from "../types/user-management";

type UserProfileRow = {
  readonly id: string;
  readonly username: string;
  readonly role: string;
};

export const USERS_PER_PAGE = 50;

export async function fetchManagedUsers(page: number): Promise<readonly ManagedUser[]> {
  const supabase = createServiceRoleClient();
  const safePage = Math.max(1, Math.trunc(page));
  const { data: authData, error: authError } =
    await supabase.auth.admin.listUsers({
      page: safePage,
      perPage: USERS_PER_PAGE,
    });

  if (authError !== null) {
    throw authError;
  }

  const userIds = authData.users.map((user) => user.id);

  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("id, username, role")
    .in("id", userIds);

  if (profilesError !== null) {
    throw profilesError;
  }

  const profilesById = new Map(
    ((profiles ?? []) as readonly UserProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );

  return authData.users.flatMap((user) => {
    const profile = profilesById.get(user.id);

    if (profile === undefined || !isUserRole(profile.role)) {
      return [];
    }

    return [
      {
        id: user.id,
        username: profile.username,
        email: user.email ?? "",
        role: profile.role,
      },
    ];
  });
}
