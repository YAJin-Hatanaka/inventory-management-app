"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, PackagePlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import { registerInboundTransaction } from "../actions/register-inbound-transaction";
import {
  DEFAULT_INVENTORY_CATEGORY,
  DEFAULT_INVENTORY_UNIT,
  INVENTORY_CATEGORY_OPTIONS,
  INVENTORY_UNIT_OPTIONS,
} from "../lib/inventory-item-choices";
import { getTodayDateInputValue } from "../lib/inbound-registration";
import {
  inboundRegistrationSchema,
  type InboundRegistrationInput,
  type InboundRegistrationValues,
} from "../schemas/inbound-registration-schema";
import type { InventoryItemOption } from "../types/inventory";

type InboundRegistrationFormProps = {
  readonly initialItems: readonly InventoryItemOption[];
  readonly itemsKey: string;
};

async function fetchInventoryItemOptions(
  key: string,
): Promise<InventoryItemOption[]> {
  const response = await fetch(key);

  if (!response.ok) {
    throw new Error("品目候補を取得できませんでした。");
  }

  return response.json() as Promise<InventoryItemOption[]>;
}

export function InboundRegistrationForm({
  initialItems,
  itemsKey,
}: InboundRegistrationFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    data: items = [],
    error: itemsError,
    isValidating,
    mutate: mutateItems,
  } = useSWR(itemsKey, fetchInventoryItemOptions, {
    fallbackData: [...initialItems],
    keepPreviousData: true,
  });
  const {
    formState: { errors, isSubmitting },
    control,
    handleSubmit,
    register,
    resetField,
    setValue,
  } = useForm<InboundRegistrationInput, unknown, InboundRegistrationValues>({
    resolver: zodResolver(inboundRegistrationSchema),
    defaultValues: {
      itemId: "",
      itemName: "",
      category: DEFAULT_INVENTORY_CATEGORY,
      unit: DEFAULT_INVENTORY_UNIT,
      quantity: "",
      transactionDate: getTodayDateInputValue(),
      note: "",
    },
  });
  const selectedItemId = useWatch({ control, name: "itemId" });
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId),
    [items, selectedItemId],
  );

  async function handleValidSubmit(values: InboundRegistrationValues) {
    setMessage(null);
    setServerError(null);

    const result = await registerInboundTransaction(values);

    if (!result.success) {
      setServerError(result.message);
      return;
    }

    setMessage("入庫登録が完了しました。");
    resetField("quantity", { defaultValue: "" });
    resetField("note", { defaultValue: "" });
    setValue("transactionDate", getTodayDateInputValue());
    await mutateItems();
  }

  return (
    <section className="border border-zinc-200 bg-white p-4 sm:p-6">
      <form
        className="flex max-w-2xl flex-col gap-5"
        onSubmit={handleSubmit(handleValidSubmit)}
      >
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

        {itemsError !== undefined ? (
          <p
            className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            品目候補を取得できませんでした。
          </p>
        ) : null}

        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          既存品目を選択
          <select
            className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100"
            disabled={isSubmitting || items.length === 0}
            {...register("itemId", {
              onChange: (event) => {
                setMessage(null);
                setServerError(null);
                const item = items.find(
                  (candidate) => candidate.id === event.target.value,
                );
                setValue("itemName", item?.name ?? "", {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                setValue(
                  "category",
                  item?.category ?? DEFAULT_INVENTORY_CATEGORY,
                  {
                    shouldDirty: true,
                    shouldValidate: true,
                  },
                );
                setValue("unit", item?.unit ?? DEFAULT_INVENTORY_UNIT, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              },
            })}
          >
            <option value="">新規品目名を入力する</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.itemCode} - {item.name}
              </option>
            ))}
          </select>
          {items.length === 0 && itemsError === undefined ? (
            <span className="text-sm text-zinc-500">
              登録済み品目がありません。品目名を直接入力してください。
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          品目名
          <input
            className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
            placeholder="新規品目名も入力できます"
            type="text"
            {...register("itemName", {
              onChange: () => {
                setMessage(null);
                setServerError(null);
              },
            })}
          />
          {errors.itemName !== undefined ? (
            <span className="text-sm text-red-600" role="alert">
              {errors.itemName.message}
            </span>
          ) : null}
          {selectedItem === undefined ? (
            <span className="text-sm text-zinc-500">
              新規品目名も入力できます。
            </span>
          ) : null}
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            カテゴリ
            <select
              className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
              {...register("category", {
                onChange: () => {
                  setMessage(null);
                  setServerError(null);
                },
              })}
            >
              {INVENTORY_CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {errors.category !== undefined ? (
              <span className="text-sm text-red-600" role="alert">
                {errors.category.message}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            単位
            <select
              className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
              {...register("unit", {
                onChange: () => {
                  setMessage(null);
                  setServerError(null);
                },
              })}
            >
              {INVENTORY_UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            {errors.unit !== undefined ? (
              <span className="text-sm text-red-600" role="alert">
                {errors.unit.message}
              </span>
            ) : null}
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            入庫数量
            <input
              className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
              inputMode="numeric"
              min="1"
              step="1"
              type="number"
              {...register("quantity")}
            />
            {errors.quantity !== undefined ? (
              <span className="text-sm text-red-600" role="alert">
                {errors.quantity.message}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            入庫日
            <input
              className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
              type="date"
              {...register("transactionDate")}
            />
            {errors.transactionDate !== undefined ? (
              <span className="text-sm text-red-600" role="alert">
                {errors.transactionDate.message}
              </span>
            ) : null}
          </label>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          備考
          <textarea
            className="min-h-24 w-full resize-y border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950"
            {...register("note")}
          />
          {errors.note !== undefined ? (
            <span className="text-sm text-red-600" role="alert">
              {errors.note.message}
            </span>
          ) : null}
        </label>

        <div className="flex items-center gap-3">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={isSubmitting}
            type="submit"
          >
            <PackagePlus aria-hidden="true" className="size-4" />
            登録する
          </button>
          {isValidating ? (
            <span className="text-sm text-zinc-500">品目候補を更新中</span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
