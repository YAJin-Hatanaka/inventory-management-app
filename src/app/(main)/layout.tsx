import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { requireCurrentUserRole } from "@/features/auth/lib/server-permissions";

type MainLayoutProps = {
  readonly children: ReactNode;
};

export default async function MainLayout({ children }: MainLayoutProps) {
  const currentUserRole = await requireCurrentUserRole();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 md:flex">
      <AppSidebar role={currentUserRole.role} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          {children}
        </div>
      </main>
    </div>
  );
}
