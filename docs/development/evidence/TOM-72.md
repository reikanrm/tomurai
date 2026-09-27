# TOM-72 資料の法人プレビュー

- 開始：2026-09-27、product dev/a7793b5、docs main/8bf51d。両作業ツリーclean。
- 依頼：Vercel反映完了。対象は既存の保護資料のみ、product mainは対象外。
- 読取確認：GitHubの8bf51d Vercel status success。公開資料の再読込でa7793b5参照を確認。buildEnvironmentにDEVELOPMENT_MENU未指定。
- 文書先行：docs-preview SSOT、ADR-0001追補、資料仕様/設計。
- 資料repoの変更対象：tools/vercel-build.mjs、tests/vercel-build.test.mjs、docs/仕様書.md、docs/設計書.md、同期生成のdata/snapshot.jsonとdata/adr/0001-repositories-and-ssot.md。
- 検証：2026-09-27 Windows/Node。docs回帰試験でフラグundefinedを再現（6/7）、修正後npm run checkは14/14。product npm testは445/445、npm run check、開始SHAを基準にcheck:development（4 paths）、diff --check成功。
- 独立レビュー：vercel_build_reviewが通常製品/認証保護/外部設定除外/合成接続を確認、ブロッカーなし。「合成招待だけ」の旧説明を開発メニュー追加に合わせ修正。
- この記録時点でcommit/push・固定版全ビルド・公開URLの法人操作は未実施。結果はLinearへ追記する。実認証/永続保存等とG06の一般公開条件は継続。
