import { describe, expect, it } from "@jest/globals";
import { itemIdSchema, itemMasterSchema } from "./item-master-schema";

const VALID_INPUT = {
  name: "  ニトリル手袋  ",
  category: "  消耗品  ",
  unit: "  箱  ",
};

describe("itemMasterSchema", () => {
  it("正常な品目入力を受け付けて空白を正規化する", () => {
    const result = itemMasterSchema.safeParse(VALID_INPUT);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual({
        name: "ニトリル手袋",
        category: "消耗品",
        unit: "箱",
      });
    }
  });

  it("カテゴリが空白の場合は null に正規化する", () => {
    const result = itemMasterSchema.safeParse({
      ...VALID_INPUT,
      category: "   ",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.category).toBeNull();
    }
  });

  it("品目名が空の場合はエラーになる", () => {
    const result = itemMasterSchema.safeParse({
      ...VALID_INPUT,
      name: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("単位が空の場合はエラーになる", () => {
    const result = itemMasterSchema.safeParse({
      ...VALID_INPUT,
      unit: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("品目IDが UUID でない場合はエラーになる", () => {
    const result = itemIdSchema.safeParse("invalid-id");

    expect(result.success).toBe(false);
  });
});
