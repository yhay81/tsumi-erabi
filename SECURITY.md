# Security Policy

## Reporting

脆弱性を公開Issueへ投稿せず、GitHubのPrivate vulnerability reportingから連絡してください。

## Baseline

- 秘密値をGitへ保存しない。
- 依存関係とCloudflare互換日付を固定する。
- CSP、入力検証、出力エスケープ、レート制限を有効にする。
- ユーザー生成HTMLを描画しない。
- 本番データをテストへコピーしない。
- 取得先はSteamの固定HTTPSホストと数値App IDに限定し、利用者入力を任意URLとしてfetchしない。
- 1ネットワークあたり10分30比較、1匿名IDあたり1日200イベントを上限とする。
- Steamレスポンスからレビュー本文と利用者情報を捨て、集計値だけをキャッシュする。
