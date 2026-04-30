export const USER_ROLES = ["admin", "manager", "general"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "管理者",
  manager: "MG",
  general: "一般",
};

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.some((role) => role === value);
}

export function canRegisterInventoryTransaction(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canViewItemMaster(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canManageItemMaster(role: UserRole): boolean {
  return role === "admin";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "admin";
}
