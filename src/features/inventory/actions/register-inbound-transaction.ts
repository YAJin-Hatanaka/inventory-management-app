"use server";

import { revalidatePath } from "next/cache";
import {
  inboundRegistrationSchema,
  type InboundRegistrationInput,
} from "../schemas/inbound-registration-schema";
import {
  getUnauthorizedMessage,
  hasInventoryTransactionPermission,
} from "@/features/auth/lib/server-permissions";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type RegisterInboundTransactionResult =
  | {
      readonly success: true;
      readonly transactionId: string;
    }
  | {
      readonly success: false;
      readonly message: string;
    };

type RegisterInboundTransactionDependencies = {
  readonly createClient?: typeof createServiceRoleClient;
  readonly revalidate?: typeof revalidatePath;
  readonly authorize?: () => Promise<boolean>;
};

export async function registerInboundTransaction(
  input: InboundRegistrationInput,
  dependencies: RegisterInboundTransactionDependencies = {},
): Promise<RegisterInboundTransactionResult> {
  try {
    const parsedInput = inboundRegistrationSchema.safeParse(input);

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
    const { itemName, category, unit, quantity, transactionDate, note } =
      parsedInput.data;

    const { data, error } = await supabase.rpc("register_inbound_transaction", {
      p_item_name: itemName,
      p_category: category,
      p_quantity: quantity,
      p_transaction_date: transactionDate,
      p_note: note,
      p_unit: unit,
    });

    if (error !== null) {
      console.error(error);

      return {
        success: false,
        message: "入庫登録に失敗しました。",
      };
    }

    revalidate("/");
    revalidate("/inbound");

    return {
      success: true,
      transactionId: data,
    };
  } catch (error) {
    console.error(error);

    return {
      success: false,
      message: "入庫登録に失敗しました。",
    };
  }
}
