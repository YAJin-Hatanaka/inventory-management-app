import { revalidatePath } from "next/cache";
import {
  getUnauthorizedMessage,
  hasItemMasterManagementPermission,
} from "@/features/auth/lib/server-permissions";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type ItemMasterActionResult =
  | {
      readonly success: true;
      readonly itemId: string;
    }
  | {
      readonly success: false;
      readonly message: string;
    };

export type ItemMasterActionDependencies = {
  readonly createClient?: typeof createServiceRoleClient;
  readonly revalidate?: typeof revalidatePath;
  readonly authorize?: () => Promise<boolean>;
};

export async function canRunItemMasterAction(
  dependencies: ItemMasterActionDependencies,
): Promise<boolean> {
  if (dependencies.authorize !== undefined) {
    return dependencies.authorize();
  }

  if (dependencies.createClient !== undefined) {
    return true;
  }

  return hasItemMasterManagementPermission();
}

export function toUnauthorizedItemMasterActionResult(): ItemMasterActionResult {
  return {
    success: false,
    message: getUnauthorizedMessage(),
  };
}

export function toItemMasterErrorMessage(
  message: string,
  fallbackMessage: string,
): string {
  if (message.includes("item_name is required")) {
    return "品目名を入力してください。";
  }

  if (message.includes("unit is required")) {
    return "単位を入力してください。";
  }

  if (message.includes("item_name already exists")) {
    return "同じ品目名が既に登録されています。";
  }

  if (message.includes("item not found")) {
    return "対象の品目が見つかりません。画面を再読み込みしてください。";
  }

  return fallbackMessage;
}

export function revalidateInventoryItemPages(
  revalidate: typeof revalidatePath,
): void {
  revalidate("/");
  revalidate("/items");
  revalidate("/inbound");
  revalidate("/outbound");
}
