# TOM-69 検証記録

- 依頼：既存docsのVercelビルド修復、commit/push、再デプロイ、URL確認を明示承認。
- 開始：product dev ee2ecd16678083f3cddbae53fb7682146f0fc526、docs main 778120d74054dc7c626651ee7c5ed26702a2e1fa。両作業ツリーclean。
- 再現：利用者提供のVercelログで `node tools/vercel-build.mjs` がMODULE_NOT_FOUND。Git追跡ファイルにも存在せず。previewはGit対象外。
- 文書先行：SSOT docs-previewとADR-0001へ固定版・限定出力・公開保護維持を追記。docs仕様/設計/READMEへ先行反映。
- docs側変更：tools/vercel-build.mjs、vercel.json、package.json、.gitignore、tools/sync-from-product.mjs、tools/verify.mjs、tests/vercel-build.test.mjs、README.md、docs/仕様書.md、docs/設計書.mdと生成snapshot/ADRコピー。プロダクトの契約検査の範囲外として別途レビュー。
- Windows/Node 22.21.0：追加試験は入口欠落でERR_MODULE_NOT_FOUNDを再現→実装後7/7成功、既存込みdocs11/11成功。product npm test 407/407、npm run check、check:development -- --base ee2ecd16678083f3cddbae53fb7682146f0fc526（4パス）、両repo diff --check成功。
- 新規一時checkoutで npm run build 成功。公開GitHubからproduct ee2ecd1を取得、lockfile npm ci（518依存）、Expo --clearで2065モジュールをexport。5画像/フォント・1JS・HTML/metadataを生成。snapshot照合/verify成功、dirty=false、HTMLhash 3c9187a336c814ba2075e1c7f047257df6c8b3bdda0bfc92c580bd47753f312f。古いローカルpreviewを使わず再現した。
- 既存依存uuidのdeprecated警告、NO_COLOR/FORCE_COLOR警告はあり、終了コード0。依存更新は今回の範囲外。
- 別担当の読み取りレビュー：固定SHA/LF正規化/一時出力/許可リスト/リンク拒否/失敗停止を確認、具体的ブロッカーなし。
- この記録時点でVercel再デプロイ・公開URL確認は未実施。確定commit、再同期、デプロイ結果とログイン保護による未確認範囲はTOM-69のLinearへ追記する。実機検証の再実施なし。
- 対象外：プロダクトmain、GCP/実API/実データ/決済/通知、監修・物理端末のG01–G06。Vercel保護や契約プランを変更しない。
