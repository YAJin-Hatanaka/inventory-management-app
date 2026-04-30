import { NextResponse } from "next/server";
import { createAccount } from "@/features/auth/actions/create-account";
import type { CreateAccountResult } from "@/features/auth/types/account-signup";

const GENERIC_SIGNUP_FAILURE_MESSAGE =
  "アカウント作成に失敗しました。時間をおいて再度お試しください";

function createGenericFailureResponse(status: number) {
  const result: CreateAccountResult = {
    success: false,
    message: GENERIC_SIGNUP_FAILURE_MESSAGE,
  };

  return NextResponse.json(result, { status });
}

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return createGenericFailureResponse(400);
  }

  try {
    const result = await createAccount(input);

    return NextResponse.json(result, {
      status: result.success ? 201 : 400,
    });
  } catch (error) {
    console.error(error);

    return createGenericFailureResponse(500);
  }
}
