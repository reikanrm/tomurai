# TOM-57 — 掲載パートナーの表示契約

2026-09-26。決定責任者：テックリード・會田 純一朗。TOM-50配下、C08 / R19、G03 / G04 / G06。[委任実装契約](../ssot/po-review-implementation.md)・ADR-0010を実装する。frontend-designの既存意匠優先に従い、既存カード・Noto Sans JP・緑と紙色・細線を継承する。

## 対象とデータ

`domain/partners.ts` の `Partner` は掲載データ。`registeredPartners` は空配列であり、画面を埋めるための架空事業者を登録しない。テスト内の `.example` 名/URLだけが合成データ。

- `id`：安定ID。重複IDはどちらも非表示（取消行と公開行の競合を公開に倒さない）。
- `name.ja/en`：空でない日英名称。表示は利用言語の名称順、同名はID順。評価・おすすめ順位ではない。
- `fields`：既存4分野 `law / tax / care / belongings`。選択分野との一致が必要。
- `regions`：都道府県 `JP-01..JP-47`、または明示された全国対応 `JP`。地域未指定は全国対応だけ。不正地域は非表示。GPS・故人住所の推測はしない。
- `permission`：`approved / pending / withdrawn`。掲載許可の確認日 `permissionConfirmedOn` と連絡先の確認日 `contactVerifiedOn` が有効な過去/当日であること。
- `validFrom / validUntil`：両端含むJST暦日。欠損・逆転・期間外は非表示。操作時/画面再描画時に再判定する。
- `contactUrl`：明示的なHTTPS URL。資格情報入り、空白/制御文字/バックスラッシュ、IPリテラル、単一ラベル/ローカル名、標準外ポートを拒否。これはURLの形式検証であり、リンク先の安全性/リダイレクト/資格を自動認証するものではない。実際の連絡先確認と掲載許可の証拠は運営の登録・公開工程で必要。

## 画面と境界

`SpecialistsScreen` に任意の `partners / region / today / onConsult(partner)` を追加。既存 `locale / onOpenMap / error` は維持。Appから更新されるJST `today` を渡して期間境界に追従させる。

分野見出し→一般案内→許可済みパートナー（または0件の明示）→相談の目安→最下部「その他で探す / Google Maps」の順。目安を開いてもMapsを末尾に維持する。Mapsへ渡すのは既存の固定カテゴリ検索語だけ。各分野の0件・取消・掲載期間外・地域不一致でもMapsは利用可能。

相談操作は選択された掲載データだけをコールバックへ渡す。家族記録/回答/位置情報は渡さない。TOM-58未接続時はボタンを無効にして「相談受付は準備中」と明記。画面だけで受付成功にしない。掲載料の会社間請求・有料掲載説明を維持し、資格審査済み・推奨順位は表示しない。

## 実行証跡

- 先行 `node --test tests/partners.test.mjs`：新ドメイン未存在で失敗。
- 実装後 `node --test tests/partners.test.mjs tests/product-copy.test.mjs`：11件合格。許可/日付/地域/分野/URL/データ欠損/ID重複/安定順/入力不変、日英0件とMaps順序、相談コールバック、未接続、地図エラー、取消・期限切れ再描画を確認。
- `npm run typecheck`：成功。
- 全体 `npm test / npm run check / Web build` は統合担当で実施する。

## 残る条件

実掲載許可/監修/有料掲載の公開前確認、実相談受付、端末でのMaps未導入・文字拡大・読み上げ確認は未充足。本契約の単体試験でG03/G04/G06を充足したとは扱わない。登録データの取得/掲載取消時の更新をサーバーと接続する際も、表示時と外部問い合わせ操作時の再検証を維持する。
