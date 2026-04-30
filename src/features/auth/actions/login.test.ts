import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { login, type CreateLoginDependencies } from "./login";

type ActionError = {
  readonly message: string;
  readonly status?: number;
};

type MockClientOptions = {
  readonly authUserId?: string | null;
  readonly loginError?: ActionError | null;
  readonly profile?: { readonly id: string } | null;
  readonly profileLookupError?: ActionError | null;
  readonly signOutError?: ActionError | null;
};

type Repository = Awaited<
  ReturnType<NonNullable<CreateLoginDependencies["createRepository"]>>
>;

const VALID_INPUT = {
  email: "  user@example.com  ",
  password: " password123 ",
};

function createMockClient(options: MockClientOptions = {}) {
  const loginWithPassword = jest.fn<(
    values: {
      readonly email: string;
      readonly password: string;
    },
  ) => Promise<{
    readonly data: {
      readonly user: { readonly id: string } | null;
    };
    readonly error: ActionError | null;
  }>>().mockResolvedValue({
    data: {
      user:
        options.authUserId === null
          ? null
          : { id: options.authUserId ?? "auth-user-1" },
    },
    error: options.loginError ?? null,
  });
  const findUserProfileByUserId = jest.fn<(userId: string) => Promise<{
    readonly data: { readonly id: string } | null;
    readonly error: ActionError | null;
  }>>().mockResolvedValue({
    data:
      "profile" in options
        ? (options.profile ?? null)
        : { id: options.authUserId ?? "auth-user-1" },
    error: options.profileLookupError ?? null,
  });
  const signOut = jest.fn<() => Promise<{
    readonly error: ActionError | null;
  }>>().mockResolvedValue({
    error: options.signOutError ?? null,
  });
  const repository: Repository = {
    findUserProfileByUserId,
    loginWithPassword,
    signOut,
  };

  return {
    findUserProfileByUserId,
    loginWithPassword,
    repository,
    signOut,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("login", () => {
  it("zod 検証に失敗した場合は Supabase を呼ばない", async () => {
    const createRepository = jest.fn<() => Repository>();

    const result = await login(
      {
        email: "",
        password: "",
      },
      {
        createRepository,
      },
    );

    expect(result.success).toBe(false);
    expect(createRepository).not.toHaveBeenCalled();
  });

  it("Supabase Auth の認証失敗時に汎用メッセージを返す", async () => {
    const { findUserProfileByUserId, repository, signOut } = createMockClient({
      loginError: {
        message: "Invalid login credentials",
        status: 400,
      },
    });

    const result = await login(VALID_INPUT, {
      createRepository: () => repository,
    });

    expect(result).toEqual({
      success: false,
      message: "メールアドレスまたはパスワードが正しくありません",
    });
    expect(findUserProfileByUserId).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("想定外エラー時に汎用メッセージを返す", async () => {
    const { findUserProfileByUserId, repository, signOut } = createMockClient({
      loginError: {
        message: "database unavailable",
        status: 503,
      },
    });

    const result = await login(VALID_INPUT, {
      createRepository: () => repository,
    });

    expect(result).toEqual({
      success: false,
      message: "ログインに失敗しました。時間をおいて再度お試しください",
    });
    expect(findUserProfileByUserId).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("プロフィールが存在しない Auth ユーザーはサインアウトしてログイン失敗にする", async () => {
    const { findUserProfileByUserId, repository, signOut } = createMockClient({
      authUserId: "auth-user-without-profile",
      profile: null,
    });

    const result = await login(VALID_INPUT, {
      createRepository: () => repository,
    });

    expect(findUserProfileByUserId).toHaveBeenCalledWith(
      "auth-user-without-profile",
    );
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: false,
      message: "メールアドレスまたはパスワードが正しくありません",
    });
  });

  it("プロフィール確認でエラーが発生した場合はサインアウトして汎用メッセージを返す", async () => {
    const { repository, signOut } = createMockClient({
      profileLookupError: {
        message: "profile lookup failed",
        status: 500,
      },
    });

    const result = await login(VALID_INPUT, {
      createRepository: () => repository,
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: false,
      message: "ログインに失敗しました。時間をおいて再度お試しください",
    });
  });

  it("正常時に signInWithPassword 相当の処理を正しい値で呼び出す", async () => {
    const { findUserProfileByUserId, loginWithPassword, repository, signOut } =
      createMockClient();

    const result = await login(VALID_INPUT, {
      createRepository: () => repository,
    });

    expect(result).toEqual({ success: true });
    expect(loginWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: " password123 ",
    });
    expect(findUserProfileByUserId).toHaveBeenCalledWith("auth-user-1");
    expect(signOut).not.toHaveBeenCalled();
  });
});
