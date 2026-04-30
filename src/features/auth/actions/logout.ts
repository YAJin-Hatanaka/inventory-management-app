"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const LOGOUT_FAILURE_MESSAGE = "ログアウトに失敗しました";

type ActionError = {
  readonly message: string;
};

type SignOutResult = {
  readonly error: ActionError | null;
};

type LogoutRepository = {
  readonly signOut: () => Promise<SignOutResult>;
};

export type CreateLogoutDependencies = {
  readonly createRepository?: () => Promise<LogoutRepository> | LogoutRepository;
};

export type LogoutResult =
  | {
      readonly success: true;
    }
  | {
      readonly success: false;
      readonly message: string;
    };

async function createDefaultRepository(): Promise<LogoutRepository> {
  const supabase = await createClient();

  return {
    async signOut() {
      const { error } = await supabase.auth.signOut();

      return { error };
    },
  };
}

export async function performLogout(
  dependencies: CreateLogoutDependencies = {},
): Promise<LogoutResult> {
  try {
    const repositoryFactory =
      dependencies.createRepository ?? createDefaultRepository;
    const repository = await repositoryFactory();
    const { error } = await repository.signOut();

    if (error !== null) {
      console.error(error);

      return {
        success: false,
        message: LOGOUT_FAILURE_MESSAGE,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error(error);

    return {
      success: false,
      message: LOGOUT_FAILURE_MESSAGE,
    };
  }
}

export async function logout(): Promise<never> {
  await performLogout();
  redirect("/login");
}
