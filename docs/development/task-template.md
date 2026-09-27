# 小タスク（TAKT入力用）

- Linear ID・親作業群：
- 依頼モード（調査/記録/実装など）・開始HEAD/ブランチ・既存差分：
- 目的（1つのレビュー可能な成果物）：
- 対応C/R：
- 現状と根拠：
- 許可する変更ファイル/画面/API/データ：
- 対象外：
- 正常系の受入条件：
- 異常系・権限境界・競合・削除：
- 先に実行する失敗テスト：
- 変更後に実行するテスト/型/lint/実機：
- 出典/確認日/監修が必要な内容：
- 公開を止めるG：
- 新しいPO判断が必要になる境界：
- 証跡（差分、実行コマンド、結果、残課題）：
- 変更契約：`docs/development/changes/TOM-<番号>.json`（厳密パス、C/R/G、文書変更の判断、証跡参照）
- 差分検証：`npm run check:development -- --base <開始前HEAD>`

開始前にAGENTS.mdと承認仕様を読み、上記の空欄をチケットに合わせて埋める。
E作業群全体ではなくこの単位を実行する。合成データだけを使う。
共通手順は `.agents/skills/tomurai-development/SKILL.md`、契約の構造と制限は `docs/ssot/development-harness.md`。testCommandsへの記入は実行済みの証拠ではない。
