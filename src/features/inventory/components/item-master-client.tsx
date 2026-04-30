"use client";

import { CheckCircle2, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createInventoryItem } from "../actions/create-inventory-item";
import { deleteInventoryItem } from "../actions/delete-inventory-item";
import type { ItemMasterActionResult } from "../actions/item-master-action-utils";
import { updateInventoryItem } from "../actions/update-inventory-item";
import type { ItemMasterValues } from "../schemas/item-master-schema";
import type { InventoryItem } from "../types/inventory";
import { ItemMasterForm } from "./item-master-form";
import { ItemMasterTable } from "./item-master-table";

type ItemMasterClientProps = {
  readonly initialItems: readonly InventoryItem[];
  readonly initialSearchName: string;
  readonly canManageItems: boolean;
  readonly createItem?: typeof createInventoryItem;
  readonly deleteItem?: typeof deleteInventoryItem;
  readonly updateItem?: typeof updateInventoryItem;
};

function getDeleteConfirmMessage(item: InventoryItem): string {
  return [
    `品目「${item.name}」を削除します。`,
    "関連する入出庫履歴がある場合は併せて削除されます。",
    "この操作は元に戻せません。削除してよろしいですか？",
  ].join("\n");
}

export function ItemMasterClient({
  initialItems,
  initialSearchName,
  canManageItems,
  createItem = createInventoryItem,
  deleteItem = deleteInventoryItem,
  updateItem = updateInventoryItem,
}: ItemMasterClientProps) {
  const router = useRouter();
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [resetVersion, setResetVersion] = useState(0);

  async function handleFormSubmit(values: ItemMasterValues) {
    if (!canManageItems) {
      setServerError("この操作を実行する権限がありません。");
      return;
    }

    setIsMutating(true);
    setMessage(null);
    setServerError(null);

    const result =
      editingItem === null
        ? await createItem(values)
        : await updateItem(editingItem.id, values);

    handleActionResult(
      result,
      editingItem === null ? "品目を追加しました。" : "品目を更新しました。",
    );
  }

  function handleActionResult(
    result: ItemMasterActionResult,
    successMessage: string,
  ) {
    setIsMutating(false);

    if (!result.success) {
      setServerError(result.message);
      return;
    }

    setMessage(successMessage);
    setEditingItem(null);
    setResetVersion((current) => current + 1);
    router.refresh();
  }

  async function handleDelete(item: InventoryItem) {
    if (!canManageItems) {
      setServerError("この操作を実行する権限がありません。");
      return;
    }

    const shouldDelete = window.confirm(getDeleteConfirmMessage(item));

    if (!shouldDelete) {
      return;
    }

    setIsMutating(true);
    setMessage(null);
    setServerError(null);

    const result = await deleteItem(item.id);
    handleActionResult(result, "品目を削除しました。");
  }

  function handleEdit(item: InventoryItem) {
    if (!canManageItems) {
      return;
    }

    setMessage(null);
    setServerError(null);
    setEditingItem(item);
  }

  return (
    <section className="flex flex-col gap-5">
      <form
        action="/items"
        className="flex flex-col gap-3 border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end"
        method="get"
      >
        <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-zinc-800">
          品目名検索
          <span className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
            />
            <input
              className="h-10 w-full border border-zinc-300 bg-white pl-9 pr-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
              defaultValue={initialSearchName}
              name="name"
              placeholder="品目名を入力"
              type="search"
            />
          </span>
        </label>
        <div className="flex gap-2">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800"
            type="submit"
          >
            <Search aria-hidden="true" className="size-4" />
            検索
          </button>
          {initialSearchName.trim() !== "" ? (
            <Link
              className="inline-flex h-10 items-center justify-center border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
              href="/items"
            >
              クリア
            </Link>
          ) : null}
        </div>
      </form>

      {message !== null ? (
        <p className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          {message}
        </p>
      ) : null}

      {serverError !== null ? (
        <p
          className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {serverError}
        </p>
      ) : null}

      {canManageItems ? (
        <ItemMasterForm
          editingItem={editingItem}
          isSubmitting={isMutating}
          key={editingItem?.id ?? `new-${resetVersion}`}
          onCancelEdit={() => setEditingItem(null)}
          onSubmit={handleFormSubmit}
        />
      ) : (
        <p className="border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
          この画面は閲覧専用です。
        </p>
      )}

      <ItemMasterTable
        canManageItems={canManageItems}
        isMutating={isMutating}
        items={initialItems}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
    </section>
  );
}
