import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, jest } from "@jest/globals";
import { AccountSignupForm } from "./account-signup-form";
import type { AccountSignupValues } from "../schemas/account-signup-schema";
import type { CreateAccountResult } from "../types/account-signup";

function renderForm(
  result: CreateAccountResult | Promise<CreateAccountResult> = {
    success: true,
  },
) {
  const submitAccount = jest.fn<
    (values: AccountSignupValues) => Promise<CreateAccountResult>
  >().mockImplementation(async () => result);

  render(<AccountSignupForm submitAccount={submitAccount} />);

  return { submitAccount };
}

describe("AccountSignupForm", () => {
  it("入力欄とアカウント作成ボタンを表示し、権限選択 UI は表示しない", () => {
    renderForm();

    expect(screen.getByLabelText("メールアドレス")).toBeTruthy();
    expect(screen.getByLabelText("ユーザー名")).toBeTruthy();
    expect(screen.getByLabelText("パスワード")).toBeTruthy();
    expect(screen.getByLabelText("パスワード確認")).toBeTruthy();
    expect(screen.getByRole("button", { name: "アカウント作成" })).toBeTruthy();
    expect(screen.queryByText("権限")).toBeNull();
  });

  it("入力エラーを対象項目付近に表示する", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "アカウント作成" }));

    expect(await screen.findByText("メールアドレスを入力してください")).toBeTruthy();
    expect(screen.getByText("ユーザー名を入力してください")).toBeTruthy();
    expect(screen.getByText("パスワードを入力してください")).toBeTruthy();
    expect(screen.getByText("パスワード確認を入力してください")).toBeTruthy();
  });

  it("送信中にボタンを無効化する", async () => {
    let resolveSubmit: (result: CreateAccountResult) => void = () => {};
    const submitPromise = new Promise<CreateAccountResult>((resolve) => {
      resolveSubmit = resolve;
    });
    const { submitAccount } = renderForm(submitPromise);

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("ユーザー名"), {
      target: { value: "山田太郎" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("パスワード確認"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "アカウント作成" }));

    await waitFor(() => {
      expect(submitAccount).toHaveBeenCalledTimes(1);
    });
    expect(
      (screen.getByRole("button", { name: "作成中" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    resolveSubmit({ success: true });
  });

  it("正常な入力で Server Action を呼び出し、成功時に完了メッセージとログインリンクを表示する", async () => {
    const { submitAccount } = renderForm();

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("ユーザー名"), {
      target: { value: "山田太郎" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("パスワード確認"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "アカウント作成" }));

    await waitFor(() => {
      expect(submitAccount).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
        passwordConfirmation: "password123",
        username: "山田太郎",
      });
    });
    expect(
      screen.getByText("アカウント作成が完了しました。"),
    ).toBeTruthy();
    expect(screen.getByText("ログインしてください。")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "ログイン画面へ" }).getAttribute("href"),
    ).toBe("/login");
  });

  it("Server Action の fieldErrors を項目に反映する", async () => {
    renderForm({
      success: false,
      message: "このユーザー名はすでに使用されています",
      fieldErrors: {
        username: "このユーザー名はすでに使用されています",
      },
    });

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("ユーザー名"), {
      target: { value: "山田太郎" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("パスワード確認"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "アカウント作成" }));

    expect(
      await screen.findAllByText("このユーザー名はすでに使用されています"),
    ).toHaveLength(2);
  });
});
