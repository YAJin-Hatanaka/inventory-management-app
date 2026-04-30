"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, PackageMinus } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import { registerOutboundTransaction } from "../actions/register-outbound-transaction";
import { getTodayDateInputValue } from "../lib/inbound-registration";
import {
  outboundRegistrationSchema,
  type OutboundRegistrationInput,
  type OutboundRegistrationValues,
} from "../schemas/outbound-registration-schema";
import type { InventoryStockSummary } from "../types/inventory";

type OutboundRegistrationFormProps = {
  readonly stockSummaryKey: string;
  readonly submitRegistration?: typeof registerOutboundTransaction;
};

async function fetchInventoryStockSummary(
  key: string,
): Promise<InventoryStockSummary[]> {
  const response = await fetch(key);

  if (!response.ok) {
    throw new Error("在庫情報を取得できませんでした。");
  }

  return response.json() as Promise<InventoryStockSummary[]>;
}

export function OutboundRegistrationForm({
  stockSummaryKey,
  submitRegistration = registerOutboundTransaction,
}: OutboundRegistrationFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    data: items = [],
    error: itemsError,
    isValidating,
    mutate: mutateItems,
  } = useSWR(stockSummaryKey, fetchInventoryStockSummary, {
    keepPreviousData: true,
  });
  const {
    formState: { errors, isSubmitting },
    control,
    handleSubmit,
    register,
    resetField,
    setError,
    setValue,
  } = useForm<OutboundRegistrationInput, unknown, OutboundRegistrationValues>({
    resolver: zodResolver(outboundRegistrationSchema),
    defaultValues: {
      itemId: "",
      quantity: "",
      transactionDate: getTodayDateInputValue(),
      note: "",
    },
  });
  const selectedItemId = useWatch({ control, name: "itemId" });
  const selectedItem = useMemo(
    () => items.find((item) => item.itemId === selectedItemId),
    [items, selectedItemId],
  );
  const isSubmitDisabled =
    isSubmitting ||
    selectedItem === undefined ||
    selectedItem.currentQuantity <= 0;

  async function handleValidSubmit(values: OutboundRegistrationValues) {
    setMessage(null);
    setServerError(null);

    if (selectedItem === undefined) {
      setError("itemId", {
        message: "品目を選択してください。",
        type: "manual",
      });
      return;
    }

    if (selectedItem.currentQuantity < values.quantity) {
      setError("quantity", {
        message: "現在在庫数を超える出庫は登録できません。",
        type: "manual",
      });
      return;
    }

    const result = await submitRegistration(values);

    if (!result.success) {
      setServerError(result.message);
      return;
    }

    setMessage("出庫登録が完了しました。");
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
            在庫情報を取得できませんでした。
          </p>
        ) : null}

        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          品目
          <select
            className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100"
            disabled={isSubmitting || items.length === 0}
            {...register("itemId", {
              onChange: () => {
                setMessage(null);
                setServerError(null);
                resetField("quantity", { defaultValue: "" });
              },
            })}
          >
            <option value="">品目を選択してください</option>
            {items.map((item) => (
              <option key={item.itemId} value={item.itemId}>
                {item.itemCode} - {item.name}
              </option>
            ))}
          </select>
          {errors.itemId !== undefined ? (
            <span className="text-sm text-red-600" role="alert">
              {errors.itemId.message}
            </span>
          ) : null}
          {items.length === 0 && itemsError === undefined ? (
            <span className="text-sm text-zinc-500">
              出庫できる登録済み品目がありません。
            </span>
          ) : null}
        </label>

        <div className="grid gap-4 border border-zinc-200 bg-zinc-50 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-zinc-500">現在在庫数</p>
            <p className="mt-1 text-lg font-semibold text-zinc-950">
              {selectedItem === undefined
                ? "-"
                : `${selectedItem.currentQuantity} ${selectedItem.unit}`}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">品目情報</p>
            <p className="mt-1 text-sm font-medium text-zinc-950">
              {selectedItem?.name ?? "-"}
            </p>
            {selectedItem?.category !== null &&
            selectedItem?.category !== undefined ? (
              <p className="mt-1 text-xs text-zinc-500">
                {selectedItem.category}
              </p>
            ) : null}
          </div>
          {selectedItem !== undefined && selectedItem.currentQuantity <= 0 ? (
            <p className="text-sm text-red-600 sm:col-span-2" role="alert">
              在庫がありません。
            </p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            出庫数量
            <input
              className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100"
              disabled={
                selectedItem === undefined ||
                selectedItem.currentQuantity <= 0 ||
                isSubmitting
              }
              inputMode="numeric"
              max={selectedItem?.currentQuantity}
              min="1"
              step="1"
              type="number"
              {...register("quantity", {
                onChange: () => {
                  setMessage(null);
                  setServerError(null);
                },
              })}
            />
            {errors.quantity !== undefined ? (
              <span className="text-sm text-red-600" role="alert">
                {errors.quantity.message}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            出庫日
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
            disabled={isSubmitDisabled}
            type="submit"
          >
            <PackageMinus aria-hidden="true" className="size-4" />
            登録する
          </button>
          {isValidating ? (
            <span className="text-sm text-zinc-500">在庫情報を更新中</span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
