# TOM-71 検証

- 最新依頼：練習ではなく製品実装、左上へ法人版追加。決定責任者：會田 純一朗。
- 開始：product dev 94d41c7273a562a2045abd71a602fbcf51237b60、docs main 4031276449171e54a149995d546997305cf8fdbc。TOM-62/TOM-70の未コミット差分を保持。
- 文書先行：life-notes-product、ADR-0015、要件/認可/開発切替、別repo仕様/設計。
- POモック：2026-09-27に「これからやってみたいこと」のtextarea・記入状況・保存/あとで書くをブラウザー実査。人物/例文は移植しない。
- 実装：共通LifeNotesWorkspaceと非同期port/サービス、5一般項目の実テキスト入力、本人編集/項目委任/代理下書き/対象版確認/破棄/取消。左上に社員本人/招待家族/代理担当と4シーン。旧TOM-70専用練習はAppから外し、既存ファイル/独立試験は保持。
- Red→green：新サービス未作成時のmodule missingを観測→実装。初回typecheckでnull/undefined制御の誤りを検出→never関数/明示ガードで解消。旧配線前提3試験は最新の明示開発ビルド/通常リリース拒否契約に更新し成功。
- scoped：`node --test --test-reporter=spec tests/life-notes-product-render.test.mjs tests/life-notes-service.test.mjs` 19/19成功。許可外項目/社員の自己承認/他人/会社/無効入力/失効/再送/古い版/旧委任/シーンqueue/遅延read/権限縮小/一時障害を含む。
- 全体：`node --test --test-reporter=spec tests/*.test.mjs` 445/445成功、失敗/skipとも0。`npm run typecheck`、`npm run check` 成功。
- 変更範囲：`npm run check:development -- --base 94d41c7273a562a2045abd71a602fbcf51237b60` 成功。dev向け33パス（既存TOM-62/TOM-70差分含む）、10manifest。チェックは本番承認ではない。両repo `git diff --check` 成功（CRLF/global ignore読取警告のみ）。
- build：EXPO_NO_DOTENV/EXPO_NO_TELEMETRY=1、EXPO_PUBLIC_DEVELOPMENT_MENU=false/trueで各 `npm run build:web` 成功。通常出力index-33c3b5880760cea637143e597981d680.js、明示開発出力index-5882dac4b5fb38b6e18abbecd2d3f873.js。旧LIFE_REHEARSALでは開放しない。
- ブラウザー実査：local4173 `/preview/?screen=life-notes`。通常exportで開発メニューなし・B2Cは法人説明のみ。明示開発exportで左上3法人ペルソナ→社員ホーム→自由文入力/反映、家族本人の1項目選択/承認→代理担当で1項目だけ表示→自由文下書き→本人の本文/版確認/確定→取消後代理担当拒否まで成功。期限切れシーンも拒否。390×844で日本語ホーム/入力シート/確認シートと英語ホームをスクリーンショット確認。合成文だけ使用。console error/warn 0。viewportは元に戻し、日本語の法人社員ホームを残した。
- 独立レビュー：q4_docs_review。timer上限で30日再確認が止まる点、旧委任への入力/取消の紐付け、再読込による権限縮小時の旧editor残留、一時通信障害での未保存文消失を指摘。残時間の再予約・grantID/版固定・対象外editor破棄・readBlocked/再認可後復帰へ修正。関連35/35再試験、対象差分の未解消指摘なし。本番の認証/DB検証ではない。
- docs：別repo仕様書/設計書を先行更新、製品buildとSSOT/ADRを `node tools/sync-from-product.mjs ../repository` で同期。`npm run check` 成功（48要件/6ゲート/11画面/15ADR、14/14試験）。source dirty=trueを隠していない。ローカル反映だけでVercelへ公開していない。
- 実認証/HTTP/永続DB/暗号化/実同期/通知/監修/物理端末は未完了。インフラgrill保留継続。commit/push/deployなし。

## 2026-09-27 commit・push依頼の追補

- 上記は実装引渡し時点の記録。その後、利用者が現在の差分のcommit・pushを明示依頼。
- 対象：TOM-62第5〜9問の既存決定記録、TOM-70の合成検証、TOM-71製品UI/サービス・法人切替、および対応docs。未着手の残31項目は含めない。
- product devの開始HEADとremote devは94d41c7273a562a2045abd71a602fbcf51237b60、PO用remote mainはb921be1d034f4110d588731a4356eab2678c6284。docs main開始/remoteは4031276449171e54a149995d546997305cf8fdbc。
- GitHub送信前に445/445試験、型検査、check、開始HEAD基準の変更契約検査を再実行。送信結果・確定SHAはLinearへ記録する。プロダクトmain、本番GCP、実データ/通知/課金は対象外。
