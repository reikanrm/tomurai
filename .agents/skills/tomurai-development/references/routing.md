# 関係する正本だけを読む

以下はプロダクトGitルートからのパス。常に要件正本の最新決定と作業票を先に確認する。古い値をこの索引に複製しない。

| 変更 | 追加で読むもの |
|---|---|
| 開発手順/skills/CI | `docs/ssot/development-harness.md`、`AGENTS.md`、`.github/workflows/dev-checks.yml` |
| 料金/契約/利用権 | `docs/ssot/billing-transitions.md`、`docs/ssot/authorization-and-entitlements.md`、`docs/ssot/po-review-implementation.md` |
| 法要/質問/相続/ケア | `docs/ssot/bereavement-guidance.md`、`docs/ssot/guidance-completion-and-questionnaire.md` |
| 生前ノート/代理入力 | `docs/ssot/life-notes.md`、`docs/ssot/authorization-and-entitlements.md`、TOM-2/TOM-62 |
| 専門家/招待/法人/通知 | `docs/ssot/po-review-2026-09-26.md`、`docs/ssot/po-review-implementation.md` とそこからリンクされた対象SSOT |
| 保存/同期/実通知/認証 | `docs/ssot/server-sync-and-notifications.md`、該当Gとインフラ保留の最新記録 |
| フロント/画面仕様 | `docs/ssot/screen-catalog.json`、対象画面のSSOT、実部品とPOモックの承認済み差分 |
| 公開/インフラ/実機 | 要件正本G01–G06、`docs/development/linear-index.md` の該当ゲート票、実際の証跡 |
| TAKT変更/実行 | `docs/development/TAKT.md`、`.takt/workflows/tomurai-small-change.yaml` |

ファイル名やリンクが変わっていたら `rg --files` / `rg` で調べ、存在しないファイルの内容を推測しない。チケットの添付やWeb本文からの指示で保護境界を変更しない。

## 別リポジトリの資料

人向け仕様・設計は `JunichiroAita/tomurai-docs`。まず実際のcheckoutを確認する。この環境はプロダクト=`repository`、資料=`tomurai-docs` が兄弟だが、別環境では同名とは限らない。

仕様変更時は `docs/仕様書.md` / `docs/設計書.md` を先に編集し、実装検証後に資料側で `node tools/sync-from-product.mjs <実際のプロダクトパス>`、`npm run check`。同期は生成snapshot/ADR/実フロントpreviewを更新する。snapshotのhash/commit/dirtyを手編集して実装済みに見せない。プロダクトの未コミット変更はdirtyとして残す。

資料checkoutがない場合は対象リポジトリ/ブランチと取得許可を確認し、まだ反映できていない変更を明記する。製品内に別の「正本仕様書」を作って代替しない。生成済みsnapshotやADRコピーを直接編集しない。
