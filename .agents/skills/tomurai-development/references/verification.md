# 検証の選び方と実行記録

プロダクトGitルートから実行する。パッケージの既存scriptと実環境を確認し、コマンドがない場合に架空の成功を返さない。依存が必要ならlockfileを尊重し、無関係なupgradeは行わない。

| 変更 | 基本検証に追加するもの |
|---|---|
| 全プロダクト変更 | `npm test`、`npm run check`、`git diff --check`、`npm run check:development -- --base <開始前HEAD>` |
| TS/RN/部品 | `npm run typecheck`、関連ドメイン/部品テスト |
| UI/フォント/余白/動線 | `npm run build:web`、実画面の対象状態/空/長文/失敗/戻る/アクセシビリティ確認。エミュレーターと物理端末を区別 |
| 仕様/ADR同期 | 資料repoでsync、`npm run check`、source hash/dirtyとリンク確認 |
| 認可/課金/保存/通知 | safety.mdの該当否定試験、適切に許可された環境での統合検証。未接続は未完了 |
| skill/CI/検査器 | 形式、参照リンク、合成Gitの否定試験、独立した具体的依頼での試行。実クライアントの読込を未確認ならそのまま記す |

## 変更契約を使う手順

1. `git rev-parse HEAD` と開始時statusを証跡に残す。既存差分が別票なら別契約を維持する。
2. SSOTに従いJSONを作成/更新する。testCommandsは予定であり実行済み一覧ではない。検査器はコマンドを実行しない。
3. scoped testから全体へ実行し、失敗の理由と再試験を記録する。赤/緑を観察していないならそう記す。
4. `npm run check:development -- --base <記録したHEAD>`。未追跡・rename旧新も対象。契約にない変更を発見したら、その変更を捨てず、所有と作業範囲を確認する。
5. CIは差分基準をイベントから取得する。branch protectionを今回設定していない場合、チェック追加だけでmergeが強制的に防止されるとは報告しない。

## 証跡の最小形

```markdown
# TOM-n 検証
- 対象と依頼の範囲：
- 開始HEAD / branch / 既存差分：
- 文書先行の変更と、変更不要とした理由：
- 実行日時・環境・コマンド・結果：
- 再現/失敗試験と修正後の結果：
- レビュー指摘と対応：
- 未実施（理由）・未接続・残るG：
- Linear反映 / docs同期 / commit・pushの有無：
```

同じ結果を何度も成功として水増ししない。テスト件数は実行出力から採る。UI未確認、物理端末未確認、人の監修待ち、Claude Code実起動未確認はそれぞれ別欄にする。

## TAKTを使う場合

既存 `docs/development/TAKT.md` とworkflowを全文読み、手元の版を確認する。既定mock providerのCOMPLETEは統合/実装の成功証拠ではない。実provider利用は認証・予算・明示許可を確認してから。workflow変更時はTAKT 0.49.0の `takt workflow doctor .takt/workflows/tomurai-small-change.yaml` を実行する。別versionなら互換性を調べ、検査省略を隠さない。

TAKT内部ではcommit/push/PR/merge/Linear更新/実通知/支出をしない。終了後に主担当がdiffと証跡を読み、許可されている外側の操作だけを行う。失敗ループのために無制限に試行回数・予算を増やさない。
