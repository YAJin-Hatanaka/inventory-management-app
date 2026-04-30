# 在庫一覧トップページ 実装手順書

## 1. 目的

トップページとして在庫一覧のみを実装する。画面は左側にサイドバー、右側に在庫一覧を表示するシンプルな構成とする。

本手順では、Supabase PostgreSQL のテーブル作成、初期データ投入、Next.js App Router によるトップページ実装までを対象とする。

## 2. 前提ドキュメント

実装時は以下を優先する。

- `docs/best-practices/development-guidelines.md`
- `docs/design specification/functional_requirements.md`
- `docs/design specification/technical-requirements.md`
- `docs/design specification/database-table-design.md`

`docs/Past documents/*` は参考資料扱いとし、正規ルールとして扱わない。

## 3. 実装スコープ

### 3.1 対象

- Supabase テーブル作成
- 在庫一覧表示に必要なビュー作成
- 開発確認用の初期データ投入
- トップページ `/` の在庫一覧画面作成
- サイドバー表示
- サイドバーから各ページへのリンク設置
- 品目名による部分一致検索
- 在庫一覧テーブル表示

### 3.2 対象外

- 入庫登録画面の実装
- 出庫登録画面の実装
- 品目マスタ管理画面の実装
- 入出庫更新処理の UI 実装
- 認可ロール管理
- 入出庫履歴一覧

サイドバーには対象外ページへのリンクを表示するが、各ページの中身は後続実装とする。

## 4. 完成イメージ

画面構成は以下とする。

```text
+----------------------+--------------------------------------+
| サイドバー           | 在庫一覧                             |
|                      |                                      |
| - 在庫一覧           | [品目名検索フォーム]                 |
| - 入庫登録           |                                      |
| - 出庫登録           | 品目コード | 品目名 | カテゴリ | ... |
| - 品目マスタ管理     | 0001     | 手袋   | 消耗品   | ... |
+----------------------+--------------------------------------+
```

在庫一覧の表示順は品目コード昇順とする。

## 5. Supabase 実装手順

### 5.1 既存データの扱い

今回の実装では、通常のマイグレーションに既存テーブルの `drop` やデータ削除を含めない。`supabase/migrations/*` は本番・共有検証環境にも適用され得るため、破壊的な初期化処理は混在させない。

既存データを削除して作り直す必要がある場合は、ローカル開発環境であることを確認したうえで、マイグレーションとは別の明示的なリセット手順として実行する。本番環境や共有検証環境でリセット手順を実行しないこと。

### 5.2 マイグレーション作成

`supabase/migrations/*` に SQL マイグレーションを追加する。

作成対象は以下。

- `inventory_items`
- `inventory_transactions`
- `inventory_stock_summary`
- `updated_at` 更新用トリガー

開発確認用 seed データは通常のマイグレーションに含めず、ローカル Supabase の `supabase/seed.sql` など開発環境専用の投入手順として分離する。

### 5.3 テーブル作成

`docs/design specification/database-table-design.md` に従い、最低限以下のテーブルを作成する。

```sql
create extension if not exists pgcrypto;

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_code bigint generated always as identity unique not null,
  name text unique not null,
  category text,
  unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_name_not_blank check (btrim(name) <> ''),
  constraint inventory_items_unit_not_blank check (btrim(unit) <> ''),
  constraint inventory_items_category_not_blank_when_present
    check (category is null or btrim(category) <> '')
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  transaction_type text not null,
  quantity integer not null,
  transaction_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  constraint inventory_transactions_type_check
    check (transaction_type in ('inbound', 'outbound')),
  constraint inventory_transactions_quantity_check check (quantity >= 1),
  constraint inventory_transactions_note_not_blank_when_present
    check (note is null or btrim(note) <> '')
);
```

### 5.4 インデックス作成

```sql
create index inventory_items_item_code_idx
  on public.inventory_items (item_code);

create index inventory_items_name_idx
  on public.inventory_items (name);

create index inventory_transactions_item_id_idx
  on public.inventory_transactions (item_id);

create index inventory_transactions_item_id_type_idx
  on public.inventory_transactions (item_id, transaction_type);

create index inventory_transactions_transaction_date_idx
  on public.inventory_transactions (transaction_date);
```

### 5.5 在庫一覧ビュー作成

```sql
create view public.inventory_stock_summary
with (security_invoker = true) as
select
  i.id as item_id,
  i.item_code,
  i.name,
  i.category,
  i.unit,
  coalesce(sum(t.quantity) filter (where t.transaction_type = 'inbound'), 0) as inbound_quantity,
  coalesce(sum(t.quantity) filter (where t.transaction_type = 'outbound'), 0) as outbound_quantity,
  coalesce(sum(t.quantity) filter (where t.transaction_type = 'inbound'), 0)
    - coalesce(sum(t.quantity) filter (where t.transaction_type = 'outbound'), 0) as current_quantity
from public.inventory_items i
left join public.inventory_transactions t on t.item_id = i.id
group by i.id, i.item_code, i.name, i.category, i.unit;
```

### 5.6 初期データ投入

開発確認用に、在庫一覧で表示できる品目と入出庫履歴を投入する。

この SQL は本番適用されるマイグレーションには含めず、ローカル Supabase の `supabase/seed.sql` など開発環境専用の seed として管理する。

```sql
insert into public.inventory_items (name, category, unit)
values
  ('ニトリル手袋', '消耗品', '箱'),
  ('マスク', '消耗品', '箱'),
  ('消毒液', '衛生用品', '本'),
  ('コピー用紙', '事務用品', '冊');

insert into public.inventory_transactions (item_id, transaction_type, quantity, transaction_date, note)
select id, 'inbound', 20, current_date, '初期入庫'
from public.inventory_items
where name = 'ニトリル手袋';

insert into public.inventory_transactions (item_id, transaction_type, quantity, transaction_date, note)
select id, 'outbound', 3, current_date, '初期出庫'
from public.inventory_items
where name = 'ニトリル手袋';

insert into public.inventory_transactions (item_id, transaction_type, quantity, transaction_date, note)
select id, 'inbound', 15, current_date, '初期入庫'
from public.inventory_items
where name = 'マスク';

insert into public.inventory_transactions (item_id, transaction_type, quantity, transaction_date, note)
select id, 'inbound', 8, current_date, '初期入庫'
from public.inventory_items
where name = '消毒液';

insert into public.inventory_transactions (item_id, transaction_type, quantity, transaction_date, note)
select id, 'inbound', 12, current_date, '初期入庫'
from public.inventory_items
where name = 'コピー用紙';
```

### 5.7 RLS 方針

Supabase では RLS を有効化する。今回の在庫一覧は参照のみのため、認証済みユーザーが `inventory_items`、`inventory_transactions` を参照できる SELECT ポリシーを用意する。

`inventory_stock_summary` は通常のビューであり、テーブルと同じ形で RLS ポリシーを定義しない。RLS をベーステーブル側で効かせるため、PostgreSQL のバージョンが対応している場合は `create view ... with (security_invoker = true)` を使用する。あわせて認証済みユーザーへビューの `select` 権限を付与する。

例:

```sql
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;

create policy inventory_items_select_authenticated
  on public.inventory_items
  for select
  to authenticated
  using (true);

create policy inventory_transactions_select_authenticated
  on public.inventory_transactions
  for select
  to authenticated
  using (true);

grant select on public.inventory_stock_summary to authenticated;
```

更新操作は今回の画面では実装しない。後続の入庫・出庫・品目マスタ管理では Server Action / RPC 経由に集約する。

## 6. Next.js 実装手順

### 6.1 ディレクトリ構成

App Router を使用し、以下の構成を作成する。

```text
src/
├── app/
│   ├── layout.tsx
│   ├── (main)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── inbound/
│   │   │   └── page.tsx
│   │   ├── outbound/
│   │   │   └── page.tsx
│   │   └── items/
│   │       └── page.tsx
│   └── api/
│       └── inventory-stock-summary/
│           └── route.ts
├── components/
│   └── app-sidebar.tsx
├── features/
│   └── inventory/
│       ├── components/
│       │   ├── inventory-list-client.tsx
│       │   └── inventory-table.tsx
│       └── types/
│           └── inventory.ts
└── lib/
    └── supabase/
        ├── client.ts
        └── server.ts
```

プロジェクトが `src/` を使わない構成の場合は、既存構成に合わせる。ただし App Router のルーティングは `app/` 配下に置く。技術要件のルートグループ方針に合わせ、在庫一覧・入庫登録・出庫登録・品目マスタ管理は `app/(main)/` 配下に配置する。

### 6.2 Supabase クライアント

ガイドラインに従い、Supabase クライアントを分離する。

- SSR / Server Component: `lib/supabase/server.ts`
- Browser / Client Component: `lib/supabase/client.ts`

Service Role キーはクライアントへ露出しない。

### 6.3 型定義

在庫一覧用の型を定義する。

```ts
export type InventoryStockSummary = {
  itemId: string;
  itemCode: number;
  name: string;
  category: string | null;
  unit: string;
  inboundQuantity: number;
  outboundQuantity: number;
  currentQuantity: number;
};
```

DB から返る snake_case は、Server Component または取得関数で camelCase に変換する。

### 6.4 データ取得

正規ガイドラインの「SSR シード + SWR」に従う。

1. 在庫一覧を表示する最小共通祖先で初回データを取得する。
2. `SWRConfig.fallback` に `/api/inventory-stock-summary` などのキーで初期値を渡す。
3. クライアント側では同じキーで SWR 再検証する。

今回の画面はトップページのみだが、後続でサイドバー配下の複数ページを追加する前提を考慮し、在庫一覧データの初回シードは在庫一覧ページ専用の境界に限定する。`app/layout.tsx` や `app/(main)/layout.tsx` で在庫一覧データを取得すると、`/inbound`、`/outbound`、`/items` でも不要な取得が走るため避ける。

実装例:

- `app/(main)/layout.tsx`: サイドバーとメイン領域の共通レイアウトのみを担当する。
- `app/(main)/page.tsx`: 初期表示用の在庫一覧データをサーバー取得し、在庫一覧 Client Component へ渡す。
- 在庫一覧 Client Component: `SWRConfig.fallback` または `useSWR` の `fallbackData` で初期値を受け取り、同じキーで再検証する。

初期表示時のキーとクライアント再検証のキーは完全一致させる。検索語なしの場合は `/api/inventory-stock-summary`、検索語ありの場合は `/api/inventory-stock-summary?name=${encodeURIComponent(searchName)}` を使用する。

### 6.5 API Route

SWR 再検証用に参照専用 Route Handler を作成する。

```text
src/app/api/inventory-stock-summary/route.ts
```

この Route Handler は `inventory_stock_summary` を `item_code` 昇順で取得し、JSON を返す。

検索文字列をサーバーで処理する場合は、`?name=検索語` を受け取り、品目名に対して部分一致検索を行う。

実際の配置はルートグループの外側に置き、`app/api/inventory-stock-summary/route.ts` とする。`src/` を使う構成では `src/app/api/inventory-stock-summary/route.ts` とする。

### 6.6 レイアウト

`app/(main)/layout.tsx` で業務画面の左右レイアウトを作る。

- 左側: サイドバー
- 右側: メインコンテンツ

サイドバーは固定幅、メインは残り幅を使用する。スマートフォンでは縦並び、または上部ナビに近い表示に切り替える。

`app/layout.tsx` は HTML ルート、グローバルCSS、Provider 注入などアプリ全体に必要な責務に留める。

### 6.7 サイドバー

`components/app-sidebar.tsx` を作成し、以下のリンクを表示する。

| 表示名 | 遷移先 |
| --- | --- |
| 在庫一覧 | `/` |
| 入庫登録 | `/inbound` |
| 出庫登録 | `/outbound` |
| 品目マスタ管理 | `/items` |

現在のページが分かるよう、該当リンクに簡単なアクティブ表示を付ける。

### 6.8 トップページ

`app/(main)/page.tsx` を在庫一覧ページとする。URL はトップページ `/` のままとする。

表示順は以下。

1. タイトル `在庫一覧`
2. 品目名検索フォーム
3. 在庫一覧テーブル

### 6.9 品目名検索フォーム

検索フォームは品目名の部分一致検索を行う。

実装方法は以下のどちらかとする。

- 入力値を URL Query `?name=...` に反映し、Server Component / Route Handler で取得し直す。
- SWR キーに検索語を含め、Route Handler で検索する。

SSR シード + SWR の整合性を保つため、採用する SWR キーには検索語を含める。

例:

```ts
const swrKey = `/api/inventory-stock-summary?name=${encodeURIComponent(searchName)}`;
```

### 6.10 在庫一覧テーブル

表はシンプルな HTML table とし、見出しの下にデータを表示する。

列は以下。

| 列名 | データ |
| --- | --- |
| 品目コード | `itemCode` |
| 品目名 | `name` |
| カテゴリ | `category` |
| 現在在庫数 | `currentQuantity` |
| 単位 | `unit` |

データが0件の場合は、表内または表の下に「該当する品目がありません」と表示する。

## 7. プレースホルダーページ

サイドバーから遷移できるよう、以下のページはプレースホルダーとして作成する。

- `/inbound`
- `/outbound`
- `/items`

各ページではタイトルのみを表示し、実処理は後続実装とする。

例:

```text
入庫登録
```

## 8. 環境変数

`.env.local` に以下を設定する。

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

在庫一覧の参照のみであれば、Server Component では通常の Supabase SSR クライアントを使用する。`SUPABASE_SERVICE_ROLE_KEY` は今回の参照画面では必須にしない。必要な管理操作や将来の RPC 実行時に利用する場合のみ `.env.local` に追加し、サーバー専用として扱う。

## 9. 検証手順

### 9.1 DB 検証

Supabase SQL Editor またはローカル Supabase で以下を確認する。

```sql
select *
from public.inventory_stock_summary
order by item_code asc;
```

期待結果:

- 初期投入した品目が表示される。
- `current_quantity` が入庫合計 - 出庫合計になっている。
- 品目コードが自動採番されている。

### 9.2 画面検証

1. トップページ `/` を開く。
2. 左側にサイドバーが表示される。
3. サイドバーに以下が表示される。
   - 在庫一覧
   - 入庫登録
   - 出庫登録
   - 品目マスタ管理
4. 右側にタイトル `在庫一覧` が表示される。
5. 品目名検索フォームが表示される。
6. 在庫一覧テーブルが表示される。
7. テーブルに以下の列が表示される。
   - 品目コード
   - 品目名
   - カテゴリ
   - 現在在庫数
   - 単位
8. 品目名の一部を入力すると、該当品目だけが表示される。
9. サイドバーの各リンクから該当ページへ遷移できる。

### 9.3 品質ゲート

実装後に以下を実行する。

```bash
npm run lint
npm run build
```

どちらも成功することを確認する。

## 10. 受け入れ基準

- トップページ `/` が在庫一覧として表示される。
- 画面左側にサイドバー、右側に在庫一覧が表示される。
- サイドバーに4つのメニューが表示され、それぞれ遷移できる。
- 在庫一覧にタイトル、品目名検索フォーム、表が表示される。
- 表は見出し行とデータ行を持つシンプルな表である。
- 表には品目コード、品目名、カテゴリ、現在在庫数、単位が表示される。
- 現在在庫数は `inventory_stock_summary` から取得した値を表示する。
- 品目名検索で部分一致検索ができる。
- ローカル開発環境では、スキーママイグレーションと開発用 seed により画面確認できる状態に復元できる。

## 11. 関連ドキュメント修正判断

今回の手順は既存の機能要件・技術要件・DB設計書の範囲内で実装できるため、以下のドキュメント修正は不要と判断する。

- `docs/best-practices/development-guidelines.md`
- `docs/design specification/functional_requirements.md`
- `docs/design specification/technical-requirements.md`
- `docs/design specification/database-table-design.md`
