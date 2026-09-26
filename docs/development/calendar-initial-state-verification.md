# TOM-40：死亡日カレンダーの初期状態

2026-09-26。決定責任者：テックリード・會田 純一朗。C01/R19。

- 原因：OnboardingだけがCalendarDateFieldへ `initialOpen` を渡していた。
- SSOT/ADR-0005/画面カタログ/tomurai-docsの仕様・設計を先に更新し、その指定のみ除去。共通部品は元からfalseが既定。別質問/確認画面で部品がアンマウントされ、戻ると閉じて再表示する。親の回答は保持する。独立レビューでも追加effect/key不要を確認。
- 新しい配線回帰テストは修正前に失敗、修正後に成功。全105テスト、check、typecheck、Web build、diff check成功。配線テストはReact実行の代わりではない。
- 同じRN Webのローカルビルドで、開始→死亡日の質問はcollapsed、日付欄を押すとexpanded、合成日付2026-09-01を選択→次の質問→戻るでcollapsedかつ同じ日付保持をAXで確認。
- Androidの共有ソースも変更対象だが、今回の実操作確認はWeb。物理実機/iOS/TalkBackや全10問経由の再編集は今回未実施。Fast Refreshが開閉状態を保持する場合は、別質問から戻るか再読み込みして確認する。
- プロダクトdevのみ。main・公開4HTML・日付の制約・料金/権限には変更なし。
