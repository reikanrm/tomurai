# TOM-73 検証記録

- 2026-09-27。開始product dev/888ac7706df05a5753b10a9291930ba0201e554c、docs main/02d570a、双方clean。
- 31項目をPOモックの各シートで実査。17項目の入力拡張と14項目の保留理由を区別。future-valueの選択式差異も確認。
- 文書先行：life-note-fields SSOT→ADR-0016→資料仕様/設計。インフラ保留とG02/03/04/06は継続。
- 再現：最初の入力拡張試験は3失敗/1成功（既存5項目のみ、構造化入力未対応）。スキーマ/サービス追加後に成功。別VMの通常オブジェクトも受け取れる形へ是正し、未知キー/型/選択値拒否は維持。
- Windows/Node：関連 `node --test tests/life-note-fields.test.mjs tests/life-notes-product-render.test.mjs` 16/16成功。`npm test` 453/453成功（失敗/skip/todo各0）。全22有効項目の本人保存→限定委任→代理下書き→旧版拒否→本人確認、保留14項目全件の保存/委任拒否、200/2000字・50行の境界を含む。
- `npm run typecheck` / `npm run check` / `npm run check:development -- --base 888ac7706df05a5753b10a9291930ba0201e554c` 成功。13対象パス。`git diff --check` 成功。
- `EXPO_PUBLIC_DEVELOPMENT_MENU=true EXPO_PUBLIC_INVITATION_REHEARSAL=true npm run build:web` 成功（PowerShell環境変数）。通常リリースの入口条件/認証は変更なし。
- 実ブラウザー：ローカル最新ビルド390px/日本語で法人社員本人→家族一覧の関係/合成名/無効ドメイン連絡先→行追加/空行で保存不可→行削除→保存表示。葬儀形式の未選択→家族葬→保存。320px/英語で長い選択肢・見出しの折返しと操作ボタンを目視。医療保留理由と入力ボタン不存在を確認。viewportは復元。保存直後のクリックがアニメーション中に一度不成立となり、終了後の画面を確認して続行した。
- 独立レビュー：全22項目の入力/委任/本人承認/投影の独立コピーと、14項目の拒否、日英の行削除/破棄/失敗時保持を読み取り・合成試験で確認。最終差分（PO順混在表示/配列型ガード/常設試験/文書）も再確認。未解消指摘なし。
- 資料repoの仕様/設計を先行更新。`node tools/sync-from-product.mjs ../repository` / `npm run check` 成功、docs 14/14。開発中dirty=trueから、commit後にcleanな固定SHAへ再同期して配信する。別repoの差分4ファイル（読者仕様/設計・生成snapshot/ADR0016）も確認。配信結果とcommit SHAはLinear TOM-73へ記録する。
- 実認証/暗号化永続保存/二台同期/監修/両OS物理試験は未実施。インフラ保留、G02/G03/G04/G06を維持。医療・資産・ログイン情報等の14項目は未実装のまま残す。TOM-72の先行配信とTOM-73追加分の配信結果を区別する。
