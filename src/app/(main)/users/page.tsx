import { ROLE_LABELS } from "@/features/auth/lib/roles";
import { canManageUsers } from "@/features/auth/lib/roles";
import { requirePagePermission } from "@/features/auth/lib/server-permissions";
import { UserRoleForm } from "@/features/users/components/user-role-form";
import {
  fetchManagedUsers,
  USERS_PER_PAGE,
} from "@/features/users/lib/user-management";

type UsersPageProps = {
  readonly searchParams?: Promise<{
    readonly page?: string | string[];
  }>;
};

function getPage(value: string | string[] | undefined): number {
  const rawPage = Array.isArray(value) ? value[0] : value;
  const page = Number(rawPage ?? "1");

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requirePagePermission(canManageUsers);

  const resolvedSearchParams = await searchParams;
  const page = getPage(resolvedSearchParams?.page);
  const users = await fetchManagedUsers(page);
  const hasPreviousPage = page > 1;
  const hasNextPage = users.length === USERS_PER_PAGE;

  return (
    <>
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-5">
        <p className="text-sm font-medium text-zinc-500">Users</p>
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
          ユーザー管理
        </h1>
        <p className="text-sm text-zinc-600">
          ユーザーの現在権限を確認し、管理者・MG・一般へ変更できます。
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <div className="overflow-hidden border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase tracking-normal text-zinc-600">
                <tr>
                  <th className="min-w-40 px-4 py-3">ユーザー名</th>
                  <th className="min-w-56 px-4 py-3">メールアドレス</th>
                  <th className="w-28 px-4 py-3">現在権限</th>
                  <th className="w-72 px-4 py-3 text-right">権限変更</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {users.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-zinc-500"
                      colSpan={4}
                    >
                      表示できるユーザーはありません。
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr className="hover:bg-zinc-50" key={user.id}>
                      <td className="px-4 py-3 font-medium text-zinc-950">
                        {user.username}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {ROLE_LABELS[user.role]}
                      </td>
                      <td className="px-4 py-3">
                        <UserRoleForm
                          currentRole={user.role}
                          userId={user.id}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <nav
          aria-label="ユーザー一覧ページ"
          className="flex items-center justify-end gap-2"
        >
          {hasPreviousPage ? (
            <a
              className="inline-flex h-9 items-center justify-center border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
              href={`/users?page=${page - 1}`}
            >
              前へ
            </a>
          ) : null}
          {hasNextPage ? (
            <a
              className="inline-flex h-9 items-center justify-center border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
              href={`/users?page=${page + 1}`}
            >
              次へ
            </a>
          ) : null}
        </nav>
      </section>
    </>
  );
}
