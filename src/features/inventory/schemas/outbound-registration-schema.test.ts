import { describe, expect, it } from "@jest/globals";
import { outboundRegistrationSchema } from "./outbound-registration-schema";

const VALID_INPUT = {
  itemId: "11111111-1111-4111-8111-111111111111",
  quantity: "3",
  transactionDate: "2026-04-29",
  note: "  出庫先メモ  ",
};

describe("outboundRegistrationSchema", () => {
  it("正常な出庫登録入力を受け付ける", () => {
    const result = outboundRegistrationSchema.safeParse(VALID_INPUT);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual({
        itemId: VALID_INPUT.itemId,
        quantity: 3,
        transactionDate: VALID_INPUT.transactionDate,
        note: "出庫先メモ",
      });
    }
  });

  it("itemId が UUID でない場合にエラーになる", () => {
    const result = outboundRegistrationSchema.safeParse({
      ...VALID_INPUT,
      itemId: "invalid-id",
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["未入力", ""],
    ["0", "0"],
    ["負数", "-1"],
    ["小数", "1.5"],
  ])("quantity が%sの場合にエラーになる", (_label, quantity) => {
    const result = outboundRegistrationSchema.safeParse({
      ...VALID_INPUT,
      quantity,
    });

    expect(result.success).toBe(false);
  });

  it("transactionDate が YYYY-MM-DD ではない場合にエラーになる", () => {
    const result = outboundRegistrationSchema.safeParse({
      ...VALID_INPUT,
      transactionDate: "2026/04/29",
    });

    expect(result.success).toBe(false);
  });

  it("transactionDate が存在しない日付の場合にエラーになる", () => {
    const result = outboundRegistrationSchema.safeParse({
      ...VALID_INPUT,
      transactionDate: "2026-99-99",
    });

    expect(result.success).toBe(false);
  });

  it("note の空白を null に正規化する", () => {
    const result = outboundRegistrationSchema.safeParse({
      ...VALID_INPUT,
      note: "   ",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.note).toBeNull();
    }
  });
});
