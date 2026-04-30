import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canManageItemMaster,
  canManageUsers,
  canRegisterInventoryTransaction,
  isUserRole,
  type UserRole,
} from "./roles";

export type CurrentUserRole = {
  readonly userId: string;
  readonly role: UserRole;
};

type AuthUserResult = {
  readonly data: {
    readonly user: { readonly id: string } | null;
  };
  readonly error: unknown;
};

type ProfileRoleResult = {
  readonly data: { readonly role: string } | null;
  readonly error: unknown;
};

export type CurrentUserRoleRepository = {
  readonly getCurrentUser: () => Promise<AuthUserResult>;
  readonly findProfileRoleByUserId: (
    userId: string,
  ) => Promise<ProfileRoleResult>;
};

export type RolePermission = (role: UserRole) => boolean;

const UNAUTHORIZED_MESSAGE = "この操作を実行する権限がありません。";

export async function createCurrentUserRoleRepository(): Promise<CurrentUserRoleRepository> {
  const supabase = await createClient();

  return {
    async getCurrentUser() {
      const { data, error } = await supabase.auth.getUser();

      return {
        data: {
          user: data.user === null ? null : { id: data.user.id },
        },
        error,
      };
    },
    async findProfileRoleByUserId(userId) {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      return { data, error };
    },
  };
}

export async function getCurrentUserRole(
  repository?: CurrentUserRoleRepository,
): Promise<CurrentUserRole | null> {
  const currentRepository =
    repository ?? (await createCurrentUserRoleRepository());
  const { data: authData, error: authError } =
    await currentRepository.getCurrentUser();

  if (authError !== null || authData.user === null) {
    return null;
  }

  const { data: profile, error: profileError } =
    await currentRepository.findProfileRoleByUserId(authData.user.id);

  if (
    profileError !== null ||
    profile === null ||
    !isUserRole(profile.role)
  ) {
    return null;
  }

  return {
    userId: authData.user.id,
    role: profile.role,
  };
}

export async function requireCurrentUserRole(
  repository?: CurrentUserRoleRepository,
): Promise<CurrentUserRole> {
  const currentUserRole = await getCurrentUserRole(repository);

  if (currentUserRole === null) {
    redirect("/login");
  }

  return currentUserRole;
}

export async function requirePagePermission(
  permission: RolePermission,
): Promise<CurrentUserRole> {
  const currentUserRole = await requireCurrentUserRole();

  if (!permission(currentUserRole.role)) {
    redirect("/");
  }

  return currentUserRole;
}

export async function hasActionPermission(
  permission: RolePermission,
  repository?: CurrentUserRoleRepository,
): Promise<boolean> {
  const currentUserRole = await getCurrentUserRole(repository);

  return currentUserRole !== null && permission(currentUserRole.role);
}

export async function hasInventoryTransactionPermission(
  repository?: CurrentUserRoleRepository,
): Promise<boolean> {
  return hasActionPermission(canRegisterInventoryTransaction, repository);
}

export async function hasItemMasterManagementPermission(
  repository?: CurrentUserRoleRepository,
): Promise<boolean> {
  return hasActionPermission(canManageItemMaster, repository);
}

export async function hasUserManagementPermission(
  repository?: CurrentUserRoleRepository,
): Promise<boolean> {
  return hasActionPermission(canManageUsers, repository);
}

export function getUnauthorizedMessage(): string {
  return UNAUTHORIZED_MESSAGE;
}

export {
  canManageItemMaster,
  canManageUsers,
  canRegisterInventoryTransaction,
};
