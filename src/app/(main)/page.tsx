import { InventoryListClient } from "@/features/inventory/components/inventory-list-client";
import { fetchInventoryStockSummaries } from "@/features/inventory/lib/inventory-stock-summary";
import { createClient } from "@/lib/supabase/server";

type InventoryPageProps = {
  readonly searchParams?: Promise<{
    readonly name?: string | string[];
  }>;
};

function getSearchName(name: string | string[] | undefined): string {
  if (Array.isArray(name)) {
    return name[0] ?? "";
  }

  return name ?? "";
}

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const resolvedSearchParams = await searchParams;
  const searchName = getSearchName(resolvedSearchParams?.name);
  const supabase = await createClient();
  const items = await fetchInventoryStockSummaries(supabase, searchName);

  return (
    <>
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-5">
        <p className="text-sm font-medium text-zinc-500">Inventory</p>
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
          在庫一覧
        </h1>
      </header>
      <InventoryListClient
        initialItems={items}
        initialSearchName={searchName}
      />
    </>
  );
}
