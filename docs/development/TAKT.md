# TAKTで小さく開発する

検証対象CLI：0.49.0。参照はインストール版のworkflow schemaと付属default workflow。
[公式日本語README](https://github.com/nrslib/takt/blob/main/docs/README.ja.md)のmainは将来変わるので、手元版と照合する。

## 運用

1. LinearのE作業群から1成果物の子チケットを選び、task-templateを埋める。
2. 承認仕様・対象ファイル・テスト・権限を読んで差分を限定する。
3. plan → write_tests → implement → review → verify。失敗はfixへ戻し、12ステップ以内。未解決のまま成功させない。
4. 人が差分・実行証跡・Gを確認する。TAKTのCOMPLETEは人への引渡しだけ。
5. Git/Linear/公開の更新はワークフロー外で明示的に判断する。

## 静的検査

```powershell
takt --version
takt workflow doctor .takt/workflows/tomurai-small-change.yaml
npm test
npm run check
```

このworkflowは安全側の既定値としてmock providerを指定している。
mockは決められた応答で遷移を検査するだけで、コードを実装・実行・レビューしない。
mockのCOMPLETEやレポートを機能テスト合格と扱わない。

実プロバイダでの実行は、担当者が認証・利用予算・対象子チケットを確認し明示指定する。
勝手に実プロバイダへ切り替えず、アプリ内Claudeモデル指定と開発エージェントを混同しない。
自動push/PR/merge/deployは設定しない。`--skip-git`等の実際の動作を確認してから使用する。
プロンプト上の禁止はOS/ネットワークの強制遮断ではない。実実行では最小権限の環境も必要。

## 証跡と未実施

各実行の入力、版、差分、コマンド/終了コード、レビュー結果をLinear子チケットへ記録する。
会話・氏名・招待トークン・本番設定をレポートへ含めない。TAKT生成物はGitに自動追加しない。
現在の実施状況は `verification-2026-09-26.md` に記録する。
