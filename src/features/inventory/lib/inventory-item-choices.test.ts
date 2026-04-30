import { describe, expect, it } from "@jest/globals";
import {
  INVENTORY_CATEGORY_OPTIONS,
  INVENTORY_UNIT_OPTIONS,
} from "./inventory-item-choices";

describe("inventory item choices", () => {
  it("カテゴリ候補が10項目である", () => {
    expect(INVENTORY_CATEGORY_OPTIONS).toHaveLength(10);
  });

  it("単位候補が10項目である", () => {
    expect(INVENTORY_UNIT_OPTIONS).toHaveLength(10);
  });
});
