import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { LoginValues } from "../schemas/login-schema";
import type { LoginResult } from "../types/login";

const mockReplace = jest.fn();
let LoginForm: typeof import("./login-form").LoginForm;

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

beforeAll(async () => {
  ({ LoginForm } = await import("./login-form"));
});

function renderForm(
  result: LoginResult | Promise<LoginResult> = {
    success: true,
  },
) {
  const submitLogin = jest.fn<
    (values: LoginValues) => Promise<LoginResult>
  >().mockImplementation(async () => result);

  render(<LoginForm submitLogin={submitLogin} />);

  return { submitLogin };
}

describe("LoginForm", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it("入力欄、ログインボタン、アカウント作成リンクを表示する", () => {
    renderForm();

    expect(screen.getByLabelText("メールアドレス")).toBeTruthy();
    expect(screen.getByLabelText("パスワード")).toBeTruthy();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "アカウント作成" })
        .getAttribute("href"),
    ).toBe("/signup");
  });

  it("入力エラーを対象項目付近に表示する", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByText("メールアドレスを入力してください")).toBeTruthy();
    expect(screen.getByText("パスワードを入力してください")).toBeTruthy();
  });

  it("送信中にボタンを無効化する", async () => {
    let resolveSubmit: (result: LoginResult) => void = () => {};
    const submitPromise = new Promise<LoginResult>((resolve) => {
      resolveSubmit = resolve;
    });
    const { submitLogin } = renderForm(submitPromise);

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(submitLogin).toHaveBeenCalledTimes(1);
    });
    expect(
      (screen.getByRole("button", { name: "ログイン中" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    resolveSubmit({ success: true });
  });

  it("Server Action のエラーメッセージを表示する", async () => {
    renderForm({
      success: false,
      message: "メールアドレスまたはパスワードが正しくありません",
    });

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(
      await screen.findByText(
        "メールアドレスまたはパスワードが正しくありません",
      ),
    ).toBeTruthy();
  });

  it("正常な入力で Server Action を呼び出し、成功時に在庫一覧へ遷移する", async () => {
    const { submitLogin } = renderForm();

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "  user@example.com  " },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: " password123 " },
    });

    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(submitLogin).toHaveBeenCalledWith({
        email: "user@example.com",
        password: " password123 ",
      });
    });
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
