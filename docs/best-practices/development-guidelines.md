## 開発ガイドライン

本ガイドは、本リポジトリにおける「正規の開発ルール（SSOT）」です。日々の実装判断で迷わないための最小限の指針に絞り、詳細は各リファレンス/実装ガイドへ委譲します。

優先ドキュメント（上から優先）
- 本書: docs/best-practices/development-guidelines.md（本プロジェクトの正規ガイドライン）

衝突時の判断
- ルール間に矛盾が生じる場合は本書を最優先として従います。必要に応じて関連ドキュメントを更新してください。

---

### TL;DR（最初に確認すること）

- データ取得は最小共通祖先レイアウトで SSR シードし、クライアントでは同じキーで SWR 再検証する。
- Supabase は `lib/supabase/server.ts` / `lib/supabase/client.ts` を使い分け、Service Role キーはサーバー専用にする。
- 更新操作は Server Action/Route 経由に集約する。
- TypeScript strict・既存 UI 再利用・`npm run lint`/`npm run build` の品質ゲートを開発フローに組み込む。

---

### 1. 原則（必須）

- App Router 構成のディレクトリ規則は「2. ディレクトリ/ルーティング」を参照して厳守する。
- データ取得は「3. データ取得（SSR シード + SWR）」のパターンを徹底する。
- Supabase クライアントは SSR: `lib/supabase/server.ts`、Browser: `lib/supabase/client.ts` を使用。
- 更新操作は Server Action/Route 経由。Service Role キーはサーバーのみで使用し、クライアントへ露出しない。
- TypeScript は strict。`any` と不必要な型アサーションは禁止（詳細は `CLAUDE.md`）。

---

### 2. ディレクトリ/ルーティング

- App Router の `app/` 配下にページを配置する。Middleware は基本パススルーとし、業務ロジックを持たせない。
- Provider は `contexts/app/*` へ集約し、レイアウトでまとめて注入する（GlobalProviders 等）。

---

### 3. データ取得（SSR シード + SWR）

- 初回シード: 最小共通祖先レイアウトでサーバー取得し、子へ配信（`SWRConfig.fallback` 等）。
- 再検証: クライアントは同一キー（例: `/api/users`）で SWR を用いて再検証。キーは施設ID等の依存条件を含める。
- 施設スコープ: 施設選択は常に全施設から行える前提で実装し、SSR でもクライアントでも選択された施設IDをそのまま利用する。
- API/Action: UI からの更新は Server Action/Route に集約する。

---

### 4. Supabase

- SSR: `lib/supabase/server.ts` のクライアントを使用（`cookies()` 連携）。
- Browser: `lib/supabase/client.ts` を使用。
- 構成: Service Role キーはサーバーのみ。環境変数は `NEXT_PUBLIC_*` と Server-only を厳密に分離。
- スキーマ変更: マイグレーションは `supabase/migrations/*` に SQL として管理し、手動の本番直接 SQL は避ける。型は `npx supabase gen types` 等で生成し `types/database.ts` に集約する。
- データ更新経路: 業務上の重要更新は Server Action/Route から RPC（`public.*` 関数）または専用エンドポイント経由で行い、UI から直接 `supabase-js` で `update/insert` しない。
- 棚卸調整: `public.apply_stocktaking_adjustments` を唯一の差分反映経路とし、ロット増減は `public.stock_count_lot_adjustments` に記録される。手動 SQL で同テーブルを更新しない。

---

### 5. コーディング規約

- 型安全: TypeScript strict。`any`/過剰なアサーション禁止。型は `types/*` に集約し、Hooks/モックで再定義しない。
- 関数設計: 小さく純粋な関数を優先。副作用は Provider/Action/Route など境界で扱う。
- 命名: 省略形を避け、意図が伝わる英語名を用いる。
- 責務分離: Server（データ取得）と Client（体験/状態管理）を厳格に分離。
- パフォーマンス: 重い UI は動的 import。SSR 不要なものは `ssr: false` を検討。
- エラー: 例外を握り潰さず、ユーザー通知（トースト等）とロギングを標準化。
- 既存 UI の再利用を最優先する（不要な UI コンポーネントの新規追加を避ける）。
- 監査ログ: Server Action/Route で `recordAuditLog` を呼ぶ際は、購入申請操作を `action: 'purchase_request'` に統一し、`detail.kind: 'purchase_request_change'` へ `scope`/`action`/`target`/`before`/`after` を必ず格納する。施設名・キャンセル理由など UI で必要な補助情報は `payload.additional_info` に保持する。
- 購入申請の単価/数量: `requestedBoxCount` を唯一の入力値とし、`packSizeSnapshot` との積で個数表示を派生する。`unitPriceYenSnapshot` は箱単価として保持し、サーバー・クライアントとも個単価への再変換を行わない。

---

### 6. テスト/品質ゲート

- `npm run lint` で静的解析を通し、`npm run build`（型チェックを含む）でビルド通過を確認することを開発フローに組み込む。

---

### 7. 実装チェックリスト

- [ ] 画面は `app/` 配下に正しく配置されている
- [ ] 初回シード + SWR 再検証のパターンを採用している
- [ ] 更新は Server Action/Route 経由で行っている
- [ ] 型安全（strict、`any`/過剰アサーション無し）
- [ ] エラー通知とロギングが実装されている

---

### 8. モック運用/移行ポリシー

- 目的: 要件定義フェーズではモックで素早く画面検証し、その後 Supabase 本実装へ移行する。
- 責務分離: モックは「初回シードに必要な静的データ」のみに限定し、ビジネスロジックは `lib/*` の純関数へ切り出す。
- SSOT: 型は `types/*`、コード値/定数は `lib/constants/*`。モック内で型・定数を再定義しない。
- 配置: モックデータは `mocks/*` に置き、利用側は将来差し替えが容易な境界（`lib/api/*` 等）経由で参照する。
- 移行: 本実装移行時は（1）SSRの初回シードを Supabase 取得に置換（2）SWR キーを維持（3）Server Action/Route 経由に統一（4）モック参照を全廃する。
- 参考実装: `lib/inventory/productTypeClassifier.ts`, `lib/constants/*`, `mocks/*`

---

### 9. 施設切替ポリシー

- 全施設アクセス: 機能は所属に関係なく全施設を対象にできるため、施設リストは常に全施設を提示し選択状態のみでスコープを決定する。
- SWR: 施設依存の取得は SWR キーに `facilityId` を含めてキャッシュを分離する。
- 永続化キー: 施設依存の `localStorage` キーは `<baseKey>:<facilityId>` とし混入を防ぐ。
- 再マウント境界: メイン領域直上のラッパーに `key={"facility-scope-"+selectedFacilityId}` を付与し、切替でローカル状態を初期化。サイドバー等は再マウントしない。
- イベント再バインド: 施設依存クロージャを持つイベント登録は依存配列に `selectedFacilityId` を含めて再バインドする。
- フォールバック: 選択施設が存在しない場合は安全な既定（先頭/システム）へ退避する。
- 監査整合: `contexts/app/EnvironmentFacilityBridge.tsx` で描画前に `currentFacility` を同期し、切替直後の誤記録を防ぐ。

---
