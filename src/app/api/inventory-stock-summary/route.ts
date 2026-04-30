import { NextResponse } from "next/server";
import { fetchInventoryStockSummaries } from "@/features/inventory/lib/inventory-stock-summary";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") ?? "";

  try {
    const supabase = await createClient();
    const items = await fetchInventoryStockSummaries(supabase, name);

    return NextResponse.json(items);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "在庫一覧を取得できませんでした。" },
      { status: 500 },
    );
  }
}
