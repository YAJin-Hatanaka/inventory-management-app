import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, jest } from "@jest/globals";
import { ItemMasterTable } from "./item-master-table";
import type { InventoryItem } from "../types/inventory";

const ITEMS: readonly InventoryItem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    itemCode: 1,
    name: "ニトリル手袋",
    category: "消耗品",
    unit: "箱",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    itemCode: 2,
    name: "マスク",
    category: null,
    unit: "箱",
  },
];

describe("ItemMasterTable", () => {
  it("品目一覧を表示して編集・削除を呼び出す", () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    render(
      <ItemMasterTable
        canManageItems={true}
        isMutating={false}
        items={ITEMS}
        onDelete={onDelete}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText("0001")).toBeTruthy();
    expect(screen.getByText("ニトリル手袋")).toBeTruthy();
    expect(screen.getByText("マスク")).toBeTruthy();
    expect(screen.getByText("-")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "編集" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "削除" })[1]);

    expect(onEdit).toHaveBeenCalledWith(ITEMS[0]);
    expect(onDelete).toHaveBeenCalledWith(ITEMS[1]);
  });

  it("品目がない場合は空表示メッセージを表示する", () => {
    render(
      <ItemMasterTable
        canManageItems={true}
        isMutating={false}
        items={[]}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />,
    );

    expect(screen.getByText("該当する品目はありません。")).toBeTruthy();
  });

  it("閲覧専用では操作列を表示しない", () => {
    render(
      <ItemMasterTable
        canManageItems={false}
        isMutating={false}
        items={ITEMS}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "編集" })).toBeNull();
    expect(screen.queryByRole("button", { name: "削除" })).toBeNull();
  });
});
