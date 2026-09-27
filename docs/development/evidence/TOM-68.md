# TOM-68 — Iconoirアイコン検証

2026-09-27。プロダクトdev、開始HEAD `41115c52f6963337d79ac897485ffa3be5b55470`。開始時clean。先行TOM-67はユーザー指示どおりcommit/push済み、dev CI成功。資料mainは `4732a16` へ同期済み。

## 実装前

SSOT iconography、ADR-0013、関連SSOT、人向け仕様/設計を先に更新。指定ライブラリの公式package.jsonとnpmメタデータで7.12.1/peer/MITを確認。既存の意味/文言/任意選択/非保存/Mapsを変えず、円相/担当アバターを除外する。

## 実装・依存

5気分/4専門カテゴリ/4ナビ/5行動を公式Iconoirコンポーネントへ対応。気分は28pxの線画、40pxの丸背景、幅76/minHeight108/角14、選択時のチェックを追加。コピー・Notoフォント・ID・任意選択と解除・非保存・相談/Maps動作は維持。

`npm install --ignore-scripts --no-audit --no-fund` 成功。Iconoir 7.12.1の公開exports・配布LICENSE（MIT）・lock integrityを確認。既存React/RN/SVGは同版。react-native-svg 15.15.4がmobile配下からrootへhoistされたが、versionとintegrityは同一。他の既存バージョン変更なし。

## 実検証

| 検証 | 実結果 |
| --- | --- |
| 先行RED（既存5試験ファイル） | 24件中17成功/7失敗。新adapter不在・旧emoji/nav・専門カテゴリ差分で期待どおり失敗 |
| 対象6試験ファイル | 29/29成功。公式exportsと実SVG、寸法/線幅/色/a11y、日英選択/解除・行動との独立・相談/Mapsを確認 |
| `npm test` | 最終393/393成功、失敗/skip 0。pointerEvents補正後も再実行 |
| `npm run typecheck` | 成功（補正後にも再実行） |
| `npm run check` | SSOT/リンク/スキル構造成功。アプリ受入の代用ではない |
| `npm run check:development -- --base 41115c52f6963337d79ac897485ffa3be5b55470` | dev・27変更パス・変更契約を確認し成功 |
| `npm run build:web` | 成功。最終bundle `index-1cf0425c945548995c723d3e61060cd7.js` |
| `git diff --check` / protected HTML diff | 成功 / 4HTML変更なし |
| 資料 `node tools/sync-from-product.mjs ../repository` → `npm run check` | 48要件/6ゲート/11画面/13ADR/実previewで成功。source 41115c5、dirty=true（新アイコンは未commit） |

独立レビューでも対象29件を再実行して成功し、修正必須指摘なし。

### Web実表示

`http://127.0.0.1:4173/preview/?screen=care` を新buildでreloadし、Codexブラウザで確認。

- 390×844：気分5種（4+1）・未選択/選択チェック・ケア行動・下部ナビを目視確認。
- 320×844：日英どちらも3+2で折返し。全5カードの幅76/高さ108、`scrollWidth <= clientWidth`。ラベルの欠け・横溢れなし。
- 涙が出るを選択→英語Tearfulでも選択維持→再クリックで解除。画面の再mountで未選択へ戻る。
- 専門家4種の線画とカテゴリ見出しを目視確認。掲載/相談/Mapsの内容や許可条件は変更なし。
- 装飾SVGへのクリックフォーカスを実表示で発見し、`pointerEvents="none"` を追加。最終buildではナビクリック後のactiveElementがSVGではなく`role=tab`の親要素になることを確認。回帰assertも追加（この追加assert単独のREDは未観測）。
- 確認時のコンソールwarn/errorなし。Ctrl+拡大操作では実際の文字拡大を確認できず、拡大時の受入は未検証のまま残す。ブラウザ狭幅確認を端末の文字拡大/読み上げの代わりとはしない。

### 資料リポジトリの別差分

`tomurai-docs/docs/仕様書.md` と `docs/設計書.md` に見た目/責務/依存/不変事項を先行記載。同期で `data/snapshot.json` と `data/adr/0013-iconoir-native-icons.md` を生成。ここはプロダクト変更契約の対象外なので別途差分確認済み。公開先へは送信していない。

## 未完了・範囲外

G03のケア/英語監修とG06のPixel/iPhone物理端末・文字拡大・読み上げ実測は未完了。Web文字拡大も未検証。外部送信、気分履歴、診断、公開は追加しない。前回のレビュー提出時点ではアイコン差分をcommit/pushせず、生前ノート第4問も保留を継続した。

## commit/pushの明示依頼（2026-09-27）

後続の「commit・pushして」により、TOM-68の27ファイルをプロダクトdevへ、仕様書/設計書と生成資料を資料mainへ送信する範囲を承認。両リポジトリでfetch後のHEAD/remote差分0を確認。PO用プロダクトmainや4HTML、公開ゲート、実機/監修状態は変更しない。実コミットID・リモート一致・CI結果はLinear TOM-68に送信後の事実として追記する。資料はプロダクトcommit後に再同期し、source commit/dirtyを手編集しない。
