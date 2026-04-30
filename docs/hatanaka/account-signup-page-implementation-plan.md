# アカウント作成画面 実装手順書

## 1. 目的

アカウント作成画面だけを実装する。画面はメールアドレス、パスワード、パスワード確認、ユーザー名を入力してアカウントを作成できるシンプルな構成とする。

登録処理は Supabase Auth と `user_profiles` を使用し、自己登録ユーザーの初期権限はサーバー側で `general` 固定にする。登録完了後は自動ログインせず、完了メッセージとログイン画面への導線を表示する。

## 2. 前提ドキュメント

実装時は以下を優先する。

- `docs/best-practices/development-guidelines.md`
- `docs/design specification/account-signup-requirements.md`
- `docs/design specification/functional_requirements.md`
- `docs/design specification/technical-requirements.md`
- `docs/design specification/database-table-design.md`

`docs/Past documents/*` は参考資料扱いとし、正規ルールとして扱わない。

関連設計書は現時点の要件と整合しているため、本手順書作成時点では追加修正不要と判断する。実装中にテーブル名、ルーティング、認証方式、受け入れ基準を変更する場合は、上記の関連設計書も同時に更新する。

## 3. 実装スコープ

### 3.1 対象

- `/signup` のアカウント作成画面作成
- シンプルなアカウント作成フォーム作成
- ログイン画面へのリンク表示
- 登録完了メッセージ表示
- zod によるクライアント／サーバー共通バリデーション
- アカウント作成用 Server Action 作成
- Supabase Auth 管理 API によるユーザー作成
- `user_profiles` へのプロフィール保存
- 初期権限 `general` のサーバー固定
- Auth ユーザー作成後にプロフィール保存へ失敗した場合の Auth ユーザー削除
- `user_profiles` の RLS 設定
- アカウント作成に必要な型定義更新
- 登録処理中の二重送信防止
- 登録失敗時のエラーメッセージ表示

### 3.2 対象外

- ログイン画面の本実装
- メールアドレス確認
- パスワードリセット
- ソーシャルログイン
- 多要素認証
- 管理者によるユーザー承認
- ユーザー招待
- 権限変更画面
- ロール別アクセス制御
- アカウント情報変更
- プロフィール画像

ログイン画面へのリンクは `/login` へ向ける。ログイン画面が未実装の場合でも、本タスクではアカウント作成画面側の導線までを対象とする。

`account-signup-requirements.md` の受け入れ基準に含まれる「作成したアカウントでログインできる」はログイン機能側の結合確認項目とし、本手順書ではログイン画面への導線表示までを完了条件とする。

## 4. 完成イメージ

画面構成は以下とする。

```text
+------------------------------------------------+
| アカウント作成                                 |
|                                                |
| メールアドレス                                 |
| [example@example.com]                          |
|                                                |
| ユーザー名                                     |
| [表示名]                                       |
|                                                |
| パスワード                                     |
| [8文字以上]                                    |
|                                                |
| パスワード確認                                 |
| [もう一度入力]                                 |
|                                                |
| [アカウント作成]                               |
|                                                |
| 既にアカウントをお持ちですか？ ログイン        |
+------------------------------------------------+
```

登録完了後は同じ画面内で以下を表示する。

```text
アカウント作成が完了しました。
ログインしてください。

[ログイン画面へ]
```

UI は中央寄せの小さなフォームに留める。サイドバー付きの業務画面レイアウトは使用しない。

## 5. Supabase 実装手順

### 5.1 既存スキーマの確認

`user_profiles` が未作成の場合は、`supabase/migrations/*` にマイグレーションを追加する。

`user_profiles` は `docs/design specification/database-table-design.md` に従い、以下の制約を持たせる。

- `id` は `auth.users.id` と同一の UUID
- `username` は必須かつ一意
- `role` は `general` 固定
- Auth ユーザー削除時にプロフィールも削除
- RLS を有効化し、本人のみ SELECT 可能
- クライアントからの INSERT / UPDATE / DELETE は許可しない

### 5.2 `user_profiles` テーブル追加

```sql
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_username_not_blank check (btrim(username) <> ''),
  constraint user_profiles_role_check check (role in ('general'))
);

create index if not exists user_profiles_username_idx
  on public.user_profiles (username);
```

`updated_at` は `user_profiles` 更新時に自動更新する。既存の `inventory_items` 用関数は品目専用名のため流用せず、`user_profiles` 用のトリガー関数を追加する。

```sql
create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
  before update on public.user_profiles
  for each row
  execute function public.set_user_profiles_updated_at();
```

### 5.3 RLS 設定

```sql
alter table public.user_profiles enable row level security;

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
  on public.user_profiles
  for select
  to authenticated
  using (auth.uid() = id);

revoke all on table public.user_profiles from public, anon, authenticated;
grant select on table public.user_profiles to authenticated;
```

`user_profiles` の登録は Server Action から Service Role クライアントで行う。クライアントから `insert` できるポリシーは作成しない。

### 5.4 Supabase Auth 設定

本リリースではメールアドレス確認を行わないため、Supabase 側で登録直後にログイン可能な設定にする。

Server Action では Supabase Auth 管理 API を使用し、`email_confirm: true` を指定してユーザーを作成する。

Service Role キーの扱い:

- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用環境変数として扱う。
- `NEXT_PUBLIC_*` に Service Role キーを置かない。
- Client Component へ Service Role キーや Service Role クライアントを渡さない。
- Service Role クライアントは既存の `src/lib/supabase/server.ts` の `createServiceRoleClient` を使用する。

### 5.5 型定義更新

Supabase 型生成または手動更新により、`src/types/database.ts` に `user_profiles` を追加する。

最小限、以下の型が扱える状態にする。

```ts
user_profiles: {
  Row: {
    id: string;
    username: string;
    role: "general";
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id: string;
    username: string;
    role?: "general";
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    username?: string;
    role?: "general";
    updated_at?: string;
  };
  Relationships: [];
};
```

Supabase 型生成で `auth.users` への外部キー関係が `Relationships` に出力されない場合は、手動で `auth.users` 参照を補完しない。アプリ側で参照するのは `user_profiles` の行型と INSERT 型に限定する。

## 6. Next.js 実装手順

### 6.1 ディレクトリ構成

既存構成と `technical-requirements.md` に合わせ、認証関連を `src/app/(auth)` と `src/features/auth` に追加する。

```text
src/
├── app/
│   └── (auth)/
│       ├── layout.tsx
│       └── signup/
│           └── page.tsx
└── features/
    └── auth/
        ├── actions/
        │   └── create-account.ts
        ├── components/
        │   └── account-signup-form.tsx
        ├── lib/
        │   └── account-signup-rate-limit.ts
        ├── schemas/
        │   └── account-signup-schema.ts
        └── types/
            └── account-signup.ts
```

必要なファイルだけを追加する。汎用 UI コンポーネントは既存のものがあれば再利用し、なければフォーム内の標準 HTML と Tailwind CSS で簡潔に実装する。

### 6.2 ルーティング

`src/app/(auth)/layout.tsx` はサイドバーを表示しない認証画面用レイアウトにする。

- 画面全体を `min-h-screen` にする
- フォームを中央寄せにする
- 背景は既存の `zinc` 系を使い、過度な装飾を入れない
- `GlobalProviders` はルートレイアウト側で既に適用されているため、重複させない

`src/app/(auth)/signup/page.tsx` は Server Component とし、`AccountSignupForm` を表示するだけにする。

### 6.3 バリデーション

`src/features/auth/schemas/account-signup-schema.ts` を作成し、zod で以下を検証する。

| 項目 | ルール | エラーメッセージ |
| --- | --- | --- |
| メールアドレス | 必須 | メールアドレスを入力してください |
| メールアドレス | メール形式 | 正しいメールアドレスを入力してください |
| パスワード | 必須 | パスワードを入力してください |
| パスワード | 8文字以上 | パスワードは8文字以上で入力してください |
| パスワード確認 | 必須 | パスワード確認を入力してください |
| パスワード確認 | パスワードと一致 | パスワードが一致しません |
| ユーザー名 | 必須 | ユーザー名を入力してください |

入力値は `trim` したうえで検証する。ただしパスワードは意図しない変更を避けるため、前後空白の自動除去は行わず、そのまま検証する。

### 6.4 フォームコンポーネント

`src/features/auth/components/account-signup-form.tsx` は Client Component とする。

実装方針:

- React Hook Form と zod resolver を使用する
- フィールドごとのエラーメッセージを入力欄の直下に表示する
- 登録中はアカウント作成ボタンを `disabled` にする
- 成功時はフォームを非表示にし、完了メッセージと `/login` リンクを表示する
- エラー時はフォーム上部または対象項目の近くにメッセージを表示する
- 権限選択 UI は絶対に表示しない

画面上の表示項目:

- メールアドレス
- ユーザー名
- パスワード
- パスワード確認
- アカウント作成ボタン
- ログイン画面へのリンク

### 6.5 Server Action

`src/features/auth/actions/create-account.ts` を作成する。

処理フロー:

1. zod で入力値を再検証する。
2. レート制限を確認する。
3. Service Role クライアントを作成する。
4. `user_profiles` でユーザー名重複を確認する。
5. Supabase Auth 管理 API でユーザーを作成する。
6. `user_profiles` に `id` と `username` を保存する。
7. プロフィール保存に失敗した場合は Auth ユーザーを削除する。
8. 成功結果を返す。
9. 予期しないエラーはログへ出し、ユーザーには汎用エラーを返す。

ユーザー名は事前確認だけに依存しない。同時登録により `user_profiles.username` の UNIQUE 制約違反が発生した場合も、Auth ユーザーを削除したうえでユーザー名重複メッセージを返す。

戻り値は判別可能な union 型にする。

```ts
export type CreateAccountResult =
  | {
      readonly success: true;
    }
  | {
      readonly success: false;
      readonly message: string;
      readonly fieldErrors?: Partial<
        Record<"email" | "password" | "passwordConfirmation" | "username", string>
      >;
    };
```

メールアドレス重複時はアカウント列挙を避けるため、以下の汎用メッセージを返す。

```text
アカウント作成に失敗しました。入力内容を確認してください
```

ユーザー名重複時は以下のメッセージを返す。

```text
このユーザー名はすでに使用されています
```

Supabase Auth の失敗や予期しない失敗は以下のメッセージを返す。

```text
アカウント作成に失敗しました。時間をおいて再度お試しください
```

### 6.6 レート制限

`src/features/auth/lib/account-signup-rate-limit.ts` に、Server Action から呼び出すレート制限関数を用意する。

初期実装はプロセスメモリベースでよい。ただし本番運用ではサーバーレス実行環境で共有されない可能性があるため、将来 Redis または Supabase テーブルへ移行できるよう、呼び出し口を小さく分離する。

最小実装例:

- キーは IP アドレスまたは取得できない場合は `"unknown"` とする
- 10分あたり5回まで許可する
- 超過時は登録処理を実行せず、汎用エラーを返す

`headers()` から IP を取得する場合も、信頼できるプロキシ構成が未確定ならセキュリティ境界として過信しない。今回の目的は短時間の連続送信抑止に留める。

### 6.7 ログ出力

既存の共通ロガーがある場合は再利用する。未整備の場合は、既存 Server Action と同様に `console.error` で記録し、ユーザーへ内部詳細を返さない。

ログにパスワードを含めない。メールアドレスも必要がなければ出力しない。

## 7. 実装順序

1. `user_profiles` 用マイグレーションを追加する。
2. RLS と権限設定を追加する。
3. `src/types/database.ts` を更新する。
4. `account-signup-schema.ts` を作成する。
5. `create-account.ts` を作成する。
6. `account-signup-rate-limit.ts` を作成する。
7. `account-signup-form.tsx` を作成する。
8. `src/app/(auth)/layout.tsx` を作成する。
9. `src/app/(auth)/signup/page.tsx` を作成する。
10. フォームの表示、入力エラー、成功表示、ログイン導線を確認する。
11. `npm run lint`、`npm run build`、必要に応じて `npm run test` を実行する。

## 8. テスト方針

テストコードは実装側のコードを正として作成し、テストのために実装側を変更しない。

### 8.1 ユニットテスト

`account-signup-schema.test.ts` を作成し、以下を確認する。

- 必須項目未入力でエラーになる
- メールアドレス形式不正でエラーになる
- パスワードが8文字未満の場合にエラーになる
- パスワード確認が一致しない場合にエラーになる
- 正常な入力は通過する

### 8.2 コンポーネントテスト

`account-signup-form.test.tsx` を作成し、以下を確認する。

- 入力欄とアカウント作成ボタンが表示される
- 権限選択 UI が表示されない
- 入力エラーが対象項目付近に表示される
- 送信中にボタンが無効化される
- 成功時に完了メッセージとログインリンクが表示される

### 8.3 Server Action テスト

Service Role クライアントはモック化し、以下を確認する。

- zod 検証に失敗した場合は Supabase を呼ばない
- ユーザー名重複時に専用メッセージを返す
- Auth 作成失敗時に汎用メッセージを返す
- プロフィール保存失敗時に Auth ユーザー削除を呼ぶ
- 成功時に `success: true` を返す

## 9. 受け入れ基準

- `/signup` でアカウント作成画面が表示できる。
- メールアドレス、パスワード、パスワード確認、ユーザー名を入力できる。
- アカウント作成画面で権限を選択できない。
- 必須項目が未入力の場合、登録できずエラーメッセージが表示される。
- メールアドレス形式が不正な場合、登録できずエラーメッセージが表示される。
- パスワードが8文字未満の場合、登録できずエラーメッセージが表示される。
- パスワードとパスワード確認が一致しない場合、登録できずエラーメッセージが表示される。
- 登録済みメールアドレスでは登録できず、登録済みであることを直接示さない。
- 登録済みユーザー名では登録できず、「このユーザー名はすでに使用されています」と表示される。
- 正常時に Supabase Auth へアカウントが作成され、`user_profiles` が保存される。
- 作成されたプロフィールの権限は `general` で保存される。
- 登録完了後に「アカウント作成が完了しました。ログインしてください。」と表示される。
- 登録完了後、ログイン画面へ移動できるリンクが表示される。
- RLS により、他ユーザーのプロフィール情報を参照できない。

## 10. 品質ゲート

実装完了後に以下を実行する。

```bash
npm run lint
npm run build
npm run test
```

Supabase ローカル環境で確認できる場合は、マイグレーション適用後に以下も確認する。

- `user_profiles` に RLS が有効化されている
- `anon` から `user_profiles` を参照できない
- `authenticated` は本人のプロフィールだけ参照できる
- Service Role 経由ではアカウント作成 Server Action からプロフィールを作成できる
