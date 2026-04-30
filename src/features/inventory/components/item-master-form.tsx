"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  itemMasterSchema,
  type ItemMasterInput,
  type ItemMasterValues,
} from "../schemas/item-master-schema";
import type { InventoryItem } from "../types/inventory";

type ItemMasterFormProps = {
  readonly editingItem: InventoryItem | null;
  readonly isSubmitting: boolean;
  readonly onCancelEdit: () => void;
  readonly onSubmit: (values: ItemMasterValues) => Promise<void>;
};

export function ItemMasterForm({
  editingItem,
  isSubmitting,
  onCancelEdit,
  onSubmit,
}: ItemMasterFormProps) {
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<ItemMasterInput, unknown, ItemMasterValues>({
    resolver: zodResolver(itemMasterSchema),
    defaultValues: {
      name: editingItem?.name ?? "",
      category: editingItem?.category ?? "",
      unit: editingItem?.unit ?? "",
    },
  });

  return (
    <form
      className="flex flex-col gap-5 border border-zinc-200 bg-white p-4 sm:p-6"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-950">
          {editingItem === null ? "品目を追加" : "品目を編集"}
        </h2>
        <p className="text-sm text-zinc-500">
          {editingItem === null
            ? "品目名と単位を入力してください。カテゴリは任意です。"
            : "品目コードは変更できません。"}
        </p>
      </div>

      {editingItem !== null ? (
        <div className="border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
          <span className="font-medium text-zinc-500">品目コード: </span>
          <span className="font-mono text-zinc-950">
            {String(editingItem.itemCode).padStart(4, "0")}
          </span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          品目名
          <input
            className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100"
            disabled={isSubmitting}
            type="text"
            {...register("name")}
          />
          {errors.name !== undefined ? (
            <span className="text-sm text-red-600" role="alert">
              {errors.name.message}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          カテゴリ
          <input
            className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100"
            disabled={isSubmitting}
            type="text"
            {...register("category")}
          />
          {errors.category !== undefined ? (
            <span className="text-sm text-red-600" role="alert">
              {errors.category.message}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          単位
          <input
            className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100"
            disabled={isSubmitting}
            placeholder="個、本、箱など"
            type="text"
            {...register("unit")}
          />
          {errors.unit !== undefined ? (
            <span className="text-sm text-red-600" role="alert">
              {errors.unit.message}
            </span>
          ) : null}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="inline-flex h-10 items-center justify-center bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={isSubmitting}
          type="submit"
        >
          {editingItem === null ? "追加する" : "更新する"}
        </button>
        {editingItem !== null ? (
          <button
            className="inline-flex h-10 items-center justify-center border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-100"
            disabled={isSubmitting}
            onClick={onCancelEdit}
            type="button"
          >
            キャンセル
          </button>
        ) : null}
      </div>
    </form>
  );
}
