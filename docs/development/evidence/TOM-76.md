# TOM-76 引継ぎ検証

- 2026-09-27、依頼はClaude Codeへgrillを引き継ぐ資料とプロンプトの作成。新たな回答/仕様変更/アプリ実装は対象外。
- 開始product dev `5f5800c2301bc6221b561624ef10b562b69decf9`、docs main `1c6253a2fec2499bfc7145dcd0c6c7d8b95985c8`。product cleanを確認。docsは直前公開でclean確認済み、今回は変更しない。
- Linear TOM-2/13/44/62/63/66/73を取得。TOM-13のPOレビューgrill先行、インフラ費用保留、TOM-44モック待ちを反映。新票TOM-76を作成し資料範囲を限定。
- 根拠：生前決定履歴・製品サービス・31項目対応表、PO再監査、自治体補完、要件C/R/G、インフラ試算/サーバー契約、既存CLAUDE入口。22実装+14保留=36、明示回答第1〜9問、今回の推薦A1〜D2を分離。
- 開発/grillingスキルに従い、事実を先に確認し、引継ぎ先では推薦付き1問ずつ/回答待ちとした。今回grill自体は進めていない。
- SSOT/ADR/読者仕様書は変更不要：新しい事業/技術決定を採用していないため。資料同期/デプロイも不要。
- 検証：`npm test -- --test-reporter=dot`を実行（npmの引数順により表示はTAP）、462/462成功、失敗/skip/todo各0。`npm run check`、`npm run check:development -- --base 5f5800c2301bc6221b561624ef10b562b69decf9`成功、今回4パスだけを契約照合。`git diff --check`成功。アプリコード/見た目は変更なしでUI・型・実機の再試験は対象外。
- 引継ぎ本文の相対リンク12件すべて実在、保留項目14件・決定済み9問の件数、両固定SHAとプロンプトの回答待ち/追加承認境界をNodeで検査し成功。本文を手動で現SSOTと照合。docs checkout cleanを再確認。
- Claude Code実起動はしておらず、入口/プロンプト作成だけで実クライアント読込成功とはしない。別環境は今回の未push資料を渡す必要がある。
- G01〜06、インフラ・監修・実接続の保留を維持。秘密・実個人データなし。commit/push/公開は行わない。

## クラウド引継ぎの配布補完

2026-09-27、利用者がクラウドClaude Codeで2資料を取得できない旨を報告。上記のローカル作成だけでは引継ぎ先に届かないため、同じTOM-76の資料4ファイルだけをdevへcommit/pushする。Windows絶対パス依存を除き、環境のGitルート・安全なfetch/fast-forward・未取得連携の扱いを明記。第4問の既回答を現SSOTで再確認し、古いTOM-67記録との優先関係を追補。アプリ/SSOT/ADR/別docs・Vercelは変更なし。配布結果のSHAはLinearと最終回答へ記録する。

配布前検証：`node --test --test-reporter=dot tests/*.test.mjs`成功（exit 0）、`npm run check`成功、開始SHAに対する変更契約4パス検査成功。2資料の相対リンク実在検査とstaged diffの空白検査成功。origin/dev fetch後にHEADとの前後差0を確認し、forceやmain変更なしで配布する。
