"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserRole } from "@/features/auth/lib/server-permissions";
import { USER_ROLES } from "@/features/auth/lib/roles";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type UpdateUserRoleResult =
  | {
      readonly success: true;
      readonly userId: string;
    }
  | {
      readonly success: false;
      readonly message: string;
    };

type UpdateUserRoleDependencies = {
  readonly getActor?: typeof getCurrentUserRole;
  readonly createClient?: typeof createServiceRoleClient;
  readonly revalidate?: typeof revalidatePath;
};

const updateUserRoleSchema = z.object({
  targetUserId: z.uuid("ユーザーIDが不正です。"),
  role: z.enum(USER_ROLES, "権限が不正です。"),
});

function toUpdateUserRoleErrorMessage(message: string): string {
  if (message.includes("permission denied")) {
    return "この操作を実行する権限がありません。";
  }

  if (message.includes("last admin cannot be demoted")) {
    return "最後の管理者は他の権限へ変更できません。";
  }

  if (message.includes("target user not found")) {
    return "対象ユーザーが見つかりません。";
  }

  if (message.includes("invalid role")) {
    return "権限が不正です。";
  }

  return "権限変更に失敗しました。";
}

export async function updateUserRole(
  input: FormData | { readonly targetUserId: string; readonly role: string },
  dependencies: UpdateUserRoleDependencies = {},
): Promise<UpdateUserRoleResult> {
  try {
    const values =
      input instanceof FormData
        ? {
            targetUserId: String(input.get("targetUserId") ?? ""),
            role: String(input.get("role") ?? ""),
          }
        : input;
    const parsedInput = updateUserRoleSchema.safeParse(values);

    if (!parsedInput.success) {
      return {
        success: false,
        message:
          parsedInput.error.issues[0]?.message ?? "入力内容を確認してください。",
      };
    }

    const getActor = dependencies.getActor ?? getCurrentUserRole;
    const actor = await getActor();

    if (actor === null || actor.role !== "admin") {
      return {
        success: false,
        message: "この操作を実行する権限がありません。",
      };
    }

    const createClient =
      dependencies.createClient ?? createServiceRoleClient;
    const revalidate = dependencies.revalidate ?? revalidatePath;
    const supabase = createClient();
    const { targetUserId, role } = parsedInput.data;
    const { data, error } = await supabase.rpc("update_user_profile_role", {
      p_target_user_id: targetUserId,
      p_new_role: role,
      p_actor_user_id: actor.userId,
    });

    if (error !== null) {
      console.error(error);

      return {
        success: false,
        message: toUpdateUserRoleErrorMessage(error.message),
      };
    }

    revalidate("/users");
    revalidate("/", "layout");

    return {
      success: true,
      userId: data,
    };
  } catch (error) {
    console.error(error);

    return {
      success: false,
      message: "権限変更に失敗しました。",
    };
  }
}
