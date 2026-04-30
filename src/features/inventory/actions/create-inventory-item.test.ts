import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createInventoryItem } from "./create-inventory-item";

type RpcResult = {
  readonly data: string | null;
  readonly error: { readonly message: string } | null;
};

type RpcArgs = {
  readonly p_name: string;
  readonly p_category: string | null;
  readonly p_unit: string;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createInventoryItem", () => {
  it("正常系では RPC を呼び出して関連ページを再検証する", async () => {
    const rpc = jest.fn<(
      functionName: string,
      args: RpcArgs,
    ) => Promise<RpcResult>>().mockResolvedValue({
      data: "11111111-1111-4111-8111-111111111111",
      error: null,
    });
    const revalidateCalls: string[] = [];

    const result = await createInventoryItem(
      {
        name: "  ニトリル手袋  ",
        category: "  消耗品  ",
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
      itemId: "11111111-1111-4111-8111-111111111111",
    });
    expect(rpc).toHaveBeenCalledWith("create_inventory_item", {
      p_name: "ニトリル手袋",
      p_category: "消耗品",
      p_unit: "箱",
    });
    expect(revalidateCalls).toEqual(["/", "/items", "/inbound", "/outbound"]);
  });

  it("重複エラーをユーザー向けメッセージに変換する", async () => {
    const rpc = jest.fn<(
      functionName: string,
      args: RpcArgs,
    ) => Promise<RpcResult>>().mockResolvedValue({
      data: null,
      error: { message: "item_name already exists" },
    });

    const result = await createInventoryItem(
      {
        name: "ニトリル手袋",
        category: "",
        unit: "箱",
      },
      {
        createClient: () => ({ rpc } as never),
        revalidate: () => undefined,
      },
    );

    expect(result).toEqual({
      success: false,
      message: "同じ品目名が既に登録されています。",
    });
  });
});
