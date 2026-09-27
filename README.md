# Tomurai

必要な死後手続きを絞り込み、家族で分担するモバイルアプリ。

## 現在地（2026-09-26）

決定責任者：テックリード・會田純一朗。開発は `dev`。PO用の `main` と既存HTMLは変更しません。
React Nativeのフロントを実装中です。API・認証・保存・家族同期・本番接続は未実装です。

- [SSOT：プロダクト要件](docs/ssot/product-requirements.md)：R01–R48。家族人数上限なし、3人目以降追加料金なし、AIは家族共通枠。
- [SSOT：権限境界](docs/ssot/authorization-and-entitlements.md)／[契約状態遷移](docs/ssot/billing-transitions.md)
- [仕様・設計サイト](https://github.com/JunichiroAita/tomurai-docs)：画面ごとの説明と同じフロントのプレビュー。Figmaは使用しません。
- [Linear索引](docs/development/linear-index.md)：作業群・公開条件・小タスク
- [TAKT手順](docs/development/TAKT.md)／[小タスク様式](docs/development/task-template.md)
- [共通開発スキル](.agents/skills/tomurai-development/SKILL.md)／[変更検証の正本](docs/ssot/development-harness.md)：CodexとClaude Codeで同じ手順を使います。

## 開発エージェントで作業する

このリポジトリのルートで起動してください。Codexは `$tomurai-development`、Claude Codeは `/tomurai-development` で明示選択できます。AGENTS.md/CLAUDE.mdからも共通手順を読みます。自動選択はクライアント設定によるため、初回は読み込んだスキル名・対象票・変更範囲を確認してください。

実装前に `docs/development/changes/TOM-<番号>.json` を作成/更新し、実施結果は証跡へ分けます。`npm run check:development -- --base <開始前HEAD>` は今回の契約と実Git差分を照合します。検査導入はbranch protectionや公開承認を意味しません。

## ローカル検査

Node.js 22.21.0以上。初回は `npm ci`。外部サービスの認証は不要です。

```powershell
npm test
npm run check
npm run typecheck
npm run build:web
takt workflow doctor .takt/workflows/tomurai-small-change.yaml
```

単体/型/Webビルドの検査は、ネイティブ実機・認可・決済・復旧の合格を意味しません。
G01–G06は未達です。クラウド契約、実決済、実通知、公開は別の確認を要します。

ブラウザー確認は `npm run web`。質問・4タブ・担当/完了はメモリ内のサンプル操作です。
招待・質問に基づく正式な絞り込みは未接続です。実際の個人情報を入力しないでください。
WindowsのAndroidエミュレーター確認は `npm run android:preview`。事前に専用AVDとExpo Goの準備が必要です。[起動・終了手順](docs/development/android-local-preview.md)を参照してください。
React Native / TypeScript / Expo Development Build とGCPを前提にし、DBは原価・復旧の検証後にADRで確定します。
