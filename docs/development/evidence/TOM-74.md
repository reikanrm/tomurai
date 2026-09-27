# TOM-74 — PO6要件の再監査と境界修正

2026-09-27。開始：product dev ca8b151b683e8736684895a7fb5ec9f7f3b72ba2、clean。docs main 043ac2725c41be37529e20185e522f73359c3ce5、clean。依頼は監査し不足を修正。commit/push/deployなし。

## 原文・監査

Google Drive経由で共有文書（更新2026-09-12T03:44:44.556Z）取得。9メッセージ・法要任意分岐を照合。[項目別結果](../../ssot/po-review-audit-2026-09-27.md)。独立読取レビューが生前サービスの偽真値認可と法人契約日のnull比較不具合を合成状態で再現した。実データ漏えい/実課金を観測した報告ではない。

## 文書先行・予定検証

SSOT・ADR-0011/0015追補・別リポジトリ読者仕様書/設計書を先行。新価格/権限変更はなく別ADRの新設は不要。予定：否定試験のred→修正→green、全体試験・型・check・差分契約・独立レビュー。実行結果は以下へ追記する。

## 実行結果

- Windows/Node。追加の否定試験を修正前に実行：33件中30成功/3失敗。不正な認証フラグの本文読取、承認可能状態の型、年間契約null/nullによるstartedを再現。
- 最小修正後の `node --test tests/life-notes-service.test.mjs tests/corporate-billing.test.mjs`：33/33成功。偽真値/欠損でのread/write/保存/委任/確定、無効契約日、請求候補なし・状態不変を確認。
- 法要/回答/9本文/完了表示/自治体選択/通知の関連8ファイル：75/75成功。homeの一覧・空・ロック状態の後に節目がある検査を含む。画面の実機操作結果ではない。
- `npm test`：456/456成功（失敗/skip/todo各0）。`npm run typecheck`、`npm run check`、`npm run check:development -- --base ca8b151b683e8736684895a7fb5ec9f7f3b72ba2`：成功、devの変更12パスを契約に照合。
- 最新プロダクトをExpo Web export成功。`tomurai-docs/tools/vercel-build.mjs`のbuildEnvironmentで公開変数の継承とdotenvを抑止し、既定の開発メニュー/招待練習だけ有効化。NodeのspawnSyncで絶対CLIを解決しcwdをapps/mobileに指定した。通常認証・実接続は変更なし。
- docs：`node tools/sync-from-product.mjs ../repository`→`npm run check` 成功（14/14）。ADR0011/0015・読者仕様/設計・snapshot計5ファイルの差分を確認。source=ca8b151、dirty=trueで未コミット差分を正直に記録。配信前には製品commit後にclean固定SHAへ再同期が必要。今回Vercel反映なし。
- 独立レビュー：法人20/20と元不正日付の別再現で拒否/charge:null/state同一、正常再送追加課金なし・家族無料期間を確認。生前39試験と合成状態で承認フラグ9種類の本人閲覧/委任取消/代理人拒否/下書き破棄を確認。追加の修正必須指摘なし。
- 両repoの `git diff --check` 成功。SSOT/既存ADR/読者仕様・設計の先行更新を開発スキルに従って実施。Linear TOM-56/60/62/63へ残作業と今回の検証を反映。TOM-74の修正分はレビュー待ちで、元の機能票は未完了のまま。

## 残るゲート

2026-09-27追記：利用者が「push・公開して」と明示依頼。TOM-75とともにproduct devへcommit/pushし、docs mainの固定SHAへ同期して既存のパスワード保護付きVercel資料プレビューへ反映する範囲。一般公開/実運用のG解除ではない。結果のSHAと配信確認はLinearへ追記する。

自治体個別本文/関東データ、実通知、実認証/暗号化永続保存/同期、受取人共有と死後連携、N/人数帯・実請求、監修・物理両OSは未完了。G01〜G06維持。UIを変更しないため今回の修正による画面のビジュアル比較は対象外。既存UI配置の確認と単体試験を本番・実機の証拠にしない。
