import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { hasAuthenticatedUser, type AuthGuardRepository } from "./auth-guard";

type ActionError = {
  readonly message: string;
  readonly status?: number;
};

type MockRepositoryOptions = {
  readonly userId?: string | null;
  readonly getUserError?: ActionError | null;
  readonly profile?: { readonly id: string } | null;
  readonly profileLookupError?: ActionError | null;
};

function createMockRepository(options: MockRepositoryOptions = {}) {
  const getCurrentUser = jest.fn<AuthGuardRepository["getCurrentUser"]>()
    .mockResolvedValue({
      data: {
        user:
          options.userId === null
            ? null
            : { id: options.userId ?? "auth-user-1" },
      },
      error: options.getUserError ?? null,
    });
  const findUserProfileByUserId = jest.fn<
    AuthGuardRepository["findUserProfileByUserId"]
  >().mockResolvedValue({
    data:
      "profile" in options
        ? (options.profile ?? null)
        : { id: options.userId ?? "auth-user-1" },
    error: options.profileLookupError ?? null,
  });
  const repository: AuthGuardRepository = {
    findUserProfileByUserId,
    getCurrentUser,
  };

  return {
    findUserProfileByUserId,
    getCurrentUser,
    repository,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("hasAuthenticatedUser", () => {
  it("未ログインの場合は false を返し、プロフィールを確認しない", async () => {
    const { findUserProfileByUserId, repository } = createMockRepository({
      userId: null,
    });

    const result = await hasAuthenticatedUser(repository);

    expect(result).toBe(false);
    expect(findUserProfileByUserId).not.toHaveBeenCalled();
  });

  it("プロフィールが存在しない場合は false を返す", async () => {
    const { findUserProfileByUserId, repository } = createMockRepository({
      profile: null,
      userId: "auth-user-without-profile",
    });

    const result = await hasAuthenticatedUser(repository);

    expect(result).toBe(false);
    expect(findUserProfileByUserId).toHaveBeenCalledWith(
      "auth-user-without-profile",
    );
  });

  it("ログイン済みでプロフィールが存在する場合は true を返す", async () => {
    const { findUserProfileByUserId, repository } = createMockRepository({
      userId: "auth-user-1",
    });

    const result = await hasAuthenticatedUser(repository);

    expect(result).toBe(true);
    expect(findUserProfileByUserId).toHaveBeenCalledWith("auth-user-1");
  });
});
