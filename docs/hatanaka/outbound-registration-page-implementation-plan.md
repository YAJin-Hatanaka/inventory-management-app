# 出庫登録画面 実装手順書

## 1. 目的

出庫登録画面だけを実装する。画面は左側にサイドバー、右側に出庫登録フォームを表示するシンプルな構成とする。

出庫登録では、登録済み品目を選択し、現在在庫数を確認しながら出庫数量を入力できるようにする。現在在庫数を超える出庫は登録不可とし、UI と Supabase RPC の両方で検証する。

出庫による在庫減算は、在庫データを削除するのではなく `inventory_transactions` に `transaction_type = 'outbound'` の履歴を追加して表現する。現在在庫数は既存方針どおり `入庫数量合計 - 出庫数量合計` で算出する。

## 2. 前提ドキュメント

実装時は以下を優先する。

- `docs/best-practices/development-guidelines.md`
- `docs/design specification/functional_requirements.md`
- `docs/design specification/technical-requirements.md`
- `docs/design specification/database-table-design.md`

`docs/Past documents/*` は参考資料扱いとし、正規ルールとして扱わない。

## 3. 実装スコープ

### 3.1 対象

- `/outbound` の出庫登録画面作成
- 既存品目を選択するドロップダウン作成
- 選択品目の品目名、カテゴリ、単位、現在在庫数の表示
- 出庫数量、出庫日、備考の入力フォーム作成
- 出庫数量の上限を現在在庫数以下に制限
- 出庫登録用 Server Action 作成
- Supabase の出庫登録 RPC `register_outbound_transaction` 追加
- 同一品目への同時出庫で在庫数が負数にならない排他制御
- 出庫登録 RPC の実行権限設定
- 出庫登録に必要な型定義更新
- 登録成功時のフォーム初期化と簡易メッセージ表示
- 登録失敗時のエラーメッセージ表示

### 3.2 対象外

- 在庫一覧画面の追加改修
- 入庫登録画面の実装
- 品目マスタ管理画面の実装
- 入出庫履歴一覧
- 認可ロール管理
- 複数倉庫、ロット管理
- 本番または共有検証環境のデータ削除

今回の画面では、新規品目登録は行わない。出庫対象は既存の `inventory_stock_summary` に存在する品目から選択する。

## 4. 完成イメージ

画面構成は以下とする。

```text
+----------------------+--------------------------------------+
| サイドバー           | 出庫登録                             |
|                      |                                      |
| - 在庫一覧           | 品目                                 |
| - 入庫登録           | [既存品目を選択 v]                   |
| - 出庫登録           |                                      |
| - 品目マスタ管理     | 現在在庫数                           |
|                      | 17 箱                                |
|                      |                                      |
|                      | 出庫数量                             |
|                      | [1 以上、現在在庫数以下の整数]       |
|                      | 出庫日                               |
|                      | [YYYY-MM-DD]                         |
|                      | 備考                                 |
|                      | [任意入力]                           |
|                      | [登録する]                           |
+----------------------+--------------------------------------+
```

レイアウトは既存の `src/app/(main)/layout.tsx` と `src/components/app-sidebar.tsx` を利用する。`/outbound` ページ側では右側の出庫登録コンテンツだけを実装する。

## 5. Supabase 実装手順

### 5.1 既存スキーマの確認

在庫一覧トップページ実装で以下が作成済みであることを確認する。

- `inventory_items`
- `inventory_transactions`
- `inventory_stock_summary`

未作成の場合は、先に在庫一覧トップページ用のマイグレーションを適用する。

### 5.2 データ削除の扱い

出庫登録では Supabase データベースから既存データを削除しない。出庫は `inventory_transactions` への履歴追加で表現し、在庫数はビューで再計算する。

既存データを削除して作り直す必要がある場合は、ローカル開発環境であることを確認したうえで、マイグレーションとは別の明示的なリセット手順として実行する。本番環境や共有検証環境でリセット手順を実行しない。

ローカル開発環境でのみ全在庫データを初期化する例:

```sql
truncate table public.inventory_transactions restart identity cascade;
truncate table public.inventory_items restart identity cascade;
```

この SQL は通常の本番適用マイグレーションに含めない。必要な開発確認用データは `supabase/seed.sql` などローカル専用 seed として投入する。

### 5.3 出庫登録 RPC 追加

`supabase/migrations/*` に出庫登録用 RPC を追加する。更新操作は UI から直接 `supabase-js` で `insert` せず、Server Action から RPC を呼び出す。

現在在庫数を超える出庫を防ぐため、RPC 内で対象品目行を `select ... for update` し、在庫数の算出と履歴登録を同一トランザクション内で行う。

`security definer` の RPC は実行権限を明示的に制限する。権限設定を省略すると、PostgREST 経由で `anon` や想定外ロールから直接実行される可能性があるため、Server Action 集約のルールを破るリスクがある。

```sql
create or replace function public.register_outbound_transaction(
  p_item_id uuid,
  p_quantity integer,
  p_transaction_date date,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_current_quantity bigint;
  v_transaction_id uuid;
begin
  if p_item_id is null then
    raise exception 'item_id is required';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity must be greater than or equal to 1';
  end if;

  if p_transaction_date is null then
    raise exception 'transaction_date is required';
  end if;

  if p_note is not null and btrim(p_note) = '' then
    p_note := null;
  end if;

  select id
    into v_item_id
  from public.inventory_items
  where id = p_item_id
  for update;

  if v_item_id is null then
    raise exception 'item does not exist';
  end if;

  select
    coalesce(sum(quantity) filter (where transaction_type = 'inbound'), 0)
      - coalesce(sum(quantity) filter (where transaction_type = 'outbound'), 0)
    into v_current_quantity
  from public.inventory_transactions
  where item_id = p_item_id;

  if v_current_quantity < p_quantity then
    raise exception 'quantity exceeds current stock';
  end if;

  insert into public.inventory_transactions (
    item_id,
    transaction_type,
    quantity,
    transaction_date,
    note
  )
  values (
    p_item_id,
    'outbound',
    p_quantity,
    p_transaction_date,
    p_note
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

revoke execute on function public.register_outbound_transaction(
  uuid,
  integer,
  date,
  text
) from public, anon, authenticated;

grant execute on function public.register_outbound_transaction(
  uuid,
  integer,
  date,
  text
) to service_role;
```

認証未実装期間でも更新系は匿名ロールへ直接 `insert` 権限を付与しない。今回の Server Action はサーバー専用の Service Role クライアントから RPC を呼び出す方針とする。

Service Role キーの扱い:

- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用環境変数として扱う。
- `NEXT_PUBLIC_*` に Service Role キーを置かない。
- Client Component へ Service Role キーや Service Role クライアントを渡さない。
- Service Role クライアント作成処理は `src/lib/supabase/server.ts` などサーバー境界内に閉じる。

将来、認証実装後に `authenticated` ロールから RPC を直接実行させる必要が出た場合は、業務権限設計を追加したうえで、対象関数に限定して `grant execute` を行う。その場合もテーブルへの直接 `insert` は許可しない。

### 5.4 開発確認用データ

出庫登録では現在在庫数が 1 以上の品目が必要になる。ローカル開発環境の seed へ、入庫履歴を持つ品目データを用意する。

既存の `supabase/seed.sql` に在庫あり品目がある場合は追加不要。足りない場合のみ、ローカル用 seed に以下のような品目と入庫履歴を追加する。

```sql
insert into public.inventory_items (name, category, unit)
values
  ('ニトリル手袋', '消耗品', '箱'),
  ('マスク', '消耗品', '箱')
on conflict (name) do nothing;

insert into public.inventory_transactions (item_id, transaction_type, quantity, transaction_date, note)
select id, 'inbound', 20, current_date, '出庫登録確認用'
from public.inventory_items
where name = 'ニトリル手袋'
  and not exists (
    select 1
    from public.inventory_transactions t
    where t.item_id = public.inventory_items.id
      and t.transaction_type = 'inbound'
      and t.note = '出庫登録確認用'
  );

insert into public.inventory_transactions (item_id, transaction_type, quantity, transaction_date, note)
select id, 'inbound', 15, current_date, '出庫登録確認用'
from public.inventory_items
where name = 'マスク'
  and not exists (
    select 1
    from public.inventory_transactions t
    where t.item_id = public.inventory_items.id
      and t.transaction_type = 'inbound'
      and t.note = '出庫登録確認用'
  );
```

`inventory_transactions` には上記 seed の重複投入を防ぐ一意制約がないため、再実行しても同じ確認用入庫が増えないよう `not exists` で抑止する。ローカルデータを完全に作り直す場合は、先に 5.2 のリセット手順を実行してから seed を投入する。

### 5.5 型定義更新

Supabase 型生成または手動更新により、`src/types/database.ts` の `Functions` に `register_outbound_transaction` を追加する。

```ts
Functions: {
  register_outbound_transaction: {
    Args: {
      p_item_id: string;
      p_quantity: number;
      p_transaction_date: string;
      p_note?: string | null;
    };
    Returns: string;
  };
};
```

既存の `Functions: Record<string, never>` は RPC 呼び出しを型安全に扱えないため、出庫登録実装時に必ず更新する。

## 6. Next.js 実装手順

### 6.1 ディレクトリ構成

既存構成に合わせ、出庫登録関連を `src/features/inventory` 配下に追加する。

```text
src/
├── app/
│   ├── (main)/
│   │   └── outbound/
│   │       └── page.tsx
│   └── api/
│       └── inventory-stock-summary/
│           └── route.ts
└── features/
    └── inventory/
        ├── actions/
        │   └── register-outbound-transaction.ts
        ├── components/
        │   └── outbound-registration-form.tsx
        ├── lib/
        │   ├── inventory-stock-summary.ts
        │   └── outbound-registration.ts
        ├── schemas/
        │   └── outbound-registration-schema.ts
        └── types/
            └── inventory.ts
```

必要なファイルだけを追加する。既存の在庫一覧コンポーネント、入庫登録コンポーネント、サイドバーは再利用できる範囲で再利用する。

### 6.2 品目選択用データ取得

出庫登録では現在在庫数を表示し、数量上限として利用するため、`inventory_stock_summary` から品目候補を取得する。

取得項目はフォームに必要な最小限にする。

- `item_id`
- `item_code`
- `name`
- `category`
- `unit`
- `current_quantity`

表示順は `item_code` 昇順とする。現在在庫数が 0 の品目を選択肢に出す場合は、選択後に登録ボタンを無効化し「在庫がありません」と表示する。操作性を優先する場合は `current_quantity > 0` の品目だけを候補にしてもよいが、どちらの場合も RPC 側の在庫超過検証は必須とする。

型例:

```ts
export type OutboundInventoryItemOption = {
  readonly itemId: string;
  readonly itemCode: number;
  readonly name: string;
  readonly category: string | null;
  readonly unit: string;
  readonly currentQuantity: number;
};
```

### 6.3 SSR シードの扱い

出庫登録画面の初回表示に必要な品目候補は `/outbound` だけで利用するため、`src/app/(main)/outbound/page.tsx` でサーバー取得する。

`src/app/(main)/layout.tsx` はサイドバーとメイン領域の共通レイアウトに留める。`/outbound` 以外でも不要な在庫集計取得が走るため、共通レイアウトで品目データを取得しない。

正規ガイドラインの「SSR シード + SWR 再検証」に従い、品目候補も以下の構成で取得する。

1. `/outbound` ページで初回表示用の品目候補をサーバー取得する。
2. `/outbound` ページで `SWRConfig` の `fallback` に同じキーで初期データを設定する。
3. Client Component では同じキー `/api/inventory-stock-summary` で SWR 再検証する。

初回シードと SWR のキーは完全一致させる。今回の品目候補は施設や検索条件を持たないため、キーは `/api/inventory-stock-summary` とする。

実装イメージ:

```tsx
const stockSummaryKey = "/api/inventory-stock-summary";
const initialItems = await fetchInventoryStockSummary();

return (
  <SWRConfig value={{ fallback: { [stockSummaryKey]: initialItems } }}>
    <OutboundRegistrationForm stockSummaryKey={stockSummaryKey} />
  </SWRConfig>
);
```

`OutboundRegistrationForm` には初期配列を個別 props として渡すのではなく、`stockSummaryKey` を渡して `useSWR(stockSummaryKey, fetcher)` で取得する。これにより、SSR 初回表示とクライアント再検証で同一キャッシュキーを共有できる。

### 6.4 出庫登録ページ

`src/app/(main)/outbound/page.tsx` は Server Component とし、以下を行う。

1. `createClient` で Supabase SSR クライアントを作成する。
2. `fetchInventoryStockSummary` で品目候補を取得する。
3. `SWRConfig.fallback` に `/api/inventory-stock-summary` キーで品目候補を設定する。
4. タイトル `出庫登録` を表示する。
5. `OutboundRegistrationForm` に SWR キー `/api/inventory-stock-summary` を渡す。

ページ内の表示順は以下とする。

1. タイトル `出庫登録`
2. 既存品目選択ドロップダウン
3. 現在在庫数
4. 出庫数量入力
5. 出庫日入力
6. 備考入力
7. 登録ボタン

### 6.5 入力フォーム

`src/features/inventory/components/outbound-registration-form.tsx` を Client Component として作成する。フォーム状態管理は技術要件に従い、React Hook Form を使用する。バリデーションは `zodResolver` で `outbound-registration-schema.ts` の zod スキーマと接続する。

フォーム項目は以下とする。

| 項目 | 必須 | UI | 補足 |
| --- | --- | --- | --- |
| 品目 | 必須 | `select` | `inventory_stock_summary` から取得した候補を表示 |
| 現在在庫数 | - | text | 選択品目の `currentQuantity` と `unit` を表示 |
| 出庫数量 | 必須 | `input type="number"` | 1以上、現在在庫数以下の整数 |
| 出庫日 | 必須 | `input type="date"` | 初期値は当日 |
| 備考 | 任意 | `textarea` | 空文字は `null` として扱う |

UI は既存の Tailwind CSS 方針に合わせ、枠線・余白・文字サイズを抑えたシンプルな構成にする。新しい UI ライブラリや独自デザインシステムは追加しない。

React Hook Form の扱い:

- `useForm` の `defaultValues` に、初期品目未選択、数量空欄、出庫日当日、備考空欄を設定する。
- ドロップダウン変更時は選択品目を特定し、現在在庫数と単位を表示する。
- 出庫数量 input の `min` は `1`、`max` は選択品目の `currentQuantity` とする。
- 選択品目が未選択、または現在在庫数が 0 の場合は登録ボタンを無効化する。
- `formState.errors` を各入力欄の近くに表示する。
- 送信中は `formState.isSubmitting` または `useTransition` の状態で登録ボタンを無効化する。

### 6.6 バリデーション

`src/features/inventory/schemas/outbound-registration-schema.ts` に zod スキーマを作成し、Client Component と Server Action で共通利用する。

検証内容:

- `itemId`: UUID 形式、必須
- `quantity`: 1以上の整数
- `transactionDate`: YYYY-MM-DD、必須
- `note`: 任意。空白のみの場合は `null` 扱い

現在在庫数以下かどうかの最終検証は RPC 側で行う。Client Component では選択時点の `currentQuantity` を使って早期にエラー表示するが、同時出庫によって在庫数が変わる可能性があるため、クライアント側検証だけに依存しない。

### 6.7 Server Action

`src/features/inventory/actions/register-outbound-transaction.ts` を作成する。

責務:

1. FormData または構造化された入力値を受け取る。
2. zod スキーマで検証する。
3. Supabase サーバークライアントを作成する。
4. `register_outbound_transaction` RPC を呼び出す。
5. 成功時は `success: true` と登録IDを返す。
6. 失敗時は `success: false` とユーザー向けメッセージを返す。
7. 在庫超過エラーの場合は「現在在庫数を超える出庫は登録できません。」など具体的なメッセージに変換する。
8. 登録成功時に `revalidatePath("/")` と `revalidatePath("/outbound")` を実行し、在庫一覧と出庫登録画面の集計表示を再検証する。

返却型例:

```ts
export type RegisterOutboundTransactionResult =
  | {
      readonly success: true;
      readonly transactionId: string;
    }
  | {
      readonly success: false;
      readonly message: string;
    };
```

例外を投げっぱなしにせず、UI が表示できる結果型で返す。

### 6.8 登録後の画面挙動

登録成功時:

- 成功メッセージをフォーム上部または送信ボタン付近に表示する。
- 出庫数量、備考は初期化する。
- 出庫日は当日のままにする。
- 選択品目は維持してよい。連続出庫がしやすい。
- `/api/inventory-stock-summary` を SWR の `mutate` で再検証し、現在在庫数を更新する。
- 再検証後に現在在庫数が 0 になった場合は登録ボタンを無効化する。

登録失敗時:

- エラーメッセージを画面上に表示する。
- 入力値は維持する。
- 必須項目、数量不正、在庫超過はフォーム近くに分かるように表示する。

### 6.9 アクセシビリティ

- 各入力項目に `label` を関連付ける。
- エラー表示には `role="alert"` を付ける。
- 登録ボタンは送信中に `disabled` とし、二重送信を防ぐ。
- ドロップダウンの初期選択肢は「品目を選択してください」とする。

## 7. テスト実装手順

テストコードは実装側のコードを正として作成し、テスト都合で実装側を変更しない。

### 7.1 単体テスト

以下を Jest で確認する。

- 出庫登録 zod スキーマが正常値を受け付ける。
- `itemId` が UUID でない場合にエラーになる。
- `quantity` が 0、負数、小数、未入力の場合にエラーになる。
- `transactionDate` が YYYY-MM-DD でない場合にエラーになる。
- `note` の空白が `null` に正規化される。

### 7.2 コンポーネントテスト

`OutboundRegistrationForm` について、Testing Library で以下を確認する。

- ドロップダウンに品目候補が表示される。
- 品目選択後、現在在庫数と単位が表示される。
- 現在在庫数を超える数量を入力した場合にエラーが表示される。
- 現在在庫数が 0 の品目では登録ボタンが無効になる。
- エラー結果を受け取った場合にメッセージが表示される。

### 7.3 RPC / DB テスト

ローカル Supabase またはテスト用 Supabase で以下を確認する。

- 現在在庫数以下の出庫は `inventory_transactions` に `outbound` として登録される。
- 現在在庫数を超える出庫は例外になり、履歴が追加されない。
- 同一品目へ同時出庫しても現在在庫数が負数にならない。

### 7.4 E2E テスト

Playwright ではローカル Supabase またはテスト用 Supabase を使い、本番データを汚染しない。

確認内容:

1. `/outbound` を開く。
2. 左側にサイドバー、右側に `出庫登録` が表示される。
3. ドロップダウンから既存品目を選択する。
4. 現在在庫数が表示される。
5. 現在在庫数を超える数量を入力すると登録できない。
6. 現在在庫数以下の数量と出庫日を入力して登録する。
7. 成功メッセージが表示される。
8. 在庫一覧で対象品目の現在在庫数が減っている。

## 8. 検証手順

### 8.1 DB 検証

マイグレーション適用後、RPC が存在することを確認する。

```sql
select proname
from pg_proc
where proname = 'register_outbound_transaction';
```

ローカル開発環境で出庫登録後、履歴が追加されることを確認する。

```sql
select
  i.name,
  t.transaction_type,
  t.quantity,
  t.transaction_date,
  t.note
from public.inventory_transactions t
join public.inventory_items i on i.id = t.item_id
where t.transaction_type = 'outbound'
order by t.created_at desc
limit 5;
```

在庫集計が減っていることを確認する。

```sql
select *
from public.inventory_stock_summary
order by item_code asc;
```

在庫超過が登録されないことを確認する。

```sql
select public.register_outbound_transaction(
  '<item_id>',
  999999,
  current_date,
  '在庫超過確認'
);
```

この実行は例外になること。例外後に `inventory_transactions` へ該当履歴が追加されていないことを確認する。

### 8.2 画面検証

1. `/outbound` を開く。
2. 左側にサイドバーが表示される。
3. 右側にタイトル `出庫登録` が表示される。
4. タイトル下に既存品目選択ドロップダウンが表示される。
5. ドロップダウンで品目を選択すると、現在在庫数が表示される。
6. 出庫数量、出庫日、備考の入力フォームが表示される。
7. 数量未入力または 0 の場合、登録できずエラーが表示される。
8. 現在在庫数を超える数量の場合、登録できずエラーが表示される。
9. 正常値で登録すると成功メッセージが表示される。
10. Supabase の `inventory_transactions` に `transaction_type = 'outbound'` の履歴が追加される。
11. 在庫一覧の現在在庫数が出庫数量分減る。

### 8.3 品質ゲート

実装後に以下を実行する。

```bash
npm run lint
npm run test
npm run build
```

すべて成功することを確認する。型確認を明示したい場合は `npm run typecheck` も実行する。

## 9. 受け入れ基準

- `/outbound` が出庫登録画面として表示される。
- 画面左側にサイドバー、右側に出庫登録が表示される。
- タイトル `出庫登録` が表示される。
- 既存品目を選択するドロップダウンが表示される。
- 品目選択後、現在在庫数と単位が表示される。
- 出庫数量、出庫日、備考を入力できる。
- 出庫数量は 1 以上の整数のみ登録できる。
- 現在在庫数を超える出庫は登録できず、エラーメッセージが表示される。
- 登録成功時、`inventory_transactions` に `transaction_type = 'outbound'` の履歴が追加される。
- 現在在庫数は `inventory_stock_summary` で出庫数量分減って確認できる。
- 同時出庫でも現在在庫数が負数にならない。
- 更新操作は Server Action / RPC 経由に集約され、クライアントから直接 `insert` しない。
- Service Role キーをクライアントへ露出しない。
- データ削除が必要な場合でも、本番適用マイグレーションに破壊的 SQL を含めない。

## 10. 関連ドキュメント修正判断

今回の要件は既存の機能要件・技術要件・DB設計書の範囲内で実装できる。

- `docs/best-practices/development-guidelines.md`: 修正不要。SSR シード、Server Action、Supabase 境界の既存ルールに従う。
- `docs/design specification/functional_requirements.md`: 修正不要。出庫登録の入力項目、在庫超過禁止、登録結果は既に定義済み。
- `docs/design specification/technical-requirements.md`: 修正不要。Next.js App Router、Server Actions、React Hook Form、zod、Supabase の既存方針に従う。
- `docs/design specification/database-table-design.md`: 修正不要。`register_outbound_transaction` と排他制御は既に設計済みであり、今回の実装はその具体化に留まる。
