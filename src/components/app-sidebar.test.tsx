import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, jest } from "@jest/globals";

let AppSidebar: typeof import("./app-sidebar").AppSidebar;

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

beforeAll(async () => {
  ({ AppSidebar } = await import("./app-sidebar"));
});

describe("AppSidebar", () => {
  it("メインメニューとログアウトボタンを表示する", () => {
    render(<AppSidebar role="admin" />);

    expect(screen.getByRole("link", { name: "在庫一覧" }).getAttribute("href"))
      .toBe("/");
    expect(screen.getByRole("link", { name: "入庫登録" }).getAttribute("href"))
      .toBe("/inbound");
    expect(screen.getByRole("link", { name: "出庫登録" }).getAttribute("href"))
      .toBe("/outbound");
    expect(
      screen.getByRole("link", { name: "品目マスタ管理" }).getAttribute("href"),
    ).toBe("/items");
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeTruthy();
  });

  it("一般ユーザーには在庫一覧のみ表示する", () => {
    render(<AppSidebar role="general" />);

    expect(screen.getByRole("link", { name: "在庫一覧" }).getAttribute("href"))
      .toBe("/");
    expect(screen.queryByRole("link", { name: "入庫登録" })).toBeNull();
    expect(screen.queryByRole("link", { name: "出庫登録" })).toBeNull();
    expect(screen.queryByRole("link", { name: "品目マスタ管理" })).toBeNull();
    expect(screen.queryByRole("link", { name: "ユーザー管理" })).toBeNull();
  });
});
