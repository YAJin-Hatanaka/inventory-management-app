# 品目マスタ管理画面 実装手順書

## 1. 目的

品目マスタ管理画面だけを実装する。画面は左側にサイドバー、右側に品目一覧と簡易フォームを表示するシンプルな構成とする。

品目マスタ管理では、品目の追加・編集・削除を行えるようにする。品目コードはシステム自動採番のため画面から編集させない。品目削除時は、関連する入出庫履歴も削除されることを確認ダイアログで明示し、承認後に削除する。

## 2. 前提ドキュメント

実装時は以下を優先する。

- `docs/best-practices/development-guidelines.md`
- `docs/design specification/functional_requirements.md`
- `docs/design specification/technical-requirements.md`
- `docs/design specification/database-table-design.md`

`docs/Past documents/*` は参考資料扱いとし、正規ルールとして扱わない。

## 3. 実装スコープ

### 3.1 対象

- `/items` の品目マスタ管理画面作成
- 品目名による部分一致検索
- 品目一覧テーブル表示
- 品目追加フォーム作成
- 品目編集フォーム作成
- 品目削除確認ダイアログ作成
- 品目追加・編集・削除用 Server Action 作成
- Supabase の品目マスタ管理 RPC 追加
  - `create_inventory_item`
  - `update_inventory_item`
  - `delete_inventory_item`
- 品目マスタ管理 RPC の実行権限設定
- 品目マスタ管理に必要な型定義更新
- 操作成功時の再検証と簡易メッセージ表示
- 操作失敗時のエラーメッセージ表示
- zod によるクライアント／サーバー共通バリデーション

### 3.2 対象外

- 在庫一覧画面の追加改修
- 入庫登録画面の実装
- 出庫登録画面の実装
- 入出庫履歴一覧
- カテゴリのマスタ管理
- CSV 入出力
- 認可ロール管理
- 複数倉庫、ロット管理
- 本番または共有検証環境のデータリセット

今回の画面では、カテゴリと単位はいずれも自由入力とする。カテゴリは任意、単位は必須とする。

## 4. 完成イメージ

画面構成は以下とする。

```text
+----------------------+----------------------------------------------+
| サイドバー           | 品目マスタ管理                               |
|                      |                                              |
| - 在庫一覧           | [品目名検索フォーム]                         |
| - 入庫登録           |                                              |
| - 出庫登録           | [新規追加]                                    |
| - 品目マスタ管理     |                                              |
|                      | 品目コード | 品目名 | カテゴリ | 単位 | 操作 |
|                      | 0001     | 手袋   | 消耗品   | 箱   | 編集 |
|                      | 0002     | マスク | 消耗品   | 箱   | 削除 |
+----------------------+----------------------------------------------+
```

新規追加と編集は、画面内のシンプルなフォームまたは同一画面内の小さなパネルで行う。大きなモーダルや複雑なステップ UI は使わない。

レイアウトは既存の `src/app/(main)/layout.tsx` と `src/components/app-sidebar.tsx` を利用する。`/items` ページ側では右側の品目マスタ管理コンテンツだけを実装する。

## 5. Supabase 実装手順

### 5.1 既存スキーマの確認

在庫一覧トップページ実装で以下が作成済みであることを確認する。

- `inventory_items`
- `inventory_transactions`
- `inventory_stock_summary`

未作成の場合は、先に在庫一覧トップページ用のマイグレーションを適用する。

品目マスタ管理では、`inventory_items` を主対象とする。削除時の関連履歴削除は `inventory_transactions.item_id` の `on delete cascade` によって行う。

### 5.2 データ削除の扱い

機能要件に従い、品目および関連する入出庫履歴は物理削除とする。

ただし、通常のマイグレーションに既存データの `truncate` や `drop` を含めない。本番・共有検証環境に適用され得るため、破壊的な初期化処理は実装マイグレーションと分離する。

ローカル開発環境でのみ全在庫データを初期化する例:

```sql
truncate table public.inventory_transactions restart identity cascade;
truncate table public.inventory_items restart identity cascade;
```

この SQL は通常の本番適用マイグレーションに含めない。

### 5.3 品目マスタ管理 RPC 追加

`supabase/migrations/*` に品目マスタ管理用 RPC を追加する。更新操作は UI から直接 `supabase-js` で `insert` / `update` / `delete` せず、Server Action から RPC を呼び出す。

`security definer` の RPC は実行権限を明示的に制限する。権限設定を省略すると、PostgREST 経由で `anon` や想定外ロールから直接実行される可能性があるため、Server Action 集約のルールを破るリスクがある。

```sql
create or replace function public.create_inventory_item(
  p_name text,
  p_category text default null,
  p_unit text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_name text;
  v_category text;
  v_unit text;
begin
  v_name := btrim(coalesce(p_name, ''));
  v_category := nullif(btrim(coalesce(p_category, '')), '');
  v_unit := btrim(coalesce(p_unit, ''));

  if v_name = '' then
    raise exception 'item_name is required';
  end if;

  if v_unit = '' then
    raise exception 'unit is required';
  end if;

  insert into public.inventory_items (name, category, unit)
  values (v_name, v_category, v_unit)
  returning id into v_item_id;

  return v_item_id;
exception
  when unique_violation then
    raise exception 'item_name already exists';
end;
$$;

create or replace function public.update_inventory_item(
  p_item_id uuid,
  p_name text,
  p_category text default null,
  p_unit text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_name text;
  v_category text;
  v_unit text;
begin
  if p_item_id is null then
    raise exception 'item_id is required';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  v_category := nullif(btrim(coalesce(p_category, '')), '');
  v_unit := btrim(coalesce(p_unit, ''));

  if v_name = '' then
    raise exception 'item_name is required';
  end if;

  if v_unit = '' then
    raise exception 'unit is required';
  end if;

  update public.inventory_items
  set
    name = v_name,
    category = v_category,
    unit = v_unit,
    updated_at = now()
  where id = p_item_id
  returning id into v_item_id;

  if v_item_id is null then
    raise exception 'item not found';
  end if;

  return v_item_id;
exception
  when unique_violation then
    raise exception 'item_name already exists';
end;
$$;

create or replace function public.delete_inventory_item(
  p_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
begin
  if p_item_id is null then
    raise exception 'item_id is required';
  end if;

  delete from public.inventory_items
  where id = p_item_id
  returning id into v_item_id;

  if v_item_id is null then
    raise exception 'item not found';
  end if;

  return v_item_id;
end;
$$;

revoke execute on function public.create_inventory_item(text, text, text)
  from public, anon, authenticated;
revoke execute on function public.update_inventory_item(uuid, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.delete_inventory_item(uuid)
  from public, anon, authenticated;

grant execute on function public.create_inventory_item(text, text, text)
  to service_role;
grant execute on function public.update_inventory_item(uuid, text, text, text)
  to service_role;
grant execute on function public.delete_inventory_item(uuid)
  to service_role;
```

認証未実装期間でも更新系は匿名ロールへ直接 `insert` / `update` / `delete` 権限を付与しない。今回の Server Action はサーバー専用の Service Role クライアントから RPC を呼び出す方針とする。

`revoke` 後は、Server Action から利用する `service_role` にのみ `execute` を付与する。これにより、匿名ロールや通常の認証ロールからの直接 RPC 実行を防ぎつつ、サーバー境界の更新処理は実行できる。

Service Role キーの扱い:

- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用環境変数として扱う。
- `NEXT_PUBLIC_*` に Service Role キーを置かない。
- Client Component へ Service Role キーや Service Role クライアントを渡さない。
- Service Role クライアント作成処理は `src/lib/supabase/server.ts` などサーバー境界内に閉じる。

将来、認証実装後に `authenticated` ロールから RPC を直接実行させる必要が出た場合は、業務権限設計を追加したうえで、対象関数に限定して `grant execute` を行う。その場合もテーブルへの直接更新権限は安易に付与しない。

### 5.4 型定義更新

Supabase 型生成または手動更新により、`src/types/database.ts` の `Functions` に品目マスタ管理用 RPC を追加する。

```ts
Functions: {
  create_inventory_item: {
    Args: {
      p_name: string;
      p_category?: string | null;
      p_unit: string;
    };
    Returns: string;
  };
  update_inventory_item: {
    Args: {
      p_item_id: string;
      p_name: string;
      p_category?: string | null;
      p_unit: string;
    };
    Returns: string;
  };
  delete_inventory_item: {
    Args: {
      p_item_id: string;
    };
    Returns: string;
  };
};
```

既存の `Functions: Record<string, never>` は RPC 呼び出しを型安全に扱えないため、品目マスタ管理実装時に必ず更新する。

## 6. Next.js 実装手順

### 6.1 ディレクトリ構成

既存構成に合わせ、品目マスタ管理関連を `src/features/inventory` 配下に追加する。

```text
src/
├── app/
│   └── (main)/
│       └── items/
│           └── page.tsx
└── features/
    └── inventory/
        ├── actions/
        │   ├── create-inventory-item.ts
        │   ├── update-inventory-item.ts
        │   └── delete-inventory-item.ts
        ├── components/
        │   ├── item-master-client.tsx
        │   ├── item-master-form.tsx
        │   └── item-master-table.tsx
        ├── lib/
        │   └── inventory-items.ts
        ├── schemas/
        │   └── item-master-schema.ts
        └── types/
            └── inventory.ts
```

既に同名または近い責務のファイルが存在する場合は、既存ファイルを拡張する。重複した取得関数や型定義を増やさない。

### 6.2 型定義

`src/features/inventory/types/inventory.ts` に、品目マスタ管理で使う型を定義する。既に同等の型がある場合は再利用する。

```ts
export type InventoryItem = {
  readonly id: string;
  readonly itemCode: number;
  readonly name: string;
  readonly category: string | null;
  readonly unit: string;
};

export type InventoryItemFormValues = {
  readonly name: string;
  readonly category: string;
  readonly unit: string;
};
```

DB の `item_code` は UI では `itemCode` として扱う。境界変換は取得関数内に閉じ、コンポーネントに snake_case を持ち込まない。

### 6.3 バリデーションスキーマ

`src/features/inventory/schemas/item-master-schema.ts` を作成する。

```ts
import { z } from "zod";

export const itemMasterSchema = z.object({
  name: z.string().trim().min(1, "品目名を入力してください。"),
  category: z.string().trim().optional(),
  unit: z.string().trim().min(1, "単位を入力してください。"),
});

export const itemIdSchema = z.string().uuid("品目IDが不正です。");

export type ItemMasterInput = z.infer<typeof itemMasterSchema>;
```

品目名の重複は DB の unique 制約と RPC のエラーで最終的に防ぐ。UI 側では、重複時に「同じ品目名が既に登録されています。」のような利用者向けメッセージに変換する。

カテゴリは任意項目のため、Action 側では `trim()` 後に空文字であれば `null` として RPC に渡す。これにより、DB の `category is null or btrim(category) <> ''` 制約と UI の自由入力を整合させる。

### 6.4 品目取得関数

`src/features/inventory/lib/inventory-items.ts` を拡張し、品目マスタ管理用の一覧取得関数を用意する。

責務:

1. `lib/supabase/server.ts` の SSR クライアントを使う。
2. `inventory_items` を `item_code` 昇順で取得する。
3. 検索キーワードがある場合は品目名の部分一致で絞り込む。
4. DB 由来の snake_case を UI 用の camelCase に変換する。

検索条件:

- 対象カラム: `name`
- 条件: 部分一致
- 大文字小文字の扱い: Supabase PostgreSQL 側では `ilike` を使用する。

### 6.5 `/items` ページ

`src/app/(main)/items/page.tsx` を実装する。

責務:

1. `searchParams.q` を受け取る。
2. Server Component で品目一覧を取得する。
3. 見出し、説明文、検索フォーム、品目マスタ管理 Client Component を配置する。

ページ側はデータ取得と初期値受け渡しに寄せ、フォーム状態や編集対象の切り替えは Client Component に閉じる。

### 6.6 Client Component

`src/features/inventory/components/item-master-client.tsx` を作成する。

責務:

1. 初期品目一覧を受け取る。
2. 追加フォームと一覧テーブルを表示する。
3. 編集ボタン押下時に対象品目をフォームへ反映する。
4. キャンセル押下時に新規追加状態へ戻す。
5. 削除ボタン押下時に確認ダイアログを表示する。
6. Server Action の結果を受け取り、成功／失敗メッセージを表示する。

レイアウトは縦積みのシンプルな構成とする。PC では上部にフォーム、下部にテーブルを配置し、スマートフォンでも横スクロールまたはカード化で内容が読めるようにする。

### 6.7 検索フォーム

検索フォームは `/items?q=...` へ GET 送信する。

実装方針:

- 入力欄は 1 つだけにする。
- 検索ボタンとクリアリンクを用意する。
- 空文字の場合は `q` を付けず `/items` に戻す。
- クライアント側の過剰な状態管理は避ける。

検索は品目名だけを対象とし、カテゴリや単位の検索は今回対象外とする。

### 6.8 品目フォーム

`src/features/inventory/components/item-master-form.tsx` を作成する。

入力項目:

| 項目 | 必須 | 形式・備考 |
| --- | --- | --- |
| 品目名 | 必須 | 自由入力。重複不可 |
| カテゴリ | 任意 | 自由入力テキスト |
| 単位 | 必須 | 自由入力。例: 個、本、箱 |

表示仕様:

- 新規追加時の送信ボタンは「追加する」とする。
- 編集時の送信ボタンは「更新する」とする。
- 編集時も品目コードは表示のみとし、入力項目には含めない。
- 必須項目が未入力の場合は画面上にエラーメッセージを表示する。

### 6.9 品目一覧テーブル

`src/features/inventory/components/item-master-table.tsx` を作成する。

表示項目:

| 項目 | 説明 |
| --- | --- |
| 品目コード | システム自動採番のコード |
| 品目名 | 登録された品目名 |
| カテゴリ | 任意入力されたカテゴリ |
| 単位 | 品目ごとの単位 |
| 操作 | 編集、削除 |

表示順は品目コード昇順とする。検索結果が 0 件の場合は「該当する品目はありません。」を表示する。

### 6.10 削除確認

削除ボタン押下時は、ブラウザ標準の `window.confirm` または既存の確認 UI を使って確認する。既存 UI がない場合は、今回はシンプルさを優先して `window.confirm` でよい。

確認文言:

```text
品目「{品目名}」を削除します。
関連する入出庫履歴がある場合は併せて削除されます。
この操作は元に戻せません。削除してよろしいですか？
```

確認がキャンセルされた場合は Server Action を呼び出さない。

## 7. Server Action 実装手順

### 7.1 追加 Action

`src/features/inventory/actions/create-inventory-item.ts` を作成する。

責務:

1. 入力値を `itemMasterSchema` で検証する。
2. Service Role クライアントから `create_inventory_item` RPC を呼び出す。
3. 成功時に `/items` と `/` の再検証を行う。
4. 成功／失敗を Result 型で返す。

`/` も再検証する理由は、品目追加後に在庫一覧へ表示される可能性があるため。

### 7.2 更新 Action

`src/features/inventory/actions/update-inventory-item.ts` を作成する。

責務:

1. 品目IDを `itemIdSchema` で検証する。
2. 入力値を `itemMasterSchema` で検証する。
3. Service Role クライアントから `update_inventory_item` RPC を呼び出す。
4. 成功時に `/items`、`/`、`/inbound`、`/outbound` の再検証を行う。
5. 成功／失敗を Result 型で返す。

入庫・出庫画面は品目名、カテゴリ、単位を表示または選択肢として利用するため、更新後に再検証対象へ含める。

### 7.3 削除 Action

`src/features/inventory/actions/delete-inventory-item.ts` を作成する。

責務:

1. 品目IDを `itemIdSchema` で検証する。
2. Service Role クライアントから `delete_inventory_item` RPC を呼び出す。
3. 成功時に `/items`、`/`、`/inbound`、`/outbound` の再検証を行う。
4. 成功／失敗を Result 型で返す。

削除により関連する入出庫履歴も削除されるため、在庫一覧と入出庫画面の候補データを再検証する。

### 7.4 エラーメッセージ変換

DB/RPC 由来のエラーはそのまま表示しない。Action 内で利用者向け文言へ変換する。

| RPC エラー | 画面表示 |
| --- | --- |
| `item_name is required` | 品目名を入力してください。 |
| `unit is required` | 単位を入力してください。 |
| `item_name already exists` | 同じ品目名が既に登録されています。 |
| `item not found` | 対象の品目が見つかりません。画面を再読み込みしてください。 |
| その他 | 品目の保存に失敗しました。時間をおいて再度お試しください。 |

ログには詳細を残し、画面には安全なメッセージだけを返す。

## 8. テスト手順

### 8.1 単体テスト

以下を追加する。

- `src/features/inventory/schemas/item-master-schema.test.ts`
- `src/features/inventory/actions/create-inventory-item.test.ts`
- `src/features/inventory/actions/update-inventory-item.test.ts`
- `src/features/inventory/actions/delete-inventory-item.test.ts`

主な観点:

- 品目名が空の場合はエラーになる。
- 単位が空の場合はエラーになる。
- カテゴリは空でも許容される。
- 追加 Action が正常時に RPC と `revalidatePath` を呼ぶ。
- 更新 Action が正常時に RPC と必要な `revalidatePath` を呼ぶ。
- 削除 Action が正常時に RPC と必要な `revalidatePath` を呼ぶ。
- RPC エラーが利用者向けメッセージに変換される。

### 8.2 コンポーネントテスト

以下を追加する。

- `src/features/inventory/components/item-master-form.test.tsx`
- `src/features/inventory/components/item-master-table.test.tsx`

主な観点:

- 初期表示で品目一覧が表示される。
- 検索結果 0 件時のメッセージが表示される。
- 編集ボタン押下でフォームに対象品目が反映される。
- キャンセル押下で新規追加状態へ戻る。
- 削除キャンセル時は削除 Action が呼ばれない。

### 8.3 手動確認

ローカル環境で以下を確認する。

1. `/items` を開くと品目マスタ管理画面が表示される。
2. 品目名で部分一致検索できる。
3. 品目名、カテゴリ、単位を入力して品目を追加できる。
4. 品目追加後、品目コードが自動採番される。
5. 品目名と単位を編集できる。
6. 編集時に品目コードは変更できない。
7. 品目名を重複させると登録できずエラーメッセージが表示される。
8. 必須項目が未入力の場合は登録できずエラーメッセージが表示される。
9. 削除時に関連履歴も削除される旨の確認ダイアログが表示される。
10. 確認後に品目を削除できる。
11. 削除した品目が `/`、`/inbound`、`/outbound` の候補に残らない。

### 8.4 品質ゲート

実装後に以下を実行する。

```bash
npm run lint
npm run build
npm test -- item-master
```

テストコマンドは既存の `package.json` に合わせる。`npm test -- item-master` が利用できない場合は、該当テストファイルを対象にできる既存コマンドへ置き換える。

## 9. 受け入れ基準

1. `/items` で品目マスタ管理画面が表示される。
2. 品目名による部分一致検索ができる。
3. 品目を追加できる。
4. 品目を編集できる。
5. 品目コードはシステムが自動採番し、画面から編集できない。
6. 品目を削除できる。
7. 品目削除時に、関連する入出庫履歴も削除される旨が確認ダイアログに表示される。
8. 必須項目が未入力の場合は登録・更新できず、エラーメッセージが表示される。
9. 品目名が重複する場合は登録・更新できず、エラーメッセージが表示される。
10. 更新操作は Server Action 経由で実行され、Client Component から Supabase へ直接更新しない。
11. Service Role キーがクライアントへ露出しない。
12. `npm run lint` と `npm run build` が通る。

## 10. 実装チェックリスト

- [ ] 既存の `inventory_items` / `inventory_transactions` / `inventory_stock_summary` を確認した
- [ ] 品目マスタ管理用 RPC をマイグレーションに追加した
- [ ] RPC の `execute` 権限を明示的に制限した
- [ ] `src/types/database.ts` の `Functions` を更新した
- [ ] `/items` ページを Server Component として実装した
- [ ] 品目一覧取得関数を実装した
- [ ] 品目追加 Server Action を実装した
- [ ] 品目更新 Server Action を実装した
- [ ] 品目削除 Server Action を実装した
- [ ] zod スキーマを追加した
- [ ] 品目フォームを実装した
- [ ] 品目一覧テーブルを実装した
- [ ] 削除確認ダイアログを実装した
- [ ] 操作成功／失敗メッセージを表示した
- [ ] 単体テストを追加した
- [ ] コンポーネントテストを追加した
- [ ] `npm run lint` を実行した
- [ ] `npm run build` を実行した
