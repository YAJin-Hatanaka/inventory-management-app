import type { Metadata } from "next";
import { AccountSignupForm } from "@/features/auth/components/account-signup-form";

export const metadata: Metadata = {
  title: "アカウント作成 | 在庫管理システム",
};

export default function SignupPage() {
  return <AccountSignupForm />;
}
