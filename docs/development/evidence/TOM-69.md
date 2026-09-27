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

## 稼働ブランチの統合と保護確認

- 最初の文書コミット54c5a71はdevへpush。その固定版でも新規checkoutのビルド成功。
- Vercel画面で、稼働版は別docsブランチclaude/nice-clarke-2seb5z / 3bd39b2と確認。main未統合のmiddlewareとビルド入口、テーマ・用語説明・ローダーが存在。保護を失う静的配信を避けるためdocs pushを止めて統合した。
- docs mainに修復コードを735dfacとしてローカルcommit後、稼働ブランチを統合。既存認証方式・Cookie有効期間を維持し、Cache-Control private,no-store、middlewareは静的dist対象外。DOCS_PASSWORDは値を取得・変更せずビルド子環境から除外。data/terms.jsonと資料用画像を維持し、iPhone枠へ既存ローダーを接続。
- 合成値による追加認証試験：未設定503、未認証のHTML303/その他401、資料/data/ADR/preview/JS直アクセス拒否、偽造Cookie拒否、正しいCookie通過、テスト用パスワード変更で旧Cookie拒否、logout削除、秘密を子ビルドへ渡さない。既存復帰先nextのバックスラッシュで外部URLとなる問題をredで確認し、制御文字と併せ拒否してgreen。docs14/14・check・JS構文検査・diff --check成功。
- ローカルブラウザーで既存のテーマ/用語説明/ローダーとiPhone枠の同時表示、ケア気分選択を確認。実機検証とは別。Vercel側の実保護・公開画面はデプロイ後にLinearへ記録する。
