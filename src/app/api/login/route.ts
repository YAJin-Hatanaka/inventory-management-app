import { NextResponse } from "next/server";
import { login } from "@/features/auth/actions/login";
import type { LoginResult } from "@/features/auth/types/login";

const GENERIC_LOGIN_FAILURE_MESSAGE =
  "ログインに失敗しました。時間をおいて再度お試しください";

function createGenericFailureResponse(status: number) {
  const result: LoginResult = {
    success: false,
    message: GENERIC_LOGIN_FAILURE_MESSAGE,
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
    const result = await login(input);

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error(error);

    return createGenericFailureResponse(500);
  }
}
