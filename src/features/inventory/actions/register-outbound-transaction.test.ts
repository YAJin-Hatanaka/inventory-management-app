import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  registerOutboundTransaction,
  type RegisterOutboundTransactionResult,
} from "./register-outbound-transaction";

type RpcResult = {
  readonly data: string | null;
  readonly error: { readonly message: string } | null;
};

type RpcArgs = {
  readonly p_item_id: string;
  readonly p_quantity: number;
  readonly p_transaction_date: string;
  readonly p_note: string | null;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("registerOutboundTransaction", () => {
  it("正常系では RPC を呼び出して再検証する", async () => {
    const rpc = jest.fn<(
      functionName: string,
      args: RpcArgs,
    ) => Promise<RpcResult>>().mockResolvedValue({
      data: "txn-1",
      error: null,
    });

    const revalidateCalls: Array<[string, "layout" | "page" | undefined]> = [];
    const revalidate = (
      originalPath: string,
      type?: "layout" | "page",
    ): undefined => {
      revalidateCalls.push([originalPath, type]);
      return undefined;
    };

    const result = (await registerOutboundTransaction(
      {
        itemId: "11111111-1111-4111-8111-111111111111",
        quantity: "2",
        transactionDate: "2026-04-29",
        note: "  メモ  ",
      },
      {
        createClient: () => ({ rpc } as never),
        revalidate,
      },
    )) as RegisterOutboundTransactionResult;

    expect(result).toEqual({
      success: true,
      transactionId: "txn-1",
    });
    expect(rpc).toHaveBeenCalledWith("register_outbound_transaction", {
      p_item_id: "11111111-1111-4111-8111-111111111111",
      p_quantity: 2,
      p_transaction_date: "2026-04-29",
      p_note: "メモ",
    });
    expect(revalidateCalls).toEqual([
      ["/", undefined],
      ["/outbound", undefined],
    ]);
  });

  it("在庫超過エラーをユーザー向けメッセージに変換する", async () => {
    const rpc = jest.fn<(
      functionName: string,
      args: RpcArgs,
    ) => Promise<RpcResult>>().mockResolvedValue({
      data: null,
      error: { message: "quantity exceeds current stock" },
    });

    const revalidateCalls: Array<[string, "layout" | "page" | undefined]> = [];
    const revalidate = (
      originalPath: string,
      type?: "layout" | "page",
    ): undefined => {
      revalidateCalls.push([originalPath, type]);
      return undefined;
    };

    const result = await registerOutboundTransaction(
      {
        itemId: "11111111-1111-4111-8111-111111111111",
        quantity: "999",
        transactionDate: "2026-04-29",
        note: "",
      },
      {
        createClient: () => ({ rpc } as never),
        revalidate,
      },
    );

    expect(result).toEqual({
      success: false,
      message: "現在在庫数を超える出庫は登録できません。",
    });
    expect(revalidateCalls).toEqual([]);
  });
});
