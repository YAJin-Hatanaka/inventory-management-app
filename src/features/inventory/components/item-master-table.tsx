import type { InventoryItem } from "../types/inventory";

type ItemMasterTableProps = {
  readonly items: readonly InventoryItem[];
  readonly onDelete: (item: InventoryItem) => void;
  readonly onEdit: (item: InventoryItem) => void;
  readonly isMutating: boolean;
  readonly canManageItems: boolean;
};

export function ItemMasterTable({
  items,
  onDelete,
  onEdit,
  isMutating,
  canManageItems,
}: ItemMasterTableProps) {
  const columnCount = canManageItems ? 5 : 4;

  return (
    <div className="overflow-hidden border border-zinc-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase tracking-normal text-zinc-600">
            <tr>
              <th className="w-28 px-4 py-3">品目コード</th>
              <th className="min-w-44 px-4 py-3">品目名</th>
              <th className="w-36 px-4 py-3">カテゴリ</th>
              <th className="w-24 px-4 py-3">単位</th>
              {canManageItems ? (
                <th className="w-36 px-4 py-3 text-right">操作</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {items.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-10 text-center text-zinc-500"
                  colSpan={columnCount}
                >
                  該当する品目はありません。
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr className="hover:bg-zinc-50" key={item.id}>
                  <td className="px-4 py-3 font-mono text-zinc-700">
                    {String(item.itemCode).padStart(4, "0")}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-950">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {item.category ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{item.unit}</td>
                  {canManageItems ? (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          className="inline-flex h-9 items-center justify-center border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-100"
                          disabled={isMutating}
                          onClick={() => onEdit(item)}
                          type="button"
                        >
                          編集
                        </button>
                        <button
                          className="inline-flex h-9 items-center justify-center border border-red-200 bg-white px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-zinc-100"
                          disabled={isMutating}
                          onClick={() => onDelete(item)}
                          type="button"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
