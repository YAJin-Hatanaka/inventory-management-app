# 入庫登録画面 実装手順書

## 1. 目的

入庫登録画面だけを実装する。画面は左側にサイドバー、右側に入庫登録フォームを表示するシンプルな構成とする。

入庫登録では、既に在庫に存在する品目をドロップダウンで選択できるようにし、選択後は入力フォームの品目名・カテゴリ・単位に反映する。品目名は新規入力も可能とし、新規品目の場合はプルダウンで選択されたカテゴリと単位で品目マスタに追加してから入庫履歴を追加する。

## 2. 前提ドキュメント

実装時は以下を優先する。

- `docs/best-practices/development-guidelines.md`
- `docs/design specification/functional_requirements.md`
- `docs/design specification/technical-requirements.md`
- `docs/design specification/database-table-design.md`

`docs/Past documents/*` は参考資料扱いとし、正規ルールとして扱わない。

## 3. 実装スコープ

### 3.1 対象

- `/inbound` の入庫登録画面作成
- 既存品目を選択するドロップダウン作成
- 選択した品目名を入力フォームへ反映
- 新規品目名の入力と品目マスタ追加
- カテゴリと単位をプルダウンから選択
- 入庫数量、入庫日、備考の入力フォーム作成
- 入庫登録用 Server Action 作成
- Supabase の入庫登録 RPC `register_inbound_transaction` 追加
- 入庫登録 RPC の実行権限設定
- 入庫登録に必要な型定義更新
- 登録成功時のフォーム初期化と簡易メッセージ表示
- 登録失敗時のエラーメッセージ表示

### 3.2 対象外

- 在庫一覧画面の追加改修
- 出庫登録画面の実装
- 品目マスタ管理画面の実装
- 入出庫履歴一覧
- 認可ロール管理
- 複数倉庫、ロット管理

今回の画面では、ドロップダウンに表示する品目は既存の `inventory_items` から取得する。ドロップダウン未選択または別名入力時は、新規品目として `inventory_items` に追加する。

## 4. 完成イメージ

画面構成は以下とする。

```text
+----------------------+--------------------------------------+
| サイドバー           | 入庫登録                             |
|                      |                                      |
| - 在庫一覧           | [既存品目を選択 v]                   |
| - 入庫登録           |                                      |
| - 出庫登録           | 品目名                               |
| - 品目マスタ管理     | [選択/新規入力した品目名]            |
|                      | 入庫数量                             |
|                      | [1以上の整数]                        |
|                      | 入庫日                               |
|                      | [YYYY-MM-DD]                         |
|                      | 備考                                 |
|                      | [任意入力]                           |
|                      | [登録する]                           |
+----------------------+--------------------------------------+
```

レイアウトは既存の `src/app/(main)/layout.tsx` と `src/components/app-sidebar.tsx` を利用する。`/inbound` ページ側では右側の入庫登録コンテンツだけを実装する。

## 5. Supabase 実装手順

### 5.1 既存スキーマの確認

在庫一覧トップページ実装で以下が作成済みであることを確認する。

- `inventory_items`
- `inventory_transactions`
- `inventory_stock_summary`

未作成の場合は、先に在庫一覧トップページ用のマイグレーションを適用する。

### 5.2 入庫登録 RPC 追加

`supabase/migrations/*` に入庫登録用 RPC を追加する。更新操作は UI から直接 `supabase-js` で `insert` せず、Server Action から RPC を呼び出す。

`security definer` の RPC は実行権限を明示的に制限する。権限設定を省略すると、PostgREST 経由で `anon` や想定外ロールから直接実行される可能性があるため、Server Action 集約のルールを破るリスクがある。

```sql
create or replace function public.register_inbound_transaction(
  p_item_name text,
  p_quantity integer,
  p_transaction_date date,
  p_note text default null,
  p_unit text default '個',
  p_category text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_item_name text;
  v_unit text;
  v_category text;
  v_transaction_id uuid;
begin
  v_item_name := btrim(coalesce(p_item_name, ''));
  v_unit := btrim(coalesce(p_unit, '個'));
  v_category := nullif(btrim(coalesce(p_category, '')), '');

  if v_item_name = '' then
    raise exception 'item_name is required';
  end if;

  if v_unit = '' then
    v_unit := '個';
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

  insert into public.inventory_items (name, category, unit)
  values (v_item_name, v_category, v_unit)
  on conflict (name) do update
    set name = excluded.name
  returning id into v_item_id;

  insert into public.inventory_transactions (
    item_id,
    transaction_type,
    quantity,
    transaction_date,
    note
  )
  values (
    v_item_id,
    'inbound',
    p_quantity,
    p_transaction_date,
    p_note
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

revoke execute on function public.register_inbound_transaction(
  text,
  integer,
  date,
  text,
  text,
  text
) from public, anon, authenticated;
```

認証未実装期間でも更新系は匿名ロールへ直接 `insert` 権限を付与しない。今回の Server Action はサーバー専用の Service Role クライアントから RPC を呼び出す方針とする。

Service Role キーの扱い:

- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用環境変数として扱う。
- `NEXT_PUBLIC_*` に Service Role キーを置かない。
- Client Component へ Service Role キーや Service Role クライアントを渡さない。
- Service Role クライアント作成処理は `src/lib/supabase/server.ts` などサーバー境界内に閉じる。

将来、認証実装後に `authenticated` ロールから RPC を直接実行させる必要が出た場合は、業務権限設計を追加したうえで、対象関数に限定して `grant execute` を行う。その場合もテーブルへの直接 `insert` は許可しない。

### 5.3 開発確認用データ

ドロップダウン確認用に、ローカル開発環境の seed へ品目データを用意する。通常の本番適用マイグレーションへ開発用データ投入を混在させない。

既存の `supabase/seed.sql` に品目がある場合は追加不要。足りない場合のみ、ローカル用 seed に以下のような品目を追加する。

```sql
insert into public.inventory_items (name, category, unit)
values
  ('ニトリル手袋', '消耗品', '箱'),
  ('マスク', '消耗品', '箱'),
  ('消毒液', '衛生用品', '本')
on conflict (name) do nothing;
```

### 5.4 型定義更新

Supabase 型生成または手動更新により、`src/types/database.ts` の `Functions` に `register_inbound_transaction` を追加する。

```ts
Functions: {
  register_inbound_transaction: {
    Args: {
      p_item_name: string;
      p_quantity: number;
      p_transaction_date: string;
      p_note?: string | null;
      p_category?: string | null;
      p_unit?: string;
    };
    Returns: string;
  };
};
```

既存の `Functions: Record<string, never>` は RPC 呼び出しを型安全に扱えないため、入庫登録実装時に必ず更新する。

## 6. Next.js 実装手順

### 6.1 ディレクトリ構成

既存構成に合わせ、入庫登録関連を `src/features/inventory` 配下に追加する。

```text
src/
├── app/
│   ├── (main)/
│   │   └── inbound/
│   │       └── page.tsx
│   └── api/
│       └── inventory-items/
│           └── route.ts
└── features/
    └── inventory/
        ├── actions/
        │   └── register-inbound-transaction.ts
        ├── components/
        │   └── inbound-registration-form.tsx
        ├── lib/
        │   ├── inventory-items.ts
        │   └── inbound-registration.ts
        ├── schemas/
        │   └── inbound-registration-schema.ts
        └── types/
            └── inventory.ts
```

必要なファイルだけを追加する。既存の在庫一覧コンポーネントやサイドバーは再利用する。

### 6.2 品目選択用データ取得

`src/features/inventory/lib/inventory-items.ts` を作成し、Server Component から `inventory_items` を取得する関数を用意する。

取得項目はフォームに必要な最小限にする。

- `id`
- `item_code`
- `name`
- `unit`

表示順は `item_code` 昇順とする。

型例:

```ts
export type InventoryItemOption = {
  readonly id: string;
  readonly itemCode: number;
  readonly name: string;
  readonly unit: string;
};
```

### 6.3 SSR シードの扱い

入庫登録画面の初回表示に必要な品目選択肢は `/inbound` だけで利用するため、`src/app/(main)/inbound/page.tsx` でサーバー取得する。

`src/app/(main)/layout.tsx` はサイドバーとメイン領域の共通レイアウトに留める。`/inbound` 以外でも不要な品目取得が走るため、共通レイアウトで品目データを取得しない。

正規ガイドラインの「SSR シード + SWR 再検証」に従い、品目候補も以下の構成で取得する。

1. `/inbound` ページで初回表示用の品目候補をサーバー取得する。
2. Client Component へ初期値として渡す。
3. Client Component では同じキー `/api/inventory-items` で SWR 再検証する。

`/api/inventory-items` は参照専用 Route Handler とし、`inventory_items` から `id`、`item_code`、`name`、`unit` を `item_code` 昇順で返す。

初回シードと SWR のキーは完全一致させる。今回の品目候補は施設や検索条件を持たないため、キーは `/api/inventory-items` とする。

### 6.4 入庫登録ページ

`src/app/(main)/inbound/page.tsx` は Server Component とし、以下を行う。

1. `createClient` で Supabase SSR クライアントを作成する。
2. `fetchInventoryItemOptions` で品目候補を取得する。
3. タイトル `入庫登録` を表示する。
4. `InboundRegistrationForm` に品目候補と SWR キー `/api/inventory-items` を渡す。

ページ内の表示順は以下とする。

1. タイトル `入庫登録`
2. 既存品目選択ドロップダウン
3. 入力フォーム

### 6.5 入力フォーム

`src/features/inventory/components/inbound-registration-form.tsx` を Client Component として作成する。フォーム状態管理は技術要件に従い、React Hook Form を使用する。バリデーションは `zodResolver` で `inbound-registration-schema.ts` の zod スキーマと接続する。

フォーム項目は以下とする。

| 項目 | 必須 | UI | 補足 |
| --- | --- | --- | --- |
| 既存品目選択 | 任意 | `select` | `inventory_items` から取得した候補を表示。未選択時は新規入力 |
| 品目名 | 必須 | `input` | ドロップダウン選択時に選択品目名を反映。新規品目名も入力可能 |
| カテゴリ | 必須 | `select` | 10項目の固定候補から選択。既存品目選択時は既存カテゴリを反映 |
| 単位 | 必須 | `select` | 10項目の固定候補から選択。既存品目選択時は既存単位を反映 |
| 入庫数量 | 必須 | `input type="number"` | 1以上の整数 |
| 入庫日 | 必須 | `input type="date"` | 初期値は当日 |
| 備考 | 任意 | `textarea` | 空文字は `null` として扱う |

品目名 input は編集可能とする。ドロップダウンで既存品目を選択した場合は品目名・カテゴリ・単位を自動反映し、利用者が別名を入力した場合は新規品目として扱う。

UI は既存の Tailwind CSS 方針に合わせ、枠線・余白・文字サイズを抑えたシンプルな構成にする。新しい UI ライブラリや独自デザインシステムは追加しない。

React Hook Form の扱い:

- `useForm` の `defaultValues` に、初期品目未選択、数量空欄、入庫日当日、備考空欄を設定する。
- ドロップダウン変更時は `setValue` で `itemId`、`itemName`、`category`、`unit` を更新する。
- 品目名 input は登録値として送信する。既存名なら既存品目、新規名なら新規品目として Server Action / RPC 側で処理する。
- `formState.errors` を各入力欄の近くに表示する。
- 送信中は `formState.isSubmitting` または `useTransition` の状態で登録ボタンを無効化する。

### 6.6 バリデーション

`src/features/inventory/schemas/inbound-registration-schema.ts` に zod スキーマを作成し、Client Component と Server Action で共通利用する。

検証内容:

- `itemId`: UUID 形式または空文字。既存品目選択状態の保持に使う。
- `itemName`: 必須。既存品目名または新規品目名。
- `category`: 必須。固定候補から選択。
- `unit`: 必須。固定候補から選択。
- `quantity`: 1以上の整数
- `transactionDate`: YYYY-MM-DD、必須
- `note`: 任意。空白のみの場合は `null` 扱い

Server Action では必ず zod の検証を通してから RPC を呼び出す。クライアント側の HTML 属性だけに依存しない。

### 6.7 Server Action

`src/features/inventory/actions/register-inbound-transaction.ts` を作成する。

責務:

1. FormData または構造化された入力値を受け取る。
2. zod スキーマで検証する。
3. Supabase サーバークライアントを作成する。
4. `register_inbound_transaction` RPC を呼び出す。
5. 成功時は `success: true` と登録IDを返す。
6. 失敗時は `success: false` とユーザー向けメッセージを返す。
7. 登録成功時に `revalidatePath("/")` を実行し、在庫一覧の集計表示を再検証する。

返却型例:

```ts
export type RegisterInboundTransactionResult =
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
- 入庫数量、備考は初期化する。
- 入庫日は当日のままにする。
- 選択品目は維持してよい。連続入庫がしやすい。
- 在庫一覧の SWR キャッシュを更新する必要がある場合は、在庫一覧で使用しているキーに対して `mutate` を行う。新規品目を登録した場合は `/api/inventory-items` も再検証し、ドロップダウン候補へ反映する。

登録失敗時:

- エラーメッセージを画面上に表示する。
- 入力値は維持する。
- 必須項目と数量不正はフォーム近くに分かるように表示する。

### 6.9 アクセシビリティ

- 各入力項目に `label` を関連付ける。
- エラー表示には `role="alert"` を付ける。
- 登録ボタンは送信中に `disabled` とし、二重送信を防ぐ。
- ドロップダウンの初期選択肢は「品目を選択してください」とする。

## 7. テスト実装手順

テストコードは実装側のコードを正として作成し、テスト都合で実装側を変更しない。

### 7.1 単体テスト

以下を Jest で確認する。

- 入庫登録 zod スキーマが正常値を受け付ける。
- `quantity` が 0、負数、小数、未入力の場合にエラーになる。
- `transactionDate` が YYYY-MM-DD でない場合にエラーになる。
- `note` の空白が `null` に正規化される。

### 7.2 コンポーネントテスト

`InboundRegistrationForm` について、Testing Library で以下を確認する。

- ドロップダウンに品目候補が表示される。
- 品目選択後、品目名 input に選択品目名が反映される。
- 登録ボタン押下時に Server Action 呼び出しに必要な値が組み立てられる。
- エラー結果を受け取った場合にメッセージが表示される。

### 7.3 E2E テスト

Playwright ではローカル Supabase またはテスト用 Supabase を使い、本番データを汚染しない。

確認内容:

1. `/inbound` を開く。
2. 左側にサイドバー、右側に `入庫登録` が表示される。
3. ドロップダウンから既存品目を選択する。
4. 品目名フォームに選択品目名が反映される。
5. 入庫数量と入庫日を入力して登録する。
6. 成功メッセージが表示される。
7. 在庫一覧で対象品目の現在在庫数が増えている。

## 8. 検証手順

### 8.1 DB 検証

マイグレーション適用後、RPC が存在することを確認する。

```sql
select proname
from pg_proc
where proname = 'register_inbound_transaction';
```

ローカル開発環境で入庫登録後、履歴が追加されることを確認する。

```sql
select
  i.name,
  t.transaction_type,
  t.quantity,
  t.transaction_date,
  t.note
from public.inventory_transactions t
join public.inventory_items i on i.id = t.item_id
where t.transaction_type = 'inbound'
order by t.created_at desc
limit 5;
```

在庫集計が増えていることを確認する。

```sql
select *
from public.inventory_stock_summary
order by item_code asc;
```

### 8.2 画面検証

1. `/inbound` を開く。
2. 左側にサイドバーが表示される。
3. 右側にタイトル `入庫登録` が表示される。
4. タイトル下に既存品目選択ドロップダウンが表示される。
5. ドロップダウンで品目を選択すると、品目名フォームに選択品目名が表示される。
6. 入庫数量、入庫日、備考の入力フォームが表示される。
7. 数量未入力または 0 の場合、登録できずエラーが表示される。
8. 正常値で登録すると成功メッセージが表示される。
9. Supabase の `inventory_transactions` に `transaction_type = 'inbound'` の履歴が追加される。
10. 在庫一覧の現在在庫数が入庫数量分増える。

### 8.3 品質ゲート

実装後に以下を実行する。

```bash
npm run lint
npm run test
npm run build
```

すべて成功することを確認する。型確認を明示したい場合は `npm run typecheck` も実行する。

## 9. 受け入れ基準

- `/inbound` が入庫登録画面として表示される。
- 画面左側にサイドバー、右側に入庫登録が表示される。
- タイトル `入庫登録` が表示される。
- 既存品目を選択するドロップダウンが表示される。
- 品目選択後、品目名フォームに選択品目名が反映される。
- 入庫数量、入庫日、備考を入力できる。
- 必須項目未入力または数量不正の場合、登録できずエラーメッセージが表示される。
- 登録成功時、`inventory_transactions` に `transaction_type = 'inbound'` の履歴が追加される。
- 現在在庫数は `inventory_stock_summary` で入庫数量分増えて確認できる。
- 更新操作は Server Action / RPC 経由に集約され、クライアントから直接 `insert` しない。
- Service Role キーをクライアントへ露出しない。

## 10. 関連ドキュメント修正判断

今回の要件は既存の機能要件・技術要件・DB設計書の範囲内で実装できる。

- `docs/best-practices/development-guidelines.md`: 修正不要。SSR シード、Server Action、Supabase 境界の既存ルールに従う。
- `docs/design specification/functional_requirements.md`: 修正不要。入庫登録の入力項目と登録結果は既に定義済み。
- `docs/design specification/technical-requirements.md`: 修正不要。Next.js App Router、Server Actions、React Hook Form、zod、Supabase の既存方針に従う。
- `docs/design specification/database-table-design.md`: 修正不要。`register_inbound_transaction` は既に設計済みであり、今回の実装はその具体化に留まる。
