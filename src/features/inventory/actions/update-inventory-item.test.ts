import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { updateInventoryItem } from "./update-inventory-item";

type RpcResult = {
  readonly data: string | null;
  readonly error: { readonly message: string } | null;
};

type RpcArgs = {
  readonly p_item_id: string;
  readonly p_name: string;
  readonly p_category: string | null;
  readonly p_unit: string;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("updateInventoryItem", () => {
  it("正常系では RPC を呼び出して関連ページを再検証する", async () => {
    const itemId = "11111111-1111-4111-8111-111111111111";
    const rpc = jest.fn<(
      functionName: string,
      args: RpcArgs,
    ) => Promise<RpcResult>>().mockResolvedValue({
      data: itemId,
      error: null,
    });
    const revalidateCalls: string[] = [];

    const result = await updateInventoryItem(
      itemId,
      {
        name: "  ニトリル手袋  ",
        category: "   ",
        unit: "  箱  ",
      },
      {
        createClient: () => ({ rpc } as never),
        revalidate: (path) => {
          revalidateCalls.push(path);
        },
      },
    );

    expect(result).toEqual({
      success: true,
      itemId,
    });
    expect(rpc).toHaveBeenCalledWith("update_inventory_item", {
      p_item_id: itemId,
      p_name: "ニトリル手袋",
      p_category: null,
      p_unit: "箱",
    });
    expect(revalidateCalls).toEqual(["/", "/items", "/inbound", "/outbound"]);
  });

  it("存在しない品目エラーをユーザー向けメッセージに変換する", async () => {
    const rpc = jest.fn<(
      functionName: string,
      args: RpcArgs,
    ) => Promise<RpcResult>>().mockResolvedValue({
      data: null,
      error: { message: "item not found" },
    });

    const result = await updateInventoryItem(
      "11111111-1111-4111-8111-111111111111",
      {
        name: "ニトリル手袋",
        category: null,
        unit: "箱",
      },
      {
        createClient: () => ({ rpc } as never),
        revalidate: () => undefined,
      },
    );

    expect(result).toEqual({
      success: false,
      message: "対象の品目が見つかりません。画面を再読み込みしてください。",
    });
  });
});
