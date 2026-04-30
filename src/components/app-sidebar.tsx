"use client";

import {
  Boxes,
  ClipboardList,
  LogOut,
  PackageMinus,
  PackagePlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import useSWR from "swr";
import { logout } from "@/features/auth/actions/logout";
import {
  canManageUsers,
  canRegisterInventoryTransaction,
  canViewItemMaster,
  type UserRole,
} from "@/features/auth/lib/roles";
import { cn } from "@/lib/utils";

type NavigationItem = {
  readonly href: string;
  readonly label: string;
  readonly Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { href: "/", label: "在庫一覧", Icon: Boxes },
  { href: "/inbound", label: "入庫登録", Icon: PackagePlus },
  { href: "/outbound", label: "出庫登録", Icon: PackageMinus },
  { href: "/items", label: "品目マスタ管理", Icon: ClipboardList },
  { href: "/users", label: "ユーザー管理", Icon: Users },
];

type AppSidebarProps = {
  readonly role: UserRole;
};

type CurrentUserRoleResponse = {
  readonly role: UserRole;
};

async function fetchCurrentUserRole(url: string): Promise<CurrentUserRoleResponse> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch current user role.");
  }

  return response.json() as Promise<CurrentUserRoleResponse>;
}

function canShowNavigationItem(item: NavigationItem, role: UserRole): boolean {
  if (item.href === "/inbound" || item.href === "/outbound") {
    return canRegisterInventoryTransaction(role);
  }

  if (item.href === "/items") {
    return canViewItemMaster(role);
  }

  if (item.href === "/users") {
    return canManageUsers(role);
  }

  return true;
}

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname();
  const { data } = useSWR("/api/current-user-role", fetchCurrentUserRole, {
    fallbackData: { role },
  });
  const currentRole = data.role;

  return (
    <aside className="border-b border-zinc-200 bg-white md:min-h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex h-full flex-col gap-5 p-4">
        <Link className="flex items-center gap-2 text-base font-semibold" href="/">
          <Boxes aria-hidden="true" className="size-5 text-zinc-700" />
          在庫管理
        </Link>
        <nav aria-label="メインメニュー" className="flex flex-col gap-1">
          {NAVIGATION_ITEMS.filter((item) =>
            canShowNavigationItem(item, currentRole),
          ).map(({ href, label, Icon }) => {
            const isActive = pathname === href;

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-3 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950",
                  isActive && "bg-zinc-950 text-white hover:bg-zinc-950 hover:text-white",
                )}
                href={href}
                key={href}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <form action={logout} className="mt-auto">
          <button
            className="flex min-h-10 w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
            type="submit"
          >
            <LogOut aria-hidden="true" className="size-4 shrink-0" />
            <span>ログアウト</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
