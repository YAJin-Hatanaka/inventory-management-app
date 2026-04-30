import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { performLogout, type CreateLogoutDependencies } from "./logout";

type ActionError = {
  readonly message: string;
};

type MockClientOptions = {
  readonly signOutError?: ActionError | null;
};

type Repository = Awaited<
  ReturnType<NonNullable<CreateLogoutDependencies["createRepository"]>>
>;

function createMockClient(options: MockClientOptions = {}) {
  const signOut = jest.fn<() => Promise<{
    readonly error: ActionError | null;
  }>>().mockResolvedValue({
    error: options.signOutError ?? null,
  });
  const repository: Repository = {
    signOut,
  };

  return {
    repository,
    signOut,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("performLogout", () => {
  it("正常時に Supabase の signOut 相当の処理を呼び出す", async () => {
    const { repository, signOut } = createMockClient();

    const result = await performLogout({
      createRepository: () => repository,
    });

    expect(result).toEqual({ success: true });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("signOut 失敗時に汎用メッセージを返す", async () => {
    const { repository, signOut } = createMockClient({
      signOutError: { message: "sign out failed" },
    });

    const result = await performLogout({
      createRepository: () => repository,
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: false,
      message: "ログアウトに失敗しました",
    });
  });

  it("例外発生時に汎用メッセージを返す", async () => {
    const createRepository = jest.fn<() => Repository>(() => {
      throw new Error("unexpected");
    });

    const result = await performLogout({
      createRepository,
    });

    expect(result).toEqual({
      success: false,
      message: "ログアウトに失敗しました",
    });
  });
});
