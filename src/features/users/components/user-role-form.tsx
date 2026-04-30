"use client";

import { useActionState } from "react";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/features/auth/lib/roles";
import {
  updateUserRole,
  type UpdateUserRoleResult,
} from "../actions/update-user-role";

type UserRoleFormProps = {
  readonly userId: string;
  readonly currentRole: UserRole;
};

const INITIAL_STATE: UpdateUserRoleResult | null = null;

async function updateUserRoleAction(
  _previousState: UpdateUserRoleResult | null,
  formData: FormData,
): Promise<UpdateUserRoleResult> {
  return updateUserRole(formData);
}

export function UserRoleForm({ userId, currentRole }: UserRoleFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateUserRoleAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex min-w-56 flex-col gap-2">
      <input name="targetUserId" type="hidden" value={userId} />
      <div className="flex items-center justify-end gap-2">
        <select
          className="h-9 border border-zinc-300 bg-white px-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100"
          defaultValue={currentRole}
          disabled={isPending}
          name="role"
        >
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <button
          className="inline-flex h-9 items-center justify-center bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={isPending}
          type="submit"
        >
          変更
        </button>
      </div>
      {state !== null ? (
        <p
          className={
            state.success
              ? "text-right text-xs text-emerald-700"
              : "text-right text-xs text-red-600"
          }
          role={state.success ? undefined : "alert"}
        >
          {state.success ? "権限を変更しました。" : state.message}
        </p>
      ) : null}
    </form>
  );
}
