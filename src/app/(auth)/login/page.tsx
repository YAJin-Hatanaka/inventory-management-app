import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = {
  title: "ログイン | 在庫管理システム",
};

export default function LoginPage() {
  return <LoginForm />;
}
