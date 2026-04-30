import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { InventoryItem, InventoryItemOption } from "../types/inventory";

type InventoryItemRow = Pick<
  Database["public"]["Tables"]["inventory_items"]["Row"],
  "id" | "item_code" | "name" | "category" | "unit"
>;

type InventoryItemsClient = SupabaseClient<Database>;

export const INVENTORY_ITEMS_KEY = "/api/inventory-items";

function toInventoryItemOption(row: InventoryItemRow): InventoryItemOption {
  return {
    id: row.id,
    itemCode: row.item_code,
    name: row.name,
    category: row.category,
    unit: row.unit,
  };
}

export async function fetchInventoryItemOptions(
  supabase: InventoryItemsClient,
): Promise<InventoryItemOption[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id,item_code,name,category,unit")
    .order("item_code", { ascending: true });

  if (error !== null) {
    throw new Error(error.message);
  }

  return data.map(toInventoryItemOption);
}

export async function fetchInventoryItems(
  supabase: InventoryItemsClient,
  name: string,
): Promise<InventoryItem[]> {
  const trimmedName = name.trim();
  let query = supabase
    .from("inventory_items")
    .select("id,item_code,name,category,unit")
    .order("item_code", { ascending: true });

  if (trimmedName !== "") {
    query = query.ilike("name", `%${trimmedName}%`);
  }

  const { data, error } = await query;

  if (error !== null) {
    throw new Error(error.message);
  }

  return data.map(toInventoryItemOption);
}

export function createInventoryItemsKey(name: string): string {
  const trimmedName = name.trim();

  if (trimmedName === "") {
    return INVENTORY_ITEMS_KEY;
  }

  return `${INVENTORY_ITEMS_KEY}?name=${encodeURIComponent(trimmedName)}`;
}

