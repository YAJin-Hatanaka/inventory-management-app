import { NextResponse } from "next/server";
import { canViewItemMaster } from "@/features/auth/lib/roles";
import { hasActionPermission } from "@/features/auth/lib/server-permissions";
import {
  fetchInventoryItemOptions,
  fetchInventoryItems,
} from "@/features/inventory/lib/inventory-items";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  try {
    const isAuthorized = await hasActionPermission(canViewItemMaster);

    if (!isAuthorized) {
      return NextResponse.json(
        { message: "この情報を取得する権限がありません。" },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const items =
      name === null
        ? await fetchInventoryItemOptions(supabase)
        : await fetchInventoryItems(supabase, name);

    return NextResponse.json(items);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "品目候補を取得できませんでした。" },
      { status: 500 },
    );
  }
}
