import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/features/auth/lib/server-permissions";

export async function GET() {
  try {
    const currentUserRole = await getCurrentUserRole();

    if (currentUserRole === null) {
      return NextResponse.json(
        { message: "ログインが必要です。" },
        { status: 401 },
      );
    }

    return NextResponse.json({ role: currentUserRole.role });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "権限情報を取得できませんでした。" },
      { status: 500 },
    );
  }
}
