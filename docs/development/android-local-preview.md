# WindowsでのAndroidローカルプレビュー — TOM-29

- 対象：[TOM-29](https://linear.app/aitane/issue/TOM-29)、C01 / R19 / R41 / R44 / R46。
- 決定責任者：テックリード・會田 純一朗。2026-09-26のWindows内ローカル起動の承認に基づく。
- 状態：専用エミュレーターへのインストール、Metro接続、ホーム・心のケア・専門家の画面表示を確認済み。確認範囲と未実施項目は[検証記録](./verification-2026-09-26.md)を参照する。

## 起動と終了

リポジトリのルートで、PowerShellから実行する。

```powershell
npm run android:preview
```

入口は `scripts/start-android-preview.ps1`。Tomurai専用AVD `tomurai_pixel_api35` を使い、エミュレーターのシリアル `emulator-5556` を明示して接続する。Metroはポート `8081` のlocalhostで起動する。起動中はこのターミナルを開いたままにする。

このPCで描画・接続が止まる事象を観測したため、新規起動時はソフトウェア描画（`-gpu software`）とコールドブート（`-no-snapshot-load`）を指定する。保存済み端末データを消す指定ではない。起動には1〜3分程度かかる場合がある。GPUが原因と確定したわけではなく、長時間の安定性は継続確認する。

前提だけを確認する場合、または起動済みのTomuraiのMetroへ再接続する場合は次を使う。

```powershell
npm run android:preview -- -CheckOnly
npm run android:preview -- -OpenOnly
```

`-CheckOnly` はエミュレーター・Metroを起動せず、必要な実行ファイルと専用AVDを確認する。ADBが既に動いていれば、対象AVDとExpo Goの存在も確認する。`-OpenOnly` は専用AVDを必要に応じて起動し、8081の待受先とExpoマニフェスト内のプロジェクトパスを確認してから、そのAVDだけにADB reverseを設定してExpo Goを開く。SDK・AVD・Expo Goを自動でインストールする機能はない。

終了するときは、起動したターミナルで `Ctrl+C` を押してMetroを停止し、Androidエミュレーターのウィンドウを閉じる。AVDの削除やデータ初期化は不要。次回も同じコマンドから起動する。

通常起動は8081が使用中なら停止する。既にこのプロジェクトのMetroが動いている場合は `-OpenOnly` を使う。エミュレーターの5556/5557が別の処理に使われている場合も、その処理を確認する。無関係なプロセスの強制終了や既存AVDの初期化で解決しない。ExecutionPolicy、恒久的なPATH、OS設定は変更しない。

ADBの起動確認が応答しなくなった場合は `Ctrl+C` で中断し、専用端末の接続だけを再確立して通常起動をやり直す。既定のSDK配置での例：

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s emulator-5556 reconnect
npm run android:preview
```

ADB全体の停止やAVDの消去は不要。ランチャー内の `adb shell` は `-n` を指定し、ターミナルの標準入力を読み取らない。

## 実行構成

この手順は、メモリ内の合成データを使う現行UIをAndroid上で確認するためのもの。インストール済みExpo SDKは `57.0.25`。2026-09-26にExpo公式バージョンAPIのSDK `57.0.0` のエントリが返した互換クライアントはExpo Go `57.0.9`。

- 公式の互換情報：[Expo versions API](https://api.expo.dev/v2/versions/latest)
- 取得元：[Expo Go 57.0.9 APK](https://github.com/expo/expo-go-releases/releases/download/Expo-Go-57.0.9/Expo-Go-57.0.9.apk)
- Android 35 / Google APIsの既存システムイメージを専用AVDで使用する。既存AVDのデータを変更・消去しない。
- Android SDKなどのパスは起動プロセス内で設定する。恒久的なPATH、ファイアウォール、Hyper-V等のOS設定は変更しない。
- 新しいSDKライセンスへの同意、OS再起動、追加費用が必要になった場合は、この手順の範囲を超えるため停止して確認する。

R41のExpo Development Buildを第一案とする方針は維持する。Expo Goの表示確認だけで、認証・通知・リンクなど本番機能の成立を判定しない。現行のdevelopment client用起動設定とは別の、ローカルUI確認用の入口である。

## localhostの扱い

ランチャーはMetroに相当する次のコマンドを実行し、対象端末の操作はADBで `emulator-5556` を明示する。Expo CLIの `--android` による端末自動選択は使用しない。

```powershell
# apps/mobileで実行するMetro部分。通常はルートのランチャーを使う。
node --dns-result-order=ipv4first ../../node_modules/expo/bin/cli start --go --localhost --port 8081
```

インストール済みExpo CLIの実装では、`--localhost` はサーバーの待受先にも適用される。ただし、WindowsでlocalhostがIPv6の `::1` に解決されると、ADB reverse経由のIPv4接続が届かない。このためランチャーはNodeに `--dns-result-order=ipv4first` を指定し、接続URLもプロセス内の `REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1` で揃える。URL設定だけを待受先制限の代用にしない。プロキシURLの上書き設定がある場合は停止する。

実行中の確認例：

```powershell
Get-NetTCPConnection -LocalPort 8081 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

この経路では `127.0.0.1` の待受が必要。`::1` だけの場合は、Metroを上記のIPv4優先コマンドで起動し直す。LAN公開・トンネル公開・EASクラウドビルドはこの手順の対象外。

## 残る検証

### 権限・プランの表示確認（TOM-38/39）

Metro開発版では、Tomuraiヘッダー左の3本スライダーのアイコンから設定を開く（右上の歯車はExpoの操作）。「招待された家族」などのプリセット、プラン、支払権限、回答担当、参加状態、承認人数を選び「この設定で表示する」を押す。下部の「開く画面」でタスク等へ直接移動できる。

無料は固定2件＋ぼかし、家族/β/法人支援は承認済みなら全件、未承認は家族情報なし。単独プランは承認済み1名の場合だけ全件。権限とプランは実際の契約を変更せず、再起動すると初期値へ戻る。質問入力途中で設定を適用すると未確定の入力を閉じる。

Stripeのリンクは未作成で決済の準備中、家族リクエストも送信の準備中。どちらも本当に送信/支払済みにはならない。公開Web書き出しには開発設定入口は含めない。

初回のAVD起動、Expo Goへの接続、日本語のホーム・ケア・専門家表示とタブ切替を確認した。Androidでの全質問からホームへの遷移、英語、担当の保存/取消、読み上げ等の網羅確認は残っている。Webの結果をAndroidの成功として転記しない。

Androidエミュレーターの結果は物理実機・iOSの確認やG06合格の代替ではない。実認証・家族同期・永続保存・本番決済・実通知・公開は別作業。G01〜G06の公開条件は引き続き適用する。

ローカルのdevelopment buildには、同梱テンプレート上でGradle `9.3.1`、NDK `27.1.12297006`、Java 17のコンパイルtoolchainが必要。確認時点ではGradleキャッシュは8.14、NDKは28.2.13676358、Android Studio付属Javaは21.0.10であり、追加取得やビルド検証はこのExpo Go経路では実施していない。compile SDK 36 / Build Tools 36.0.0は既に存在する。
