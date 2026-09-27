# TOM-75 検証

- 2026-09-27。開始product dev ca8b151、docs main 043ac27。前ターンTOM-74の未コミット12パスとdocs5パスを保持。今回の別契約で混同しない。
- 対象は手続き別の管轄選択・起動中保持・横浜市の18区確認。横浜市公式ku-shokaiページで区名を照合。個別本文の監修済み認定ではない。
- 文書先行：municipal-jurisdiction SSOT→ADR0010追補→読者仕様/設計。既存UIの配色/書体をfrontend-designスキルに従って維持し、余分な装飾を追加しない。
- RED：domain 6件中3件失敗（未知区を許容する既存挙動、未実装の正規化/変更処理）。実装後の対象domain/component 10/10 PASS。リンク失敗・再試行・選択変更後の遅延エラーを含む。VMを跨ぐPromiseの試験はsetImmediateで決定的にflushする。
- GREEN：`npm test` 462/462 PASS、`npm run typecheck` PASS、`npm run check` PASS、`npm run check:development -- --base ca8b151b683e8736684895a7fb5ec9f7f3b72ba2` PASS（21パス）。前ターンTOM-74の試験も含む。
- Web build PASS：docsの`buildEnvironment`で公開環境変数・dotenvの継承を除き、Expo CLI `export --platform web --clear`を実行。生成bundle `index-6bddcd732c333e41cd49d3d492f3b7b4.js`。`node tools/sync-from-product.mjs ../repository`でdocsへ同期、docs `npm run check` 14/14 PASS。dirty snapshotを公開済みとはしない。
- 実ブラウザー：localhostの実ビルドで家族プラン→死亡届タスク→横浜市/青葉区→市・区確認→適用→閉じて再表示を操作し、区と両確認の保持を確認。中区への未適用変更で確認が解除され、閉じて再表示すると適用済み青葉区へ戻ることを確認。
- 日本語390×844、英語320×740でスクリーンショット確認。英語切替後も適用済み区を保持。320pxのdialogはclientWidth/scrollWidthとも320、区選択の最小実測高さ49px。狭幅では2列に折返し、横はみ出しなし。viewport overrideは検証後解除。物理実機試験の代替とは扱わない。
- 差分レビュー：選択はアクセス可能なタスクIDのみで保持、回答再確定/開発権限変更で解除、自治体・区変更で確認解除。既存の監修済み本文の完全一致・期限・HTTPS/host制限を維持し、空の監修カタログは埋めていない。
- 永続保存/家族同期、関東全域の監修済み本文、実通知、死後連携、実請求、物理両OS・監修は未完了。今回commit/push/deployなし。

## 追加の公開依頼

2026-09-27「push・公開して」によりTOM-74/75をproduct devへcommit/pushし、docs mainをcleanな固定SHAに同期して既存パスワード保護付きVercel資料プレビューへ反映する。上の未公開記録は実装完了時点の履歴。公開直前の構造/21パス契約検査も成功。一般公開・実認証/通知/課金は対象外、Gは維持。実際のSHA/配信結果はLinearへ記録する。
