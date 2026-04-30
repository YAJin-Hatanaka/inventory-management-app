import { describe, expect, it } from "@jest/globals";
import { accountSignupSchema } from "./account-signup-schema";

const VALID_INPUT = {
  email: "user@example.com",
  password: "password123",
  passwordConfirmation: "password123",
  username: "山田太郎",
};

describe("accountSignupSchema", () => {
  it("正常な入力を受け付け、メールアドレスとユーザー名を trim する", () => {
    const result = accountSignupSchema.safeParse({
      ...VALID_INPUT,
      email: "  user@example.com  ",
      username: "  山田太郎  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(VALID_INPUT);
    }
  });

  it("必須項目未入力をエラーにする", () => {
    const result = accountSignupSchema.safeParse({
      email: "",
      password: "",
      passwordConfirmation: "",
      username: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          "メールアドレスを入力してください",
          "パスワードを入力してください",
          "パスワード確認を入力してください",
          "ユーザー名を入力してください",
        ]),
      );
    }
  });

  it("メールアドレス形式不正をエラーにする", () => {
    const result = accountSignupSchema.safeParse({
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

  it("パスワードが8文字未満の場合にエラーにする", () => {
    const result = accountSignupSchema.safeParse({
      ...VALID_INPUT,
      password: "short",
      passwordConfirmation: "short",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "パスワードは8文字以上で入力してください",
      );
    }
  });

  it("パスワード確認が一致しない場合にエラーにする", () => {
    const result = accountSignupSchema.safeParse({
      ...VALID_INPUT,
      passwordConfirmation: "different123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("パスワードが一致しません");
    }
  });
});
