import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  toLoginFieldErrors,
} from "../schemas/login-schema";
import type { LoginResult } from "../types/login";

const INVALID_CREDENTIALS_MESSAGE =
  "メールアドレスまたはパスワードが正しくありません";
const GENERIC_LOGIN_FAILURE_MESSAGE =
  "ログインに失敗しました。時間をおいて再度お試しください";

type ActionError = {
  readonly message: string;
  readonly status?: number;
};

type LoginWithPasswordResult = {
  readonly data: {
    readonly user: { readonly id: string } | null;
  };
  readonly error: ActionError | null;
};

type MaybeSingleResult = {
  readonly data: { readonly id: string } | null;
  readonly error: ActionError | null;
};

type SignOutResult = {
  readonly error: ActionError | null;
};

type LoginRepository = {
  readonly loginWithPassword: (values: {
    readonly email: string;
    readonly password: string;
  }) => Promise<LoginWithPasswordResult>;
  readonly findUserProfileByUserId: (
    userId: string,
  ) => Promise<MaybeSingleResult>;
  readonly signOut: () => Promise<SignOutResult>;
};

export type CreateLoginDependencies = {
  readonly createRepository?: () => Promise<LoginRepository> | LoginRepository;
};

async function createDefaultRepository(): Promise<LoginRepository> {
  const supabase = await createClient();

  return {
    async loginWithPassword(values) {
      const { data, error } = await supabase.auth.signInWithPassword(values);

      return {
        data: {
          user: data.user === null ? null : { id: data.user.id },
        },
        error,
      };
    },
    async findUserProfileByUserId(userId) {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      return { data, error };
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();

      return { error };
    },
  };
}

function isCredentialFailure(error: ActionError): boolean {
  return error.status === 400 || error.message === "Invalid login credentials";
}

async function signOutAfterRejectedLogin(
  repository: LoginRepository,
): Promise<void> {
  const { error } = await repository.signOut();

  if (error !== null) {
    console.error(error);
  }
}

export async function login(
  input: unknown,
  dependencies: CreateLoginDependencies = {},
): Promise<LoginResult> {
  try {
    const parsedInput = loginSchema.safeParse(input);

    if (!parsedInput.success) {
      return {
        success: false,
        message: parsedInput.error.issues[0]?.message ?? "入力内容を確認してください",
        fieldErrors: toLoginFieldErrors(parsedInput.error.issues),
      };
    }

    const repositoryFactory =
      dependencies.createRepository ?? createDefaultRepository;
    const repository = await repositoryFactory();
    const { data: authData, error } =
      await repository.loginWithPassword(parsedInput.data);

    if (error !== null) {
      console.error(error);

      return {
        success: false,
        message: isCredentialFailure(error)
          ? INVALID_CREDENTIALS_MESSAGE
          : GENERIC_LOGIN_FAILURE_MESSAGE,
      };
    }

    if (authData.user === null) {
      console.error({ message: "Supabase Auth returned no user on login." });

      return {
        success: false,
        message: GENERIC_LOGIN_FAILURE_MESSAGE,
      };
    }

    const { data: profile, error: profileLookupError } =
      await repository.findUserProfileByUserId(authData.user.id);

    if (profileLookupError !== null) {
      console.error(profileLookupError);
      await signOutAfterRejectedLogin(repository);

      return {
        success: false,
        message: GENERIC_LOGIN_FAILURE_MESSAGE,
      };
    }

    if (profile === null) {
      await signOutAfterRejectedLogin(repository);

      return {
        success: false,
        message: INVALID_CREDENTIALS_MESSAGE,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error(error);

    return {
      success: false,
      message: GENERIC_LOGIN_FAILURE_MESSAGE,
    };
  }
}
