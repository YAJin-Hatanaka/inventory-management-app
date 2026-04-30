import type { UserRole } from "@/features/auth/lib/roles";

export type ManagedUser = {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly role: UserRole;
};
