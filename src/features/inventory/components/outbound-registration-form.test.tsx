import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { OutboundRegistrationForm } from "./outbound-registration-form";
import type {
  RegisterOutboundTransactionResult,
} from "../actions/register-outbound-transaction";
import type { OutboundRegistrationInput } from "../schemas/outbound-registration-schema";
import type { InventoryStockSummary } from "../types/inventory";

const ITEMS: readonly InventoryStockSummary[] = [
  {
    itemId: "11111111-1111-4111-8111-111111111111",
    itemCode: 1,
    name: "ニトリル手袋",
    category: "消耗品",
    unit: "箱",
    inboundQuantity: 20,
    outboundQuantity: 3,
    currentQuantity: 17,
  },
  {
    itemId: "22222222-2222-4222-8222-222222222222",
    itemCode: 2,
    name: "在庫ゼロ品目",
    category: "消耗品",
    unit: "箱",
    inboundQuantity: 5,
    outboundQuantity: 5,
    currentQuantity: 0,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => [...ITEMS],
  })) as unknown as typeof fetch;
});

function renderForm() {
  const submitRegistration = jest.fn<
    (
      input: OutboundRegistrationInput,
    ) => Promise<RegisterOutboundTransactionResult>
  >().mockResolvedValue({
    success: true,
    transactionId: "txn-1",
  });

  render(
    <OutboundRegistrationForm
      stockSummaryKey="/api/test"
      submitRegistration={submitRegistration}
    />,
  );

  return { submitRegistration };
}

describe("OutboundRegistrationForm", () => {
  it("在庫 0 の品目では数量入力と登録ボタンが無効になる", async () => {
    renderForm();

    await waitFor(() => {
      expect(screen.getByText("1 - ニトリル手袋")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("品目"), {
      target: { value: ITEMS[1].itemId },
    });

    expect(screen.getByText("0 箱")).toBeTruthy();
    expect((screen.getByLabelText("出庫数量") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "登録する" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("在庫がありません。")).toBeTruthy();
  });

  it("正常な入力で Server Action を呼び出す", async () => {
    const { submitRegistration } = renderForm();

    await waitFor(() => {
      expect(screen.getByText("1 - ニトリル手袋")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("品目"), {
      target: { value: ITEMS[0].itemId },
    });
    fireEvent.change(screen.getByLabelText("出庫数量"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("出庫日"), {
      target: { value: "2026-04-29" },
    });
    fireEvent.change(screen.getByLabelText("備考"), {
      target: { value: "  出庫先メモ  " },
    });

    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => {
      expect(submitRegistration).toHaveBeenCalledTimes(1);
    });

    expect(submitRegistration).toHaveBeenCalledWith({
      itemId: ITEMS[0].itemId,
      quantity: 2,
      transactionDate: "2026-04-29",
      note: "出庫先メモ",
    });
    expect(screen.getByText("出庫登録が完了しました。")).toBeTruthy();
  });
});
