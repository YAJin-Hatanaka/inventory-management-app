import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, jest } from "@jest/globals";
import { ItemMasterForm } from "./item-master-form";
import type { InventoryItem } from "../types/inventory";

const ITEM: InventoryItem = {
  id: "11111111-1111-4111-8111-111111111111",
  itemCode: 1,
  name: "ニトリル手袋",
  category: "消耗品",
  unit: "箱",
};

describe("ItemMasterForm", () => {
  it("新規追加フォームで入力値を送信する", async () => {
    const onSubmit = jest.fn<
      (values: { name: string; category: string | null; unit: string }) => Promise<void>
    >().mockResolvedValue();

    render(
      <ItemMasterForm
        editingItem={null}
        isSubmitting={false}
        onCancelEdit={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("品目名"), {
      target: { value: "  マスク  " },
    });
    fireEvent.change(screen.getByLabelText("カテゴリ"), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByLabelText("単位"), {
      target: { value: "  箱  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加する" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      name: "マスク",
      category: null,
      unit: "箱",
    });
  });

  it("編集時は品目コードを表示しキャンセルできる", () => {
    const onCancelEdit = jest.fn();

    render(
      <ItemMasterForm
        editingItem={ITEM}
        isSubmitting={false}
        onCancelEdit={onCancelEdit}
        onSubmit={jest.fn<() => Promise<void>>().mockResolvedValue()}
      />,
    );

    expect(screen.getByText("0001")).toBeTruthy();
    expect((screen.getByLabelText("品目名") as HTMLInputElement).value).toBe(
      "ニトリル手袋",
    );

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onCancelEdit).toHaveBeenCalledTimes(1);
  });
});
