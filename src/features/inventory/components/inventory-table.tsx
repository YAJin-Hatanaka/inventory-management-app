import type { InventoryStockSummary } from "../types/inventory";

type InventoryTableProps = {
  readonly items: readonly InventoryStockSummary[];
};

export function InventoryTable({ items }: InventoryTableProps) {
  return (
    <div className="overflow-hidden border border-zinc-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase tracking-normal text-zinc-600">
            <tr>
              <th className="w-28 px-4 py-3">品目コード</th>
              <th className="min-w-44 px-4 py-3">品目名</th>
              <th className="w-36 px-4 py-3">カテゴリ</th>
              <th className="w-32 px-4 py-3 text-right">現在在庫数</th>
              <th className="w-24 px-4 py-3">単位</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-zinc-500" colSpan={5}>
                  該当する品目がありません
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr className="hover:bg-zinc-50" key={item.itemId}>
                  <td className="px-4 py-3 font-mono text-zinc-700">
                    {String(item.itemCode).padStart(4, "0")}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-950">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {item.category ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-950">
                    {item.currentQuantity.toLocaleString("ja-JP")}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{item.unit}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
