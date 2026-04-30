import type { ReactNode } from "react";

type AuthLayoutProps = {
  readonly children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-8 text-zinc-950">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
