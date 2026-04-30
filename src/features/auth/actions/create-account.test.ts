import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  createAccount,
  type CreateAccountDependencies,
} from "./create-account";

type ActionError = {
  readonly message: string;
  readonly code?: string;
};

type MockClientOptions = {
  readonly existingProfile?: { readonly id: string } | null;
  readonly usernameLookupError?: ActionError | null;
  readonly authUserId?: string | null;
  readonly authError?: ActionError | null;
  readonly profileInsertError?: ActionError | null;
  readonly deleteUserError?: ActionError | null;
};

type Repository = ReturnType<
  NonNullable<CreateAccountDependencies["createRepository"]>
>;

const VALID_INPUT = {
  email: "  user@example.com  ",
  password: "password123",
  passwordConfirmation: "password123",
  username: "  山田太郎  ",
};

function createMockClient(options: MockClientOptions = {}) {
  const findUserProfileByUsername = jest.fn<(username: string) => Promise<{
    readonly data: { readonly id: string } | null;
    readonly error: ActionError | null;
  }>>().mockResolvedValue({
    data: options.existingProfile ?? null,
    error: options.usernameLookupError ?? null,
  });
  const createUserProfile = jest.fn<(
    values: {
      readonly id: string;
      readonly username: string;
      readonly role: "general";
    },
  ) => Promise<{
    readonly error: ActionError | null;
  }>>().mockResolvedValue({
    error: options.profileInsertError ?? null,
  });
  const createAuthUser = jest.fn<(
    attributes: {
      readonly email: string;
      readonly password: string;
      readonly email_confirm: boolean;
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
    error: options.authError ?? null,
  });
  const deleteAuthUser = jest.fn<(userId: string) => Promise<{
    readonly error: ActionError | null;
  }>>().mockResolvedValue({
    error: options.deleteUserError ?? null,
  });
  const repository: Repository = {
    createAuthUser,
    createUserProfile,
    deleteAuthUser,
    findUserProfileByUsername,
  };

  return {
    createAuthUser,
    createUserProfile,
    deleteAuthUser,
    findUserProfileByUsername,
    repository,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createAccount", () => {
  it("zod 検証に失敗した場合は Supabase を呼ばない", async () => {
    const createRepository = jest.fn<() => Repository>();

    const result = await createAccount(
      {
        email: "",
        password: "",
        passwordConfirmation: "",
        username: "",
      },
      {
        checkRateLimit: async () => true,
        createRepository,
      },
    );

    expect(result.success).toBe(false);
    expect(createRepository).not.toHaveBeenCalled();
  });

  it("ユーザー名重複時に専用メッセージを返す", async () => {
    const { createAuthUser, repository } = createMockClient({
      existingProfile: { id: "existing-user" },
    });

    const result = await createAccount(VALID_INPUT, {
      checkRateLimit: async () => true,
      createRepository: () => repository,
    });

    expect(result).toEqual({
      success: false,
      message: "このユーザー名はすでに使用されています",
      fieldErrors: {
        username: "このユーザー名はすでに使用されています",
      },
    });
    expect(createAuthUser).not.toHaveBeenCalled();
  });

  it("Auth 作成失敗時に汎用メッセージを返す", async () => {
    const { repository } = createMockClient({
      authError: { message: "email already registered" },
    });

    const result = await createAccount(VALID_INPUT, {
      checkRateLimit: async () => true,
      createRepository: () => repository,
    });

    expect(result).toEqual({
      success: false,
      message: "アカウント作成に失敗しました。入力内容を確認してください",
    });
  });

  it("メールアドレス重複時に登録済みであることを示さず、エラーログも出さない", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const { repository } = createMockClient({
      authError: {
        code: "email_exists",
        message: "A user with this email address has already been registered",
      },
    });

    const result = await createAccount(VALID_INPUT, {
      checkRateLimit: async () => true,
      createRepository: () => repository,
    });

    expect(result).toEqual({
      success: false,
      message: "アカウント作成に失敗しました。入力内容を確認してください",
    });
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("プロフィール保存失敗時に Auth ユーザー削除を呼ぶ", async () => {
    const { deleteAuthUser, repository } = createMockClient({
      authUserId: "auth-user-1",
      profileInsertError: { message: "database error" },
    });

    const result = await createAccount(VALID_INPUT, {
      checkRateLimit: async () => true,
      createRepository: () => repository,
    });

    expect(deleteAuthUser).toHaveBeenCalledWith("auth-user-1");
    expect(result).toEqual({
      success: false,
      message: "アカウント作成に失敗しました。時間をおいて再度お試しください",
    });
  });

  it("プロフィール保存失敗後の Auth ユーザー削除失敗時に汎用メッセージを返す", async () => {
    const { deleteAuthUser, repository } = createMockClient({
      authUserId: "auth-user-1",
      deleteUserError: { message: "delete failed" },
      profileInsertError: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      },
    });

    const result = await createAccount(VALID_INPUT, {
      checkRateLimit: async () => true,
      createRepository: () => repository,
    });

    expect(deleteAuthUser).toHaveBeenCalledWith("auth-user-1");
    expect(result).toEqual({
      success: false,
      message: "アカウント作成に失敗しました。時間をおいて再度お試しください",
    });
  });

  it("プロフィール保存時のユーザー名 UNIQUE 違反で専用メッセージを返す", async () => {
    const { deleteAuthUser, repository } = createMockClient({
      authUserId: "auth-user-1",
      profileInsertError: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      },
    });

    const result = await createAccount(VALID_INPUT, {
      checkRateLimit: async () => true,
      createRepository: () => repository,
    });

    expect(deleteAuthUser).toHaveBeenCalledWith("auth-user-1");
    expect(result).toEqual({
      success: false,
      message: "このユーザー名はすでに使用されています",
      fieldErrors: {
        username: "このユーザー名はすでに使用されています",
      },
    });
  });

  it("正常系では Auth とプロフィールを作成する", async () => {
    const { createAuthUser, createUserProfile, repository } = createMockClient({
      authUserId: "auth-user-1",
    });

    const result = await createAccount(VALID_INPUT, {
      checkRateLimit: async () => true,
      createRepository: () => repository,
    });

    expect(result).toEqual({ success: true });
    expect(createAuthUser).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
      email_confirm: true,
    });
    expect(createUserProfile).toHaveBeenCalledWith({
      id: "auth-user-1",
      username: "山田太郎",
      role: "general",
    });
  });
});
