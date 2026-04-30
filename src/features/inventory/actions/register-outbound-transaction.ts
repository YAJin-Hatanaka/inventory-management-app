"use server";

import { revalidatePath } from "next/cache";
import {
  outboundRegistrationSchema,
  type OutboundRegistrationInput,
} from "../schemas/outbound-registration-schema";
import {
  getUnauthorizedMessage,
  hasInventoryTransactionPermission,
} from "@/features/auth/lib/server-permissions";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type RegisterOutboundTransactionResult =
  | {
      readonly success: true;
      readonly transactionId: string;
    }
  | {
      readonly success: false;
      readonly message: string;
    };

type RegisterOutboundTransactionDependencies = {
  readonly createClient?: typeof createServiceRoleClient;
  readonly revalidate?: typeof revalidatePath;
  readonly authorize?: () => Promise<boolean>;
};

function toOutboundRegistrationErrorMessage(message: string): string {
  if (message.includes("quantity exceeds current stock")) {
    return "現在在庫数を超える出庫は登録できません。";
  }

  if (message.includes("item does not exist")) {
    return "選択した品目が見つかりません。";
  }

  return "出庫登録に失敗しました。";
}

export async function registerOutboundTransaction(
  input: OutboundRegistrationInput,
  dependencies: RegisterOutboundTransactionDependencies = {},
): Promise<RegisterOutboundTransactionResult> {
  try {
    const parsedInput = outboundRegistrationSchema.safeParse(input);

    if (!parsedInput.success) {
      return {
        success: false,
        message:
          parsedInput.error.issues[0]?.message ?? "入力内容を確認してください。",
      };
    }

    const authorize =
      dependencies.authorize ??
      (dependencies.createClient === undefined
        ? hasInventoryTransactionPermission
        : async () => true);
    const isAuthorized = await authorize();

    if (!isAuthorized) {
      return {
        success: false,
        message: getUnauthorizedMessage(),
      };
    }

    const createClient =
      dependencies.createClient ?? createServiceRoleClient;
    const revalidate = dependencies.revalidate ?? revalidatePath;
    const supabase = createClient();
    const { itemId, quantity, transactionDate, note } = parsedInput.data;

    const { data, error } = await supabase.rpc("register_outbound_transaction", {
      p_item_id: itemId,
      p_quantity: quantity,
      p_transaction_date: transactionDate,
      p_note: note,
    });

    if (error !== null) {
      console.error(error);

      return {
        success: false,
        message: toOutboundRegistrationErrorMessage(error.message),
      };
    }

    revalidate("/");
    revalidate("/outbound");

    return {
      success: true,
      transactionId: data,
    };
  } catch (error) {
    console.error(error);

    return {
      success: false,
      message: "出庫登録に失敗しました。",
    };
  }
}
