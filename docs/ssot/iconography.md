# Iconoirによる親しみやすいアイコン — TOM-68

決定責任者：テックリード・會田 純一朗。2026-09-27。ADR-0013。

利用者の明示依頼により、指定の [iconoir-react-native](https://github.com/iconoir-icons/iconoir/tree/main/packages/iconoir-react-native) の公式コンポーネントを使う。添付の心のケア・気分5種を優先し、専門家カテゴリ・下部ナビ・ケア行動も同じ線画に揃える。TOM-27/28/59のUnicodeやWeb SVGと図形まで一致させる方針は、この対象だけ置き換える。POのmain/4HTML、円相原画像/黒/寸法、家族アバターは変えない。

## 見た目と意味

紙色 `#F5F3ED`、濃い紙 `#EFEBE1`、インク `#232922`、暖色面 `#F4EDE3`、罫線 `#DCD8CC`、選択用の既存緑/暖色を使う。Noto Sans JPの既存ラベルと文字寸法を維持する。新しい感情分類・評価・励まし・保存・通知を追加しない。

気分カードは既存の折返しと幅76を維持し、角14と40pxの淡い丸背景に28pxのアイコンを置く。最小高108、ラベルは折り返して伸びる。強い怒り顔やOSごとに変わる色付き絵文字ではなく、同じ線幅1.5の小さな顔・ハートにする。選択は控えめな面/罫線とチェック印で示し、色だけに頼らない。効果音・自動選択・反復アニメーションは追加しない。

| 用途/ID | Iconoir公式名 |
|---|---|
| 穏やか / calm | EmojiSatisfied |
| 涙が出る / tearful | EmojiSad |
| やり場のなさ / unsettled | EmojiPuzzled |
| 何も感じない / nothing | EmojiQuite（公式の綴り） |
| 思い出したい / remember | Heart |
| 専門家：law / tax / care / belongings | Book / JournalPage / Heart / BoxIso |
| ナビ：home / tasks / specialists / care | HomeSimple / TaskList / Community / Heart |
| 行動：tea / breath / message / move / write | CoffeeCup / Wind / ChatBubbleEmpty / Walking / EditPencil |

図柄は補助であり、名前は既存の日英ラベルを正本とする。涙・怒り等をアイコンから自動推定しない。move/writeは既存の部品APIを保つための対応で、新しい行動や日記画面を追加するものではない。カテゴリは28px/42px丸背景、ナビ22px、行動26px/既存40px面。装飾のアイコンは独立したフォーカス・読み上げ対象にせず、親ボタンのラベル/選択状態を使う。

## 構成・依存

- `iconoir-react-native` **7.12.1** をmobile workspaceへ固定。公式package.jsonとnpmメタデータのMIT、React18/19、RN>=0.78、SVG^15.12を確認。既存React19.2.3/RN0.86.3/react-native-svg15.15.4を上げない。lockfileのintegrityを保持する。
- 共通 `AppIcon` は使用する公式アイコンだけをnamed importし、サイズ/線幅/色/装飾属性を統一する。`pointerEvents="none"` で装飾SVG自身へのクリックフォーカスを避け、親の操作要素へ渡す。図形のコピー・手描きパス・外部画像ロードはしない。全アイコン動的辞書やCDNを追加しない。
- `CareMoodIcon` は安定したCareMoodIdから図柄へ対応付ける。data/careは意味IDと日英ラベルだけを持つ。
- `CareActionIcon` は既存のname APIを保つ薄いadapter。専門家・ナビも同じAppIconを使う。通知ベル等の他の操作部品は本票で書き換えない。
- 配色/字形を揃える変更であり、選択状態の保存、家族共有、診断、相談送信は追加しない。気分は任意・再タップ解除・言語切替で保持・再mountで初期化を維持。

## 受入

1. 公式exportsの実在・固定依存/peer互換・5気分/4カテゴリ/4ナビ/5行動の対応を検証。旧emoji/Web path固定の試験は新しい図柄契約へ置き換え、挙動試験は残す。
2. 未選択/選択/解除、5種すべて、日英、行動選択との独立、相談/休憩callbackを試験する。SVGは装飾で余分な読み上げ名を作らない。
3. Web実表示の320/390pxと文字拡大で、ラベルの切れ/横溢れ/不明瞭な選択状態を確認。型・全体テスト・Webビルド・契約差分・資料同期も検証する。
4. G03のケア/英語監修とG06の両OS物理端末/読み上げ実測は今回のWeb・合成テストで代替しない。

公式資料は2026-09-27確認：[README](https://github.com/iconoir-icons/iconoir/tree/main/packages/iconoir-react-native)、[package.json](https://raw.githubusercontent.com/iconoir-icons/iconoir/main/packages/iconoir-react-native/package.json)。ライセンス本文は配布パッケージで確認する。
