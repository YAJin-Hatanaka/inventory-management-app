# ログイン画面 実装手順書

## 1. 目的

ログイン画面だけを実装する。登録済みユーザーがメールアドレスとパスワードを入力し、Supabase Auth でログインできる状態にする。

UI はシンプルな構成とし、入力欄はメールアドレスとパスワードのみ、主要導線はログインボタンとアカウント作成画面へのリンクのみとする。

## 2. 前提ドキュメント

実装時は以下を優先する。

- `docs/best-practices/development-guidelines.md`
- `docs/design specification/account-signup-requirements.md`
- `docs/design specification/functional_requirements.md`
- `docs/design specification/technical-requirements.md`
- `docs/design specification/database-table-design.md`

`docs/Past documents/*` は参考資料扱いとし、正規ルールとして扱わない。

`account-signup-requirements.md` ではログイン画面がアカウント作成画面から遷移できる画面として定義され、受け入れ基準に「作成したアカウントでログインできる」が含まれている。本手順書では、その結合確認を満たすためのログイン画面とログイン処理を実装対象にする。

関連設計書はログイン画面の存在、Supabase Auth の利用、メールアドレスとパスワードによるログイン方針を既に含んでいるため、本手順書作成時点では追加修正不要と判断する。ログイン後の遷移先、認証ガード、パスワードリセット、メール確認などの要件を変更する場合は、関連設計書も同時に更新する。

## 3. 実装スコープ

### 3.1 対象

- `/login` のログイン画面作成
- シンプルなログインフォーム作成
- アカウント作成画面へのリンク表示
- zod によるクライアント／サーバー共通バリデーション
- ログイン用 Server Action 作成
- Supabase Auth の `signInWithPassword` によるログイン
- ログイン成功時の在庫一覧画面への遷移
- ログイン失敗時の汎用エラーメッセージ表示
- ログイン処理中の二重送信防止
- ログインフォーム、スキーマ、Server Action のテスト作成

### 3.2 対象外

- アカウント作成画面の追加改修
- パスワードリセット
- メールアドレス確認
- ソーシャルログイン
- 多要素認証
- ログアウト
- 認証ガードの全面導入
- ロール別アクセス制御
- 管理者承認、ユーザー招待、権限変更
- アカウント情報変更
- プロフィール表示／編集

本タスクではログイン画面とログイン処理に限定する。未認証ユーザーの業務画面アクセス制御は、別タスクで Middleware またはレイアウト側の認証チェックとして設計する。

## 4. 完成イメージ

画面構成は以下とする。

```text
+--------------------------------------+
| ログイン                             |
|                                      |
| メールアドレス                       |
| [example@example.com]                |
|                                      |
| パスワード                           |
| [********]                           |
|                                      |
| [ログイン]                           |
|                                      |
| アカウントをお持ちでないですか？     |
| アカウント作成                       |
+--------------------------------------+
```

UI は既存の `src/app/(auth)/layout.tsx` を利用し、中央寄せの小さなフォームに留める。サイドバー付きの業務画面レイアウトは使用しない。

## 5. 認証方針

### 5.1 Supabase クライアント

ログイン処理では Service Role キーを使用しない。

Server Action では既存の `src/lib/supabase/server.ts` の `createClient` を使用し、Supabase Auth の通常ログイン処理を実行する。`createClient` は Cookie 連携済みのサーバークライアントであり、Server Action からログインセッション Cookie を設定できる。

使用する API:

```ts
const supabase = await createClient();
const { error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
```

### 5.2 エラーメッセージ

ログイン失敗時はメールアドレス登録有無やパスワード誤りを区別しない。アカウント列挙を避けるため、画面には以下の汎用メッセージを表示する。

```text
メールアドレスまたはパスワードが正しくありません
```

予期しないエラーも内部詳細は表示せず、画面には以下の汎用メッセージを表示する。Supabase Auth が認証失敗として返したエラーは「メールアドレスまたはパスワードが正しくありません」、それ以外の例外や想定外エラーは以下に統一する。

```text
ログインに失敗しました。時間をおいて再度お試しください
```

## 6. Next.js 実装手順

### 6.1 ディレクトリ構成

既存の認証機能と同じ `src/app/(auth)` と `src/features/auth` に追加する。

```text
src/
├── app/
│   └── (auth)/
│       └── login/
│           └── page.tsx
└── features/
    └── auth/
        ├── actions/
        │   └── login.ts
        ├── components/
        │   └── login-form.tsx
        ├── schemas/
        │   └── login-schema.ts
        └── types/
            └── login.ts
```

必要なファイルだけを追加する。汎用 UI コンポーネントの新規追加は行わず、既存の認証フォームと同じく標準 HTML と Tailwind CSS で簡潔に実装する。

### 6.2 ルーティング

`src/app/(auth)/login/page.tsx` を作成する。

- Server Component とする
- `metadata.title` は `ログイン | 在庫管理システム` とする
- 表示内容は `LoginForm` のみとする
- ログイン済みユーザーのリダイレクトは本タスクでは必須にしない

例:

```tsx
import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = {
  title: "ログイン | 在庫管理システム",
};

export default function LoginPage() {
  return <LoginForm />;
}
```

### 6.3 バリデーション

`src/features/auth/schemas/login-schema.ts` を作成し、zod で以下を検証する。

| 項目 | ルール | エラーメッセージ |
| --- | --- | --- |
| メールアドレス | 必須 | メールアドレスを入力してください |
| メールアドレス | メール形式 | 正しいメールアドレスを入力してください |
| パスワード | 必須 | パスワードを入力してください |

パスワードの8文字以上チェックはアカウント作成時のルールであり、ログイン時は未入力のみを検証する。既存アカウントの認証可否は Supabase Auth に委譲する。

作成する型:

- `LoginInput`
- `LoginValues`
- `LoginFieldName`
- `LoginFieldErrors`
- `toLoginFieldErrors`

### 6.4 Server Action

`src/features/auth/actions/login.ts` を作成する。

実装方針:

1. `"use server"` を付与する。
2. `loginSchema.safeParse(input)` でサーバー側でも検証する。
3. 検証失敗時は項目別エラーを返す。
4. `createClient` で Supabase サーバークライアントを作成する。
5. `supabase.auth.signInWithPassword({ email, password })` を呼び出す。
6. Auth ログイン成功後、`user_profiles` に `auth.users.id` と同じ `id` のプロフィールが存在するか確認する。
7. プロフィールが存在しない場合は `supabase.auth.signOut()` を呼び出し、ログイン失敗として扱う。
8. エラー時は汎用メッセージを返す。
9. 成功時は `{ success: true }` を返す。

返却型は `src/features/auth/types/login.ts` に定義する。

```ts
export type LoginResult =
  | {
      readonly success: true;
    }
  | {
      readonly success: false;
      readonly message: string;
      readonly fieldErrors?: LoginFieldErrors;
    };
```

Service Role クライアントは使用しない。ログイン処理に `createServiceRoleClient` を使う実装は禁止する。プロフィール確認もログイン後の通常 Supabase セッションで行い、`user_profiles` の RLS に従う。

テストしやすくするため、サインアップ実装と同様に依存注入できる構造にする。最小構成として、`CreateLoginDependencies` に `createRepository` を持たせ、repository は `signInWithPassword` 相当の `loginWithPassword`、プロフィール確認用の `findUserProfileByUserId`、セッション破棄用の `signOut` を公開する。

### 6.5 フォームコンポーネント

`src/features/auth/components/login-form.tsx` を作成する。

実装方針:

- `"use client"` を付与する。
- `react-hook-form` と `zodResolver(loginSchema)` を使用する。
- `submitLogin` を props で差し替え可能にし、テストしやすくする。
- 初期値は `email: ""`、`password: ""` とする。
- 送信中はログインボタンを無効化し、表示文言を `ログイン中` にする。
- Server Action の `fieldErrors` は対象項目へ反映する。
- Server Action の `message` はフォーム上部に `role="alert"` で表示する。
- 成功時は `useRouter().replace("/")` で在庫一覧へ遷移する。
- アカウント作成画面へのリンクは `/signup` にする。

表示項目:

- 見出し: `ログイン`
- メールアドレス入力欄
- パスワード入力欄
- ログインボタン
- `アカウントをお持ちでないですか？ アカウント作成`

過度な説明文、装飾、カードの入れ子は追加しない。

### 6.6 ログイン後の遷移

ログイン成功後は `/` に遷移する。現在の `/` は在庫一覧画面であり、ログイン後の初期表示として扱う。

本タスクでは `redirectTo` クエリや認証ガードからの戻り先制御は実装しない。認証ガード導入時に必要であれば別途設計する。

## 7. テスト手順

### 7.1 スキーマテスト

`src/features/auth/schemas/login-schema.test.ts` を作成する。

確認項目:

- メールアドレス未入力でエラーになる
- メールアドレス形式不正でエラーになる
- パスワード未入力でエラーになる
- 正常値では trim 済みのメールアドレスと、入力値そのままのパスワードが取得できる

### 7.2 Server Action テスト

`src/features/auth/actions/login.test.ts` を作成する。

確認項目:

- zod 検証に失敗した場合は Supabase を呼ばない
- Supabase Auth のログイン失敗時に汎用メッセージを返す
- Auth ユーザーは存在するが `user_profiles` が存在しない場合、`signOut` を呼び出してログイン失敗にする
- プロフィール確認でエラーが発生した場合、`signOut` を呼び出して汎用メッセージを返す
- 正常時に `signInWithPassword` を正しい値で呼び出す
- 正常時に `user_profiles` の存在確認を行う
- 正常時に `{ success: true }` を返す

テストしやすくするため、Server Action はサインアップ実装と同様に依存注入できる構造にする。

### 7.3 コンポーネントテスト

`src/features/auth/components/login-form.test.tsx` を作成する。

確認項目:

- メールアドレス、パスワード、ログインボタン、アカウント作成リンクを表示する
- 未入力送信時に項目別エラーを表示する
- 送信中にログインボタンを無効化する
- Server Action のエラーメッセージを表示する
- 正常な入力で Server Action を呼び出す
- ログイン成功時に `/` へ遷移する

`next/navigation` の `useRouter` は Jest で mock する。

### 7.4 手動確認

1. `npm run dev` を起動する。
2. `/signup` でアカウントを作成する。
3. 登録完了後、ログイン画面への導線から `/login` へ移動する。
4. 作成したメールアドレスとパスワードでログインする。
5. ログイン成功後、`/` に遷移することを確認する。
6. 誤ったパスワードでログインし、汎用エラーメッセージが表示されることを確認する。

## 8. 品質ゲート

実装後に以下を実行する。

```bash
npm test -- login-schema.test.ts login.test.ts login-form.test.tsx
npm run lint
npm run build
```

必要に応じて、既存のサインアップ関連テストも実行する。

```bash
npm test -- account-signup
```

## 9. 完了条件

- `/login` が表示できる
- メールアドレスとパスワードを入力できる
- 必須項目未入力時に対象項目付近へエラーが表示される
- メールアドレス形式不正時にエラーが表示される
- ログイン失敗時に内部詳細を出さない汎用メッセージが表示される
- ログイン処理中に二重送信できない
- `/signup` への導線が表示される
- `/signup` で作成したアカウントでログインできる
- Supabase Auth に存在しても `user_profiles` が存在しないユーザーはログインできない
- ログイン成功後に `/` へ遷移する
- Service Role キーをログイン処理に使用していない
- `npm test`、`npm run lint`、`npm run build` が通る
