import { z } from "zod";

export const ACCOUNT_SIGNUP_FIELD_NAMES = [
  "email",
  "password",
  "passwordConfirmation",
  "username",
] as const;

export type AccountSignupFieldName =
  (typeof ACCOUNT_SIGNUP_FIELD_NAMES)[number];

export type AccountSignupFieldErrors = Partial<
  Record<AccountSignupFieldName, string>
>;

export const accountSignupSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "メールアドレスを入力してください")
      .email("正しいメールアドレスを入力してください"),
    password: z
      .string()
      .min(1, "パスワードを入力してください")
      .min(8, "パスワードは8文字以上で入力してください"),
    passwordConfirmation: z
      .string()
      .min(1, "パスワード確認を入力してください"),
    username: z.string().trim().min(1, "ユーザー名を入力してください"),
  })
  .refine(
    (values) => values.password === values.passwordConfirmation,
    {
      message: "パスワードが一致しません",
      path: ["passwordConfirmation"],
    },
  );

export type AccountSignupInput = z.input<typeof accountSignupSchema>;
export type AccountSignupValues = z.output<typeof accountSignupSchema>;

export function toAccountSignupFieldErrors(
  issues: readonly z.core.$ZodIssue[],
): AccountSignupFieldErrors {
  const fieldErrors: AccountSignupFieldErrors = {};

  for (const issue of issues) {
    const [fieldName] = issue.path;

    if (
      fieldName === "email" ||
      fieldName === "password" ||
      fieldName === "passwordConfirmation" ||
      fieldName === "username"
    ) {
      fieldErrors[fieldName] ??= issue.message;
    }
  }

  return fieldErrors;
}
