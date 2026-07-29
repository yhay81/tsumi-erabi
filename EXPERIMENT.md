# Experiment

## User and job

- Target user: 買う候補や積みゲーが複数あり、今遊ぶ一本を決めきれない日本語話者のSteam利用者。
- Job to be done: 2〜6本の価格、日本語レビュー、日本語対応、対応環境を同じ面で比べ、今遊ぶ一本を決めてSteamを開く。
- Current workaround: Steamのタブを何枚も開き、価格とレビューを往復して比較する。SNSや動画のおすすめを見続ける。

## Hypothesis

Steam URLを置くだけなら、アカウント登録なしで5分以内に候補比較と一本の決定を完了できる。

## Method

- Recruitment channel: Tool Shelf、検索流入、自然な共有。個別勧誘は行わない。
- Participants: 自動QAを除く匿名セッション。
- Duration: 2026-07-29から14日間。
- Comparison: 訪問→比較→一本を選ぶ→Steamを開く、の実利用ファネル。

## Decision

- Success signal: 14日以内に実利用者10人以上、比較完了5人以上、一本を選ぶ3人以上、Steam遷移2人以上。
- Failure signal: 実利用者が3人未満、または比較完了が0。Steamデータの継続取得が不安定。
- Deadline: 2026-08-12。
- Maximum build time: 1日。
- Maximum monthly infrastructure cost: 5 USD。

## Guardrails

- 個人情報や非公開情報を公開しない。
- 利用者数のために安全性、削除可能性、robots、利用条件を弱めない。
- 成功条件を途中で都合よく変更しない。
