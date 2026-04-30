import { describe, expect, it } from "@jest/globals";
import { loginSchema } from "./login-schema";

const VALID_INPUT = {
  email: "user@example.com",
  password: " password123 ",
};

describe("loginSchema", () => {
  it("正常な入力を受け付け、メールアドレスのみを trim する", () => {
    const result = loginSchema.safeParse({
      ...VALID_INPUT,
      email: "  user@example.com  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(VALID_INPUT);
    }
  });

  it("メールアドレス未入力をエラーにする", () => {
    const result = loginSchema.safeParse({
      ...VALID_INPUT,
      email: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "メールアドレスを入力してください",
      );
    }
  });

  it("メールアドレス形式不正をエラーにする", () => {
    const result = loginSchema.safeParse({
      ...VALID_INPUT,
      email: "invalid-email",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "正しいメールアドレスを入力してください",
      );
    }
  });

  it("パスワード未入力をエラーにする", () => {
    const result = loginSchema.safeParse({
      ...VALID_INPUT,
      password: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "パスワードを入力してください",
      );
    }
  });
});
