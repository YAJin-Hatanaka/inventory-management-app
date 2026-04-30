import { z } from "zod";

export const LOGIN_FIELD_NAMES = ["email", "password"] as const;

export type LoginFieldName = (typeof LOGIN_FIELD_NAMES)[number];

export type LoginFieldErrors = Partial<Record<LoginFieldName, string>>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください")
    .email("正しいメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;

export function toLoginFieldErrors(
  issues: readonly z.core.$ZodIssue[],
): LoginFieldErrors {
  const fieldErrors: LoginFieldErrors = {};

  for (const issue of issues) {
    const [fieldName] = issue.path;

    if (fieldName === "email" || fieldName === "password") {
      fieldErrors[fieldName] ??= issue.message;
    }
  }

  return fieldErrors;
}
