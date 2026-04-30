import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { deleteInventoryItem } from "./delete-inventory-item";

type RpcResult = {
  readonly data: string | null;
  readonly error: { readonly message: string } | null;
};

type RpcArgs = {
  readonly p_item_id: string;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("deleteInventoryItem", () => {
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

    const result = await deleteInventoryItem(itemId, {
      createClient: () => ({ rpc } as never),
      revalidate: (path) => {
        revalidateCalls.push(path);
      },
    });

    expect(result).toEqual({
      success: true,
      itemId,
    });
    expect(rpc).toHaveBeenCalledWith("delete_inventory_item", {
      p_item_id: itemId,
    });
    expect(revalidateCalls).toEqual(["/", "/items", "/inbound", "/outbound"]);
  });

  it("不正な品目IDでは RPC を呼び出さない", async () => {
    const rpc = jest.fn<(
      functionName: string,
      args: RpcArgs,
    ) => Promise<RpcResult>>();
    const revalidate = jest.fn<(
      originalPath: string,
      type?: "layout" | "page",
    ) => undefined>();

    const result = await deleteInventoryItem("invalid-id", {
      createClient: () => ({ rpc } as never),
      revalidate,
    });

    expect(result).toEqual({
      success: false,
      message: "品目IDが不正です。",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });
});
