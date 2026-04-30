# 在庫管理システム 技術要件定義書

本書は `docs/overview.md` の機能要件を実現するための技術スタック・アーキテクチャ・コーディング規約を定義する。実装時は本書に記載のライブラリ・規約を優先的に採用すること。

## 1. 技術スタック

### 1.1 言語・ランタイム

| 区分               | 採用                       | 補足                                                                  |
| ------------------ | -------------------------- | --------------------------------------------------------------------- |
| 言語               | TypeScript（strict mode）  | `tsconfig.json` で `"strict": true`                                   |
| ランタイム         | Node.js 20 LTS             | `.node-version` / `engines` で固定する                                |
| パッケージマネージャ | npm                        | `package-lock.json` をリポジトリに含める                              |

### 1.2 フロントエンド

| 区分               | 採用                       | 補足                                                                  |
| ------------------ | -------------------------- | --------------------------------------------------------------------- |
| フレームワーク     | Next.js（App Router）      | 最新安定版を採用                                                      |
| UI コンポーネント  | shadcn/ui                  | 必要最小限のコンポーネントを `src/components/ui` に追加               |
| スタイリング       | Tailwind CSS               | カスタム CSS は最小限                                                 |
| フォーム           | React Hook Form            | バリデーションは `zod` と組み合わせる                                 |
| バリデーション     | zod                        | クライアント／サーバー双方で同一スキーマを使用                        |
| 日付処理           | date-fns                   | フォーマット・日付計算で利用                                          |

### 1.3 バックエンド／DB

| 区分     | 採用                | 補足                                                              |
| -------- | ------------------- | ----------------------------------------------------------------- |
| BaaS     | Supabase            | DB（PostgreSQL）を利用し、必要に応じて Storage を利用            |
| DB       | Supabase PostgreSQL | マイグレーションは Supabase CLI で管理                            |
| クライアント | `@supabase/supabase-js` | Server Component / Server Actions からの DB アクセスに利用       |
| API      | Next.js Server Actions | データ更新は Server Actions、一覧取得は Server Component で実装 |

### 1.4 開発支援

- **Supabase MCP（Model Context Protocol）**: AI によるスキーマ生成・クエリ作成・DB 操作に利用する。
- 環境変数は `.env.local`（ローカル）／ Vercel 環境変数（本番）で管理する。

### 1.5 テスト

| 区分           | 採用                       | 補足                                                            |
| -------------- | -------------------------- | --------------------------------------------------------------- |
| 単体テスト     | Jest                       | `next/jest` を用いて Next.js 向け設定を行い、ロジック層・Server Actions のロジック等を対象 |
| コンポーネント | @testing-library/react     | `@testing-library/jest-dom` と組み合わせ、主要 UI コンポーネントのレンダリング／ユーザー操作を対象 |
| E2E            | Playwright                 | 在庫一覧／入出庫登録／品目登録など主要フローを対象              |

### 1.6 品質ツール

| 区分           | 採用             | 補足                                                  |
| -------------- | ---------------- | ----------------------------------------------------- |
| Linter         | ESLint           | Next.js 推奨設定 + TypeScript ルール                  |
| Formatter      | Prettier         | `.prettierrc` をリポジトリで管理                      |
| 型チェック     | tsc --noEmit     | CI で実行                                             |

### 1.7 デプロイ／インフラ

- **ホスティング**: Vercel（Next.js との親和性のため）
- **DB**: Supabase（マネージド）
- **環境**: 開発（ローカル）／本番（Vercel）の 2 環境を最低限用意する。
- **ロガー**: `pino` を採用。Server Actions ／ API ルートでのエラーログを構造化ログで出力する。

## 2. 参照ドキュメント

以下の公式ドキュメントを参照し、ベストプラクティスに従って開発を進めること。

- [Next.js 公式ドキュメント](https://nextjs.org/docs)
  - App Router の実装方法
  - Server Component と Client Component の適切な使い分け
  - Server Actions の実装パターン
  - パフォーマンス最適化手法
- [Supabase 公式ドキュメント](https://supabase.com/docs)
  - PostgreSQL / Database
  - Database マイグレーション
- [shadcn/ui 公式ドキュメント](https://ui.shadcn.com/docs)
- [Tailwind CSS 公式ドキュメント](https://tailwindcss.com/docs)
- [React Hook Form 公式ドキュメント](https://react-hook-form.com/get-started)
- [zod 公式ドキュメント](https://zod.dev)

## 3. アーキテクチャとデザインパターン

### 3.1 ディレクトリ構成

```
src/
├── app/                    # App Router のルーティング
│   ├── (main)/             # 在庫一覧・入庫登録・出庫登録・品目マスタ管理
│   ├── (auth)/             # アカウント作成・ログイン
│   └── api/                # 必要時のみ Route Handler を配置
├── components/             # 汎用 UI コンポーネント
│   └── ui/                 # shadcn/ui によるベース部品
├── features/               # 機能単位のコード
│   └── [FunctionName]/
│       ├── components/     # 機能固有 UI（Container/Presentation）
│       ├── actions/        # Server Actions
│       ├── schemas/        # zod スキーマ
│       └── types/          # 型定義
├── lib/                    # 共通ユーティリティ（logger 等）
└── styles/                 # グローバルスタイル
```

- 汎用的な Component は `src/components` に配置する。
- 特定の機能に依存する Component は `src/features/[FunctionName]/components` に配置する。

### 3.2 コンポーネント設計

- データフェッチは Server Component で行い、**Container / Presentation パターン** を採用して関心事を分離する。
- 基本的に Server Component を優先し、ユーザーインタラクション（フォーム操作、動的 UI 等）が必要な場合のみ Client Component を使用する。
- `"use client"` ディレクティブは必要最小限の範囲で付与する（葉に近い Client Component に限定）。

### 3.3 データ操作

- データの作成・更新・削除は **Next.js Server Actions** を利用する。
- クライアント側でのデータ操作は最小限に抑え、可能な限り Server Actions に委譲する。
- 入庫／出庫の登録は、在庫数の整合性を保つため Server Actions 内でトランザクション（Supabase の RPC または PostgreSQL ファンクション）として実装する。
- 業務画面は `src/app/(main)/layout.tsx` で Supabase Auth の現在ユーザーと `user_profiles.role` を確認し、未ログイン、プロフィール未作成、不正なロールの場合はログイン画面へリダイレクトする。
- ロール別の画面制御は最小共通祖先レイアウトで取得した `user_profiles.role` を基準に行う。権限のない画面への直接アクセスは在庫一覧へリダイレクトする。
- 更新系は Server Actions / Route Handler / RPC に集約し、各処理の実行前にサーバー側で操作ユーザーの権限を確認する。更新系 RPC は `service_role` のみに `execute` を付与し、匿名ロールや通常の認証ロールへ直接実行権限を付与しない。
- アカウント作成は Server Action 経由で実行し、Supabase Auth の管理 API とプロフィールテーブル登録をサーバー側に閉じ込める。
- 自己登録時の初期権限はサーバー側で `general` 固定とし、クライアントから権限値を受け取らない。
- Supabase Auth でユーザー作成後にプロフィール作成へ失敗した場合は、管理 API で Auth ユーザーを削除して不整合を残さない。
- アカウント作成 Server Action にはレート制限を設け、短時間の連続登録を抑止する。
- ログアウトは Server Action 経由で Supabase Auth のセッションを破棄し、ログイン画面へ遷移する。

### 3.4 状態管理

- フォーム状態管理には React Hook Form を採用する。
- グローバルな状態管理ライブラリ（Zustand 等）は本リリースでは導入しない（必要が生じた段階で再検討）。

## 4. コード品質と標準化

### 4.1 TypeScript 活用

- すべてのプロパティに明示的な型定義を行う。
- `any` 型の使用は禁止し、適切なジェネリック型を活用する。
- `zod` を用いた実行時の型検証を実装する（Server Actions の入力は必ず `zod.parse` を通す）。
- 左辺が `null` ／ `undefined` となる場合は、`||` ではなく `??` を使用する。
- 条件分岐では真偽値を直接評価し、暗黙的な型変換（Truthy/Falsy）に頼らない。
  - 例: `if (array.length > 0)` を使用し、`if (array.length)` は避ける。
  - 例: `if (value === undefined)` を使用し、`if (!value)` は避ける。

### 4.2 命名規則

- ファイル／ディレクトリ: kebab-case（例: `item-form.tsx`）。
- React コンポーネント: PascalCase（例: `ItemForm`）。
- 関数・変数: camelCase。
- 型・インターフェース・enum: PascalCase。
- 定数: UPPER_SNAKE_CASE。

## 5. スタイリング

- UI 構築には **shadcn/ui** を優先的に使用する。
  - 新規 UI コンポーネント作成前に、shadcn/ui に同等のコンポーネントが存在するか確認する。
  - 必要に応じて Tailwind CSS でカスタマイズする。
  - shadcn/ui のデザイン原則に従い、プロジェクト内の一貫性を保つ。
- CSS は **Tailwind CSS** を使用し、カスタム CSS の使用は最小限に抑える。
- レスポンシブデザインを全画面で考慮する（PC を主、スマートフォン／タブレットも操作可能とする）。

## 6. パフォーマンス最適化

- React コンポーネントでは `useCallback` と `useMemo` を適切に使用する（過剰なメモ化は避け、計測に基づき判断する）。
- 画像最適化には Next.js の `Image` コンポーネントを使用する。
- データ取得は Server Component で行い、不要なクライアント送信を避ける。

## 7. ドキュメンテーション

- 新しい関数やコンポーネントには JSDoc コメントを追加する（公開 API・複雑な引数を持つもの）。
- 複雑なロジックには、なぜそのような実装になったのかを説明する適切なインラインコメントを付ける。
- 自明なコメント（「変数を初期化する」等）は付けない。

## 8. エラー処理とログ記録

- すべての非同期処理には `try-catch` を使用し、エラーは `pino` ベースの共通ロガーでキャプチャする。
- ユーザーに表示するエラーメッセージは、共通の表示コンポーネント／ Toast を介して統一フォーマットで提供する。
- Server Actions ではエラーを呼び出し元に明示的に返却し、UI 側で適切にハンドリングする（throw しっぱなしにしない）。

## 9. テスト

- 新しい機能には Jest を使用した単体テストを必ず含める。
- コンポーネントテストには `@testing-library/react` を使用する。
- クリティカルなユーザーフロー（在庫一覧、入庫登録、出庫登録、在庫数の整合性）に対しては Playwright で E2E テストを作成する。
- テスト用の Supabase プロジェクトもしくはローカル Supabase を利用し、本番データを汚染しないこと。

## 10. 環境変数

| 変数名                         | 用途                                |
| ------------------------------ | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | Supabase プロジェクト URL                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  | Supabase 公開キー。クライアントから DB 参照が必要な場合に利用 |
| `SUPABASE_SERVICE_ROLE_KEY`             | サーバーサイド限定の管理者キー（必要時）               |

- `.env.local` をリポジトリに含めない（`.gitignore` に追加）。
- `.env.example` を用意し、必要な変数キーを共有する。
- `SUPABASE_SERVICE_ROLE_KEY` はアカウント作成時の Auth 管理 API などサーバー専用処理でのみ使用し、Client Component やブラウザ向けコードへ渡さない。

## 11. 依存関係管理ルール

- ライブラリの追加・削除を行った場合、本書を必ず更新する。
- 追加理由・代替案の検討結果を `.cursor-log/` の作業ログに記録する。
- バージョン互換性（Next.js / React / Supabase クライアント等）を確認した上で導入する。

## 12. スコープ外の技術トピック

本リリースでは導入しないが、将来的に検討する候補。

- CI / CD（GitHub Actions 等）による自動テスト・自動デプロイ
- Husky / lint-staged / commitlint によるコミット時の自動チェック
- Storybook 等のコンポーネントカタログ
- E2E テストの CI 実行
- 監視／APM（Sentry、Datadog 等）の導入
