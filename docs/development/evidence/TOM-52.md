# TOM-52 手動遷移の検証

- 開始：2026-09-27、Windows、dev、HEAD c94d17287c26c8d7aea1a0d806e5d63d8ba4567d。既存差分なし。
- 目的：手動操作にも短い遷移。SSOT/ADR-0010追補、別repo仕様書・設計書をコードより先に更新。
- RED：変更前の手動遷移がフェードを呼ばないことを3失敗（手動・背景化・演出可の受渡し）で確認。修正後の関連試験は成功。
- RN Web 0.21.3のisScreenReaderEnabledが常にtrueとなる実装を確認。自動遷移は止めたまま、手動後の演出はモーション設定で判断。低減有効/不明は即時切替。
- `node --test tests/startup*.test.mjs tests/invitation*.test.mjs`：48/48成功。入口の320ms/8px/native driver、破棄、背景化、遅れたquery、二重操作を合成試験。
- `npm run typecheck` / `npm run check` / Web export（通常・検証フラグ付き）成功。`npm run check:development -- --base c94d17287c26c8d7aea1a0d806e5d63d8ba4567d` は22変更パス・dev限定で成功。
- Web 390pxで「続ける」を実操作。次画面のopacity=0.438484 / translateY=4.49212pxの途中状態、最終opacity=1 / translateY=0、正常な初回説明の表示を確認。
- 既存の紙色/黒円相/Notoを維持し、デザインスキルに沿い動きは入口1回だけに制限。新しい外部依存なし。
- 物理両OS・OSモーション設定切替・実スクリーンリーダーの実測は未実施。G06未達。シミュレーションを代用にしない。
- 資料repo仕様/設計と生成snapshot/ADR/実フロントを同期（source c94d172、dirty=true）。Linear TOM-52のレビューへ記録。全体結果はTOM-61証跡にも記載。
- commit/pushは今回未依頼、実施しない。
