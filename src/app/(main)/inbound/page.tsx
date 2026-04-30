import { InboundRegistrationForm } from "@/features/inventory/components/inbound-registration-form";
import { requirePagePermission } from "@/features/auth/lib/server-permissions";
import { canRegisterInventoryTransaction } from "@/features/auth/lib/roles";
import {
  fetchInventoryItemOptions,
  INVENTORY_ITEMS_KEY,
} from "@/features/inventory/lib/inventory-items";
import { createClient } from "@/lib/supabase/server";

export default async function InboundPage() {
  await requirePagePermission(canRegisterInventoryTransaction);
  const supabase = await createClient();
  const items = await fetchInventoryItemOptions(supabase);

  return (
    <>
      <header className="border-b border-zinc-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
          入庫登録
        </h1>
      </header>
      <InboundRegistrationForm
        initialItems={items}
        itemsKey={INVENTORY_ITEMS_KEY}
      />
    </>
  );
}
