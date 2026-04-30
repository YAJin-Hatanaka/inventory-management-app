"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  itemIdSchema,
  itemMasterSchema,
  type ItemMasterInput,
} from "../schemas/item-master-schema";
import {
  type ItemMasterActionDependencies,
  type ItemMasterActionResult,
  canRunItemMasterAction,
  revalidateInventoryItemPages,
  toItemMasterErrorMessage,
  toUnauthorizedItemMasterActionResult,
} from "./item-master-action-utils";

export async function updateInventoryItem(
  itemId: string,
  input: ItemMasterInput,
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

    const parsedInput = itemMasterSchema.safeParse(input);

    if (!parsedInput.success) {
      return {
        success: false,
        message:
          parsedInput.error.issues[0]?.message ?? "入力内容を確認してください。",
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
    const { name, category, unit } = parsedInput.data;
    const { data, error } = await supabase.rpc("update_inventory_item", {
      p_item_id: parsedItemId.data,
      p_name: name,
      p_category: category,
      p_unit: unit,
    });

    if (error !== null) {
      console.error(error);

      return {
        success: false,
        message: toItemMasterErrorMessage(
          error.message,
          "品目の更新に失敗しました。",
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
      message: "品目の更新に失敗しました。",
    };
  }
}
