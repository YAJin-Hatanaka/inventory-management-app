このプロジェクトでAIアシスタントが遵守すべき開発ルールを定義します。疑義がある場合は下記の優先度順に従って判断してください。

## 優先ドキュメント（上から優先）
1) docs/best-practices/development-guidelines.md （本プロジェクトの正規ガイドライン）

**重要:** 「docs/Past documents/*」は参考資料扱いであり、正規ルールとして解釈しないこと。

## 必須ルール（抜粋）
- すべての会話・説明は日本語で行う。
- App Router 構成は docs/best-practices/development-guidelines.md の「1. 原則」「2. ディレクトリ/ルーティング」に従う。
- データ取得は同ガイドライン「3. データ取得（SSR シード + SWR）」方式を守り、初回シードは最小共通祖先レイアウトで一度だけ行う。
- Supabase クライアントの利用境界はガイドライン「4. Supabase」に従い、Service Role キーはサーバー専用とする。
- TypeScript は strict（`any` 禁止）・小さく純粋な関数志向で実装する
- UI は既存コンポーネントを再利用し、更新操作は Server Action/Route に集約する。

## 衝突時の判断
- ルール間で矛盾が生じる場合は「development-guidelines.md」を最優先し、そこに則って他ドキュメントを解釈・更新する。

## 重要
- 実装手順書の作成をするときや、コードレビューをするときは以下のドキュメントの修正が必要か判断をして、必要に応じて修正する。
    - docs/best-practices/development-guidelines.md
    - docs/design specification/functional_requirements.md
    - docs/design specification/technical-requirements.md
    - docs/design specification/database-table-design.md
    - docs/design specification/account-signup-requirements.md

## Past documentsは関係ないドキュメントです。

## テストコード作成ルール
- 実装側のコードを正としてテストコードを作成し、実装側は変更しないこと