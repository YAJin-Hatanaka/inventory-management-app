"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { itemIdSchema } from "../schemas/item-master-schema";
import {
  type ItemMasterActionDependencies,
  type ItemMasterActionResult,
  canRunItemMasterAction,
  revalidateInventoryItemPages,
  toItemMasterErrorMessage,
  toUnauthorizedItemMasterActionResult,
} from "./item-master-action-utils";

export async function deleteInventoryItem(
  itemId: string,
  dependencies: ItemMasterActionDependencies = {},
): Promise<ItemMasterActionResult> {
  try {
    const parsedItemId = itemIdSchema.safeParse(itemId);

    if (!parsedItemId.success) {
      return {
        success: false,
        message:
          parsedItemId.error.issues[0]?.message ?? "品目IDが不正です。",
      };
    }

    const isAuthorized = await canRunItemMasterAction(dependencies);

    if (!isAuthorized) {
      return toUnauthorizedItemMasterActionResult();
    }

    const createClient =
      dependencies.createClient ?? createServiceRoleClient;
    const revalidate = dependencies.revalidate ?? revalidatePath;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("delete_inventory_item", {
      p_item_id: parsedItemId.data,
    });

    if (error !== null) {
      console.error(error);

      return {
        success: false,
        message: toItemMasterErrorMessage(
          error.message,
          "品目の削除に失敗しました。",
        ),
      };
    }

    revalidateInventoryItemPages(revalidate);

    return {
      success: true,
      itemId: data,
    };
  } catch (error) {
    console.error(error);

    return {
      success: false,
      message: "品目の削除に失敗しました。",
    };
  }
}
