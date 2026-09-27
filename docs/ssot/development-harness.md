# 開発スキルと変更検証の正本 — TOM-67

決定責任者：テックリード・會田 純一朗。2026-09-27。ADR-0012。

Codex・Claude Codeのどちらから着手しても、同じ承認済み仕様・作業境界・検証手順を参照する。今回の依頼は開発ルールの整備であり、生前ノート第4問への回答、インフラ保留の解除、公開承認ではない。通常の実装詳細として以下を採用する。

## 構成と適用範囲

- `AGENTS.md`：常時参照する最低限の不変条件とスキルへの入口。
- `.agents/skills/tomurai-development/SKILL.md`：共通手順の正本。必要なときだけ同フォルダーの参照資料を読む。
- `.claude/skills/tomurai-development/SKILL.md`：Claude Code用の薄い入口。相対リンクで共通手順を必読とし、業務規則を複製しない。
- `CLAUDE.md`：`@AGENTS.md` を読み込む。個人の設定、許可ツール、モデル、グローバルスキルは変更しない。
- `scripts/check-development.mjs`：構成・変更契約の検査。`npm run check:development` から呼び、既存 `npm run check` に含める。
- `docs/development/changes/TOM-<番号>.json`：レビュー可能な単位の変更契約。再開時は同じ票の契約を更新する。
- `docs/development/evidence/`：実行結果・失敗・未実施・残条件。テスト結果を契約から自動的に「合格」と扱わない。

プロダクトのGitルートで起動するのを標準にする。資料リポジトリの入口は文書専用の規則と正本への案内を持つ。非Gitの親フォルダーに置く案内はこのローカル環境用であり、Gitで配布したスキルや個人の全案件の規則と取り違えない。

## 作業の契約

1. 依頼を説明・調査／決定の記録／実装／公開などに分類。質問・診断だけでは修正や外部更新を開始しない。
2. Gitのルート、ブランチ、差分、既存作業と対応するLinear票を読み取る。確認できる事実は先に調べる。票が読めない場合は未確認と記録し、外部連携の完了を捏造しない。
3. 要件正本と変更に関係する詳細だけを読み、未決条件と受入・否定試験を分ける。新しい料金・権限・送信・削除・支出・法的判断などは勝手に補完しない。
4. 仕様が変わるなら、対象SSOT・ADR・仕様書・設計書をコードより先に更新する。仕様を変えない修正は根拠を残し、空のADRを量産しない。
5. 変更契約を用意し、失敗を再現する試験から最小実装へ進む。別エージェントにも票・正本・編集可能パスを渡す。結果は主担当が確認する。
6. 実行した検査の結果を残し、変更範囲を検証する。依頼された範囲のチケット管理と、公開・git送信の承認を区別する。TAKT内では既存の外部更新禁止を維持する。

## 変更契約JSON（version 1）

未知のキー、重複、空値、不正な型はエラー。項目は次の8個のみ。

| キー | 条件 |
|---|---|
| version | 数値1 |
| ticket | `TOM-` + 正の整数。ファイル名と一致 |
| requirements | C01–C19またはR01–R48のID配列、1件以上、重複なし |
| gates | G01–G06のID配列、重複なし。適用なしなら空配列とし理由をevidence本文に記す。関連確認先であり承認済みという意味ではない |
| allowedPaths | リポジトリ相対の厳密なファイルパス配列、1件以上。契約自身・証跡・変更する文書も含む |
| evidence | 存在するリポジトリ内の `.md` ファイル。allowedPathsに含める |
| docs | mode、reason、pathsのみ。modeはupdated/not-required。reasonは常に非空。updatedは存在する文書パス1件以上かつallowedPaths内。not-requiredはpaths空で理由を記録 |
| testCommands | 実施予定コマンドの非空文字列配列、1件以上、重複なし。検査器は一切実行しない |

パスは `/` 区切り。絶対パス、`..`、空セグメント、制御文字、glob、バックスラッシュ、`.git`、symlink経由の範囲外参照を拒否。削除・rename前のallowedPathsはファイルがなくてもよい。秘密情報・生成物の扱いは差分検証時も別途確認する。`.env.example` は値が合成例であることをレビューする。

## 検査モード

通常はスキルの接続ファイル・共通手順への参照・UIメタデータの自動選択設定・全変更契約の構造を検査する。設定が存在することは実際のクライアントで読み込まれた証拠ではない。

`npm run check:development -- --base <REF>` はGitによりREFをcommitへ安全に解決し、次のパス集合の和を検査する。

- base → HEAD、HEAD → index、index → worktree の差分。renameは旧・新双方。
- `git ls-files --others --exclude-standard` の未追跡ファイル。

その集合で変更された契約だけが今回の変更をカバーできる。過去の未変更契約を流用して範囲外変更を正当化しない。削除された契約ではカバーできない。複数票の既存作業は別契約で分離し、無関係な変更を今回の成果に取り込まない。

ローカルは `dev` のみ。GitHub Actionsのdetached HEADでは `GITHUB_ACTIONS=true` に加えイベントJSONのpush ref=`refs/heads/dev` またはpull_request base.ref=`dev`を照合する。任意の `--target` による迂回は作らない。環境変数は認可の証明ではない。

検査器からGitを呼ぶ際はrepository/indexを差し替える環境変数を引き継がない。Windowsの所有者差異には、当該呼出しだけの `git -c safe.directory=<解決済み対象root>` を使う。global/local configやOSの所有権は変更しない。

保護HTML（ルートの `index.html` / `contact.html` / `privacy.html` / `terms.html`）、秘密鍵・`.env`等の設定、生成物・依存物の変更を拒否する。今回は保護HTMLの例外スイッチを作らない。将来これらを正当に変更する依頼は、別票で明示承認と検査ポリシーを先にレビューする。ignore済みローカルファイルを全走査する秘密検知ツールではない。

CIでは全履歴を取得し、pushのbefore SHAまたはPR base SHAを環境変数経由で渡す。初回pushでbeforeがゼロの場合はroot commitを基準とする（現在のdevには適用されない）。スキル導入前の履歴全体への遡及適用はしない。テスト文字列やイベント値をshell式として評価しない。

## 検証と限界

合成Gitリポジトリで正常、main拒否、未追跡、rename、既存契約流用、範囲外、秘密/生成物、不正パス・型などを試す。共通スキルの形式検査と、別担当による具体的な依頼を使った前向き試験も行う。業務コードを変更しない本票では物理端末の再試験を完了扱いにしない。

これは指示＋ローカル/CI検査であり、任意コマンドを遮断するsandbox、改ざん不能な承認簿、秘密情報スキャナーではない。GitHubの必須チェック/branch protectionは未変更。人が証跡と差分をレビューしなければ、記述しただけの承認やテスト結果は検出できない。公開前には最小権限、必須レビュー、実接続試験とG01–G06の実証が別途必要。

## 仕様確認元

2026-09-27に公式資料を確認。配置・自動選択はクライアントの設定にも依存する。

- [Codex skills](https://learn.chatgpt.com/docs/build-skills)
- [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Claude Code memory](https://code.claude.com/docs/en/memory)
