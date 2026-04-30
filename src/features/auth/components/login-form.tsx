"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  loginSchema,
  type LoginFieldErrors,
  type LoginInput,
  type LoginValues,
} from "../schemas/login-schema";
import type { LoginResult } from "../types/login";

type LoginFormProps = {
  readonly submitLogin?: (values: LoginValues) => Promise<LoginResult>;
};

const GENERIC_LOGIN_FAILURE_MESSAGE =
  "ログインに失敗しました。時間をおいて再度お試しください";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLoginFieldErrors(value: unknown): value is LoginFieldErrors {
  return (
    isObject(value) &&
    Object.values(value).every(
      (fieldError) =>
        fieldError === undefined || typeof fieldError === "string",
    )
  );
}

function isLoginResult(value: unknown): value is LoginResult {
  if (!isObject(value) || typeof value.success !== "boolean") {
    return false;
  }

  if (value.success) {
    return true;
  }

  return (
    typeof value.message === "string" &&
    (value.fieldErrors === undefined || isLoginFieldErrors(value.fieldErrors))
  );
}

async function requestLogin(values: LoginValues): Promise<LoginResult> {
  const response = await fetch("/api/login", {
    body: JSON.stringify(values),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const result: unknown = await response.json();

  if (isLoginResult(result)) {
    return result;
  }

  return {
    success: false,
    message: GENERIC_LOGIN_FAILURE_MESSAGE,
  };
}

export function LoginForm({ submitLogin = requestLogin }: LoginFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function handleValidSubmit(values: LoginValues) {
    setServerError(null);

    const result: LoginResult = await submitLogin(values).catch(
      (error: unknown) => {
        console.error(error);

        const failureResult: LoginResult = {
          success: false,
          message: GENERIC_LOGIN_FAILURE_MESSAGE,
        };

        return failureResult;
      },
    );

    if (!result.success) {
      setServerError(result.message);

      if (result.fieldErrors !== undefined) {
        for (const [fieldName, message] of Object.entries(result.fieldErrors)) {
          if (message !== undefined) {
            setError(fieldName as keyof LoginInput, {
              message,
              type: "server",
            });
          }
        }
      }

      return;
    }

    router.replace("/");
  }

  return (
    <section className="w-full border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <form
        className="flex flex-col gap-5"
        onSubmit={handleSubmit(handleValidSubmit)}
      >
        <h1 className="text-xl font-semibold text-zinc-950">ログイン</h1>

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
          パスワード
          <input
            autoComplete="current-password"
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

        <button
          className="inline-flex h-10 items-center justify-center gap-2 bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={isSubmitting}
          type="submit"
        >
          <LogIn aria-hidden="true" className="size-4" />
          {isSubmitting ? "ログイン中" : "ログイン"}
        </button>

        <p className="text-sm text-zinc-600">
          アカウントをお持ちでないですか？{" "}
          <Link className="font-medium text-zinc-950 underline" href="/signup">
            アカウント作成
          </Link>
        </p>
      </form>
    </section>
  );
}
