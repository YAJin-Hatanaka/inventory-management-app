export type InventoryStockSummary = {
  readonly itemId: string;
  readonly itemCode: number;
  readonly name: string;
  readonly category: string | null;
  readonly unit: string;
  readonly inboundQuantity: number;
  readonly outboundQuantity: number;
  readonly currentQuantity: number;
};

export type InventoryItemOption = {
  readonly id: string;
  readonly itemCode: number;
  readonly name: string;
  readonly category: string | null;
  readonly unit: string;
};

export type InventoryItem = InventoryItemOption;
