"use client";

import { Search } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import useSWR from "swr";
import {
  createInventoryStockSummaryKey,
} from "../lib/inventory-stock-summary";
import type { InventoryStockSummary } from "../types/inventory";
import { InventoryTable } from "./inventory-table";

type InventoryListClientProps = {
  readonly initialItems: readonly InventoryStockSummary[];
  readonly initialSearchName: string;
};

async function fetchInventoryStockSummaries(
  key: string,
): Promise<InventoryStockSummary[]> {
  const response = await fetch(key);

  if (!response.ok) {
    throw new Error("在庫一覧を取得できませんでした。");
  }

  return response.json() as Promise<InventoryStockSummary[]>;
}

export function InventoryListClient({
  initialItems,
  initialSearchName,
}: InventoryListClientProps) {
  const [searchName, setSearchName] = useState(initialSearchName);
  const [submittedName, setSubmittedName] = useState(initialSearchName);
  const swrKey = useMemo(
    () => createInventoryStockSummaryKey(submittedName),
    [submittedName],
  );
  const { data, error, isValidating } = useSWR(
    swrKey,
    fetchInventoryStockSummaries,
    {
      fallbackData:
        submittedName.trim() === initialSearchName.trim()
          ? [...initialItems]
          : undefined,
      keepPreviousData: true,
    },
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedName(searchName.trim());
  }

  const items = data ?? [];

  return (
    <section className="flex flex-col gap-5">
      <form
        className="flex flex-col gap-3 border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end"
        onSubmit={handleSubmit}
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
              name="name"
              onChange={(event) => setSearchName(event.target.value)}
              placeholder="品目名を入力"
              type="search"
              value={searchName}
            />
          </span>
        </label>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={isValidating}
          type="submit"
        >
          <Search aria-hidden="true" className="size-4" />
          検索
        </button>
      </form>

      {error !== undefined ? (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          在庫一覧を取得できませんでした。
        </p>
      ) : null}

      <InventoryTable items={items} />
    </section>
  );
}
