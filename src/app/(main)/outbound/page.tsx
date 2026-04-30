import { SWRConfig } from "swr";
import { OutboundRegistrationForm } from "@/features/inventory/components/outbound-registration-form";
import { canRegisterInventoryTransaction } from "@/features/auth/lib/roles";
import { requirePagePermission } from "@/features/auth/lib/server-permissions";
import {
  createInventoryStockSummaryKey,
  fetchInventoryStockSummaries,
} from "@/features/inventory/lib/inventory-stock-summary";
import { createClient } from "@/lib/supabase/server";

export default async function OutboundPage() {
  await requirePagePermission(canRegisterInventoryTransaction);
  const stockSummaryKey = createInventoryStockSummaryKey("");
  const supabase = await createClient();
  const items = await fetchInventoryStockSummaries(supabase, "");

  return (
    <>
      <header className="border-b border-zinc-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
          出庫登録
        </h1>
      </header>
      <SWRConfig value={{ fallback: { [stockSummaryKey]: items } }}>
        <OutboundRegistrationForm stockSummaryKey={stockSummaryKey} />
      </SWRConfig>
    </>
  );
}
