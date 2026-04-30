import { ItemMasterClient } from "@/features/inventory/components/item-master-client";
import {
  canManageItemMaster,
  canViewItemMaster,
} from "@/features/auth/lib/roles";
import { requirePagePermission } from "@/features/auth/lib/server-permissions";
import { fetchInventoryItems } from "@/features/inventory/lib/inventory-items";
import { createClient } from "@/lib/supabase/server";

type ItemsPageProps = {
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

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const currentUserRole = await requirePagePermission(canViewItemMaster);
  const resolvedSearchParams = await searchParams;
  const searchName = getSearchName(resolvedSearchParams?.name);
  const supabase = await createClient();
  const items = await fetchInventoryItems(supabase, searchName);

  return (
    <>
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-5">
        <p className="text-sm font-medium text-zinc-500">Item Master</p>
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
          品目マスタ管理
        </h1>
        <p className="text-sm text-zinc-600">
          品目の追加・編集・削除を行います。品目コードは自動採番されます。
        </p>
      </header>
      <ItemMasterClient
        canManageItems={canManageItemMaster(currentUserRole.role)}
        initialItems={items}
        initialSearchName={searchName}
      />
    </>
  );
}
