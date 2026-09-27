# TOM-25 iPhone風docs UI 検証

- 依頼：資料サイトのプレビューをiPhone風へ。実アプリと同一ビルドを維持する。
- 開始：product dev c94d17287c26c8d7aea1a0d806e5d63d8ba4567d。前ターンTOM-52/61の22パスが未コミット。維持する。
- docs：main 52de66f40358eb686daf95b41a9bfdb4e84ec4db。前ターン仕様/設計/snapshot/ADR-0010の4パスが未コミット。維持する。
- 文書先行：docs-preview SSOT、ADR-0001追補、読者仕様/設計を更新。
- 実装：docsのassets/app.js・新preview.js・style.css、README、package.json、tests/preview.test.mjs。実フロントは複製せずiframeで表示。資料repoの差分は製品checkerの対象外なので別に確認した。
- 2026-09-27 Windows / Node 22.21.0：docs `npm test` は新部品未作成でmodule not foundを観察し、実装後4/4成功。全11画面のroute、同一hash URL、HTML escape、reset先、装飾/狭幅の構造を検査。未作成の失敗は既存業務ロジックの回帰再現とは区別する。
- 製品 `npm test` 407/407成功、`npm run check` 成功、`npm run check:development -- --base c94d17287c26c8d7aea1a0d806e5d63d8ba4567d` は7契約/31パスdevで成功（前ターン差分を含む）。両repo `git diff --check` 成功。
- docs `node tools/sync-from-product.mjs ../repository` → `npm run check` 成功（48要件/6ゲート/11画面/13ADR＋4テスト）。source c94d172、dirty=true。製品アプリソースは今回無変更のため、前ターンで検証したWeb exportをそのまま再同期。preview HTML hash `3c9187a336c814ba2075e1c7f047257df6c8b3bdda0bfc92c580bd47753f312f`。
- 実画面：IABで1440×1080、390×844、320×740を確認。ケアの選択がaria-pressed=trueとなり「最初から」でfalseへ戻る。家族の練習開始/招待作成後もresetで開始前へ戻る。docsのR08検索で第4問の最新回答を確認。
- 320px時の初回観察で筐体内部が247pxになり上部が窮屈だったため、資料余白を抑え279pxへ拡大。再確認でdocs/iframeとも横方向はみ出しなし、気分ボタン操作成功。最初の空白iframe観察は描画完了前であり、その後同一ビルドの本文/操作を確認した。
- Linear：TOM-25へ追加範囲と最終検証結果を記録し、In Reviewへ更新済み。
- G06：Web模擬表示は物理iPhone試験ではない。実接続・公開なし。commit/pushなし。
