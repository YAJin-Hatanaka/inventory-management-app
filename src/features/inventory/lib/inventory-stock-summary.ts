import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { InventoryStockSummary } from "../types/inventory";

type InventoryStockSummaryRow =
  Database["public"]["Views"]["inventory_stock_summary"]["Row"];

type InventoryStockSummaryClient = SupabaseClient<Database>;

function toInventoryStockSummary(
  row: InventoryStockSummaryRow,
): InventoryStockSummary {
  return {
    itemId: row.item_id,
    itemCode: row.item_code,
    name: row.name,
    category: row.category,
    unit: row.unit,
    inboundQuantity: row.inbound_quantity,
    outboundQuantity: row.outbound_quantity,
    currentQuantity: row.current_quantity,
  };
}

export async function fetchInventoryStockSummaries(
  supabase: InventoryStockSummaryClient,
  name: string,
): Promise<InventoryStockSummary[]> {
  const trimmedName = name.trim();
  let query = supabase
    .from("inventory_stock_summary")
    .select(
      "item_id,item_code,name,category,unit,inbound_quantity,outbound_quantity,current_quantity",
    )
    .order("item_code", { ascending: true });

  if (trimmedName !== "") {
    query = query.ilike("name", `%${trimmedName}%`);
  }

  const { data, error } = await query;

  if (error !== null) {
    throw new Error(error.message);
  }

  return data.map(toInventoryStockSummary);
}

export function createInventoryStockSummaryKey(name: string): string {
  const trimmedName = name.trim();

  if (trimmedName === "") {
    return "/api/inventory-stock-summary";
  }

  return `/api/inventory-stock-summary?name=${encodeURIComponent(trimmedName)}`;
}
