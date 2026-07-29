# Metrics

## Product outcome

プロダクト固有の成功を測る。ページビューや登録数だけで成功としない。新しい追跡Cookieを足す前に、中核jobで自然に生じる業務データから集計できないか確認する。

各プロダクトは、公開前に次の5段階を具体的なDB状態へ割り当てる。

| Stage           | Meaning                        | Example                      |
| --------------- | ------------------------------ | ---------------------------- |
| `signed_up`     | 所有者が登録した               | Better Authのuser row        |
| `activated`     | 中核作業の器を作った           | アルバム、受信箱、募集を作成 |
| `value_created` | 他者へ渡せる価値を入れた       | 写真追加、公開、回答募集     |
| `job_completed` | 実利用者が中核jobを完了した    | 原本DL、投稿受信、日程確定   |
| `returned`      | 別の日または別案件で再利用した | 2件目作成、複数日受信        |

## つみえらびの割り当て

アカウント登録が中核jobに不要なため、`signed_up`は匿名訪問者に読み替える。

| Stage           | D1 event / condition                              |
| --------------- | ------------------------------------------------- |
| `signed_up`     | `visited`を記録した自動QA以外の匿名セッション     |
| `activated`     | 2本以上を取得し`comparison_loaded`を記録          |
| `value_created` | `decision_made`を記録し、「今夜の一本」を選択     |
| `job_completed` | 選んだ商品の`steam_opened`を記録                  |
| `returned`      | 同じ匿名セッションが異なる2日以上にイベントを記録 |

イベントへ候補URL、App ID、選んだゲームは保存しない。`?qa=1`の自動操作は`is_automated = 1`で記録し、`npm run metrics`の集計から除外する。

## Required ratios

- Activation: `activated / signed_up`
- Value creation: `value_created / activated`
- Completion: `job_completed / value_created`
- Return: `returned / job_completed`
- Seven-day new users and completed jobs

## Operator contract

- `npm run metrics`を用意し、本番集計をJSONで標準出力する。
- 出力は`generated_at`、`service`、`environment`、`funnel`、`rates`を持つ。
- メールアドレス、表示名、URL slug、本文、ファイル名、IP、個別IDを出力しない。
- 分母0の比率は0とし、失敗や欠測を成功扱いしない。
- サービス画面へ検証条件を載せない。判断条件は`EXPERIMENT.md`と公開Issue、操作画面は利用者のjobに集中させる。
- 生ログは公開しない。公開結果は集計し、少数セルや自由記述から個人を推測できないようにする。
