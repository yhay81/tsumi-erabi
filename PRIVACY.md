# Privacy

## Collect and retain

- Steamの公開App IDについて取得した商品名、画像URL、価格、日本語対応、対応OS、ジャンル、発売日、日本語レビュー集計をD1へ保存する。表示キャッシュは6時間、レコードは7日以内に削除する。
- ページ表示、比較完了、一本の選択、Steam遷移を、ブラウザ生成のランダム匿名IDをSHA-256でハッシュした値とともに保存する。App IDやURLはイベントへ保存せず、イベントは35日以内に削除する。
- 濫用防止に、ネットワーク識別子と時間枠から作ったSHA-256ハッシュを最長20分保持する。IPアドレス自体はD1へ保存しない。
- 匿名IDはファーストパーティlocalStorageへ保存する。Cookie、Steamログイン、広告トラッカーは使わない。

## Do not collect

- Steamアカウント、パスワード、ウィッシュリスト、ライブラリ
- レビュー本文やレビュアー情報
- 入力した候補の組み合わせや、選択したApp ID

## Deletion and operator

- ブラウザ側の匿名IDは、利用者がサイトデータを削除すれば消去できる。
- サーバー側はCronで期限削除する。
- Operator: yhay81
- Security contact: GitHub Private vulnerability reporting
