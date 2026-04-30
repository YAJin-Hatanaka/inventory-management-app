import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkAccountSignupRateLimit } from "../lib/account-signup-rate-limit";
import {
  accountSignupSchema,
  toAccountSignupFieldErrors,
} from "../schemas/account-signup-schema";
import type { CreateAccountResult } from "../types/account-signup";

const GENERIC_INPUT_FAILURE_MESSAGE =
  "アカウント作成に失敗しました。入力内容を確認してください";
const GENERIC_AUTH_FAILURE_MESSAGE =
  "アカウント作成に失敗しました。時間をおいて再度お試しください";
const USERNAME_ALREADY_USED_MESSAGE =
  "このユーザー名はすでに使用されています";

type ActionError = {
  readonly message: string;
  readonly code?: string;
};

type MaybeSingleResult = {
  readonly data: { readonly id: string } | null;
  readonly error: ActionError | null;
};

type InsertResult = {
  readonly error: ActionError | null;
};

type CreateUserResult = {
  readonly data: {
    readonly user: { readonly id: string } | null;
  };
  readonly error: ActionError | null;
};

type DeleteUserResult = {
  readonly error: ActionError | null;
};

type AccountSignupRepository = {
  readonly createAuthUser: (attributes: {
    readonly email: string;
    readonly password: string;
    readonly email_confirm: boolean;
  }) => Promise<CreateUserResult>;
  readonly createUserProfile: (values: {
    readonly id: string;
    readonly username: string;
    readonly role: "general";
  }) => Promise<InsertResult>;
  readonly deleteAuthUser: (userId: string) => Promise<DeleteUserResult>;
  readonly findUserProfileByUsername: (
    username: string,
  ) => Promise<MaybeSingleResult>;
};

export type CreateAccountDependencies = {
  readonly createRepository?: () => AccountSignupRepository;
  readonly checkRateLimit?: () => Promise<boolean>;
};

function createDefaultRepository(): AccountSignupRepository {
  const supabase = createServiceRoleClient();

  return {
    async createAuthUser(attributes) {
      const { data, error } = await supabase.auth.admin.createUser(attributes);

      return { data, error };
    },
    async createUserProfile(values) {
      const { error } = await supabase.from("user_profiles").insert(values);

      return { error };
    },
    async deleteAuthUser(userId) {
      const { error } = await supabase.auth.admin.deleteUser(userId);

      return { error };
    },
    async findUserProfileByUsername(username) {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      return { data, error };
    },
  };
}

function isUsernameUniqueViolation(error: ActionError): boolean {
  return (
    error.code === "23505" ||
    error.message.includes("user_profiles_username_key") ||
    error.message.includes("duplicate key")
  );
}

function isEmailAlreadyRegistered(error: ActionError): boolean {
  return (
    error.code === "email_exists" ||
    error.message.includes("email address has already been registered")
  );
}

async function deleteCreatedAuthUser(
  repository: AccountSignupRepository,
  userId: string,
): Promise<boolean> {
  const { error } = await repository.deleteAuthUser(userId);

  if (error !== null) {
    console.error(error);
    return false;
  }

  return true;
}

export async function createAccount(
  input: unknown,
  dependencies: CreateAccountDependencies = {},
): Promise<CreateAccountResult> {
  try {
    const parsedInput = accountSignupSchema.safeParse(input);

    if (!parsedInput.success) {
      return {
        success: false,
        message:
          parsedInput.error.issues[0]?.message ?? "入力内容を確認してください",
        fieldErrors: toAccountSignupFieldErrors(parsedInput.error.issues),
      };
    }

    const checkRateLimit =
      dependencies.checkRateLimit ?? checkAccountSignupRateLimit;
    const isAllowed = await checkRateLimit();

    if (!isAllowed) {
      return {
        success: false,
        message: GENERIC_AUTH_FAILURE_MESSAGE,
      };
    }

    const repositoryFactory =
      dependencies.createRepository ?? createDefaultRepository;
    const repository = repositoryFactory();
    const { email, password, username } = parsedInput.data;
    const { data: existingProfile, error: usernameLookupError } =
      await repository.findUserProfileByUsername(username);

    if (usernameLookupError !== null) {
      console.error(usernameLookupError);

      return {
        success: false,
        message: GENERIC_AUTH_FAILURE_MESSAGE,
      };
    }

    if (existingProfile !== null) {
      return {
        success: false,
        message: USERNAME_ALREADY_USED_MESSAGE,
        fieldErrors: {
          username: USERNAME_ALREADY_USED_MESSAGE,
        },
      };
    }

    const { data: authData, error: authError } =
      await repository.createAuthUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError !== null || authData.user === null) {
      if (authError !== null) {
        if (!isEmailAlreadyRegistered(authError)) {
          console.error(authError);
        }
      }

      return {
        success: false,
        message: GENERIC_INPUT_FAILURE_MESSAGE,
      };
    }

    const userId = authData.user.id;
    const { error: profileInsertError } = await repository.createUserProfile({
      id: userId,
      username,
      role: "general",
    });

    if (profileInsertError !== null) {
      const isAuthUserDeleted = await deleteCreatedAuthUser(repository, userId);

      if (!isAuthUserDeleted) {
        console.error({
          authUserId: userId,
          message: "Failed to delete Auth user after profile insert failure.",
        });

        return {
          success: false,
          message: GENERIC_AUTH_FAILURE_MESSAGE,
        };
      }

      if (isUsernameUniqueViolation(profileInsertError)) {
        return {
          success: false,
          message: USERNAME_ALREADY_USED_MESSAGE,
          fieldErrors: {
            username: USERNAME_ALREADY_USED_MESSAGE,
          },
        };
      }

      console.error(profileInsertError);

      return {
        success: false,
        message: GENERIC_AUTH_FAILURE_MESSAGE,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error(error);

    return {
      success: false,
      message: GENERIC_AUTH_FAILURE_MESSAGE,
    };
  }
}
