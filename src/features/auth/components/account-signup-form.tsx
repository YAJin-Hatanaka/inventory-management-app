"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { CheckCircle2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  accountSignupSchema,
  type AccountSignupFieldErrors,
  type AccountSignupInput,
  type AccountSignupValues,
} from "../schemas/account-signup-schema";
import type { CreateAccountResult } from "../types/account-signup";

type AccountSignupFormProps = {
  readonly submitAccount?: (
    values: AccountSignupValues,
  ) => Promise<CreateAccountResult>;
};

const GENERIC_SIGNUP_FAILURE_MESSAGE =
  "アカウント作成に失敗しました。時間をおいて再度お試しください";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAccountSignupFieldErrors(
  value: unknown,
): value is AccountSignupFieldErrors {
  return (
    isObject(value) &&
    Object.values(value).every(
      (fieldError) =>
        fieldError === undefined || typeof fieldError === "string",
    )
  );
}

function isCreateAccountResult(value: unknown): value is CreateAccountResult {
  if (!isObject(value) || typeof value.success !== "boolean") {
    return false;
  }

  if (value.success) {
    return true;
  }

  return (
    typeof value.message === "string" &&
    (value.fieldErrors === undefined ||
      isAccountSignupFieldErrors(value.fieldErrors))
  );
}

async function requestCreateAccount(
  values: AccountSignupValues,
): Promise<CreateAccountResult> {
  const response = await fetch("/api/signup", {
    body: JSON.stringify(values),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const result: unknown = await response.json();

  if (isCreateAccountResult(result)) {
    return result;
  }

  return {
    success: false,
    message: GENERIC_SIGNUP_FAILURE_MESSAGE,
  };
}

export function AccountSignupForm({
  submitAccount = requestCreateAccount,
}: AccountSignupFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<AccountSignupInput, unknown, AccountSignupValues>({
    resolver: zodResolver(accountSignupSchema),
    defaultValues: {
      email: "",
      password: "",
      passwordConfirmation: "",
      username: "",
    },
  });

  async function handleValidSubmit(values: AccountSignupValues) {
    setServerError(null);

    const result: CreateAccountResult = await submitAccount(values).catch(
      (error: unknown) => {
        console.error(error);

        const failureResult: CreateAccountResult = {
          success: false,
          message: GENERIC_SIGNUP_FAILURE_MESSAGE,
        };

        return failureResult;
      },
    );

    if (!result.success) {
      setServerError(result.message);

      if (result.fieldErrors !== undefined) {
        for (const [fieldName, message] of Object.entries(result.fieldErrors)) {
          if (message !== undefined) {
            setError(fieldName as keyof AccountSignupInput, {
              message,
              type: "server",
            });
          }
        }
      }

      return;
    }

    setIsCompleted(true);
  }

  if (isCompleted) {
    return (
      <section className="w-full border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-emerald-600"
            />
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold text-zinc-950">
                アカウント作成が完了しました。
              </h1>
              <p className="text-sm text-zinc-600">ログインしてください。</p>
            </div>
          </div>
          <Link
            className="inline-flex h-10 w-fit items-center justify-center bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800"
            href="/login"
          >
            ログイン画面へ
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <form className="flex flex-col gap-5" onSubmit={handleSubmit(handleValidSubmit)}>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-zinc-950">
            アカウント作成
          </h1>
          <p className="text-sm text-zinc-500">
            利用開始に必要な情報を入力してください。
          </p>
        </div>

        {serverError !== null ? (
          <p
            className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {serverError}
          </p>
        ) : null}

        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          メールアドレス
          <input
            autoComplete="email"
            className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100"
            disabled={isSubmitting}
            inputMode="email"
            type="email"
            {...register("email", {
              onChange: () => {
                setServerError(null);
              },
            })}
          />
          {errors.email !== undefined ? (
            <span className="text-sm text-red-600" role="alert">
              {errors.email.message}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          ユーザー名
          <input
            autoComplete="name"
            className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100"
            disabled={isSubmitting}
            type="text"
            {...register("username", {
              onChange: () => {
                setServerError(null);
              },
            })}
          />
          {errors.username !== undefined ? (
            <span className="text-sm text-red-600" role="alert">
              {errors.username.message}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          パスワード
          <input
            autoComplete="new-password"
            className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100"
            disabled={isSubmitting}
            type="password"
            {...register("password", {
              onChange: () => {
                setServerError(null);
              },
            })}
          />
          {errors.password !== undefined ? (
            <span className="text-sm text-red-600" role="alert">
              {errors.password.message}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          パスワード確認
          <input
            autoComplete="new-password"
            className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100"
            disabled={isSubmitting}
            type="password"
            {...register("passwordConfirmation", {
              onChange: () => {
                setServerError(null);
              },
            })}
          />
          {errors.passwordConfirmation !== undefined ? (
            <span className="text-sm text-red-600" role="alert">
              {errors.passwordConfirmation.message}
            </span>
          ) : null}
        </label>

        <button
          className="inline-flex h-10 items-center justify-center gap-2 bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={isSubmitting}
          type="submit"
        >
          <UserPlus aria-hidden="true" className="size-4" />
          {isSubmitting ? "作成中" : "アカウント作成"}
        </button>

        <p className="text-sm text-zinc-600">
          既にアカウントをお持ちですか？{" "}
          <Link className="font-medium text-zinc-950 underline" href="/login">
            ログイン
          </Link>
        </p>
      </form>
    </section>
  );
}
