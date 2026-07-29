import { Layout } from "./layout";

export function HomePage() {
  return (
    <Layout>
      <section class="board-shell" id="compare">
        <header class="board-heading">
          <div class="board-title">
            <span class="stack-mark" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <div>
              <p>STEAM CANDIDATE BOARD</p>
              <h1>今夜の一本を選ぶ</h1>
            </div>
          </div>
          <div class="board-legend" aria-label="比較項目">
            <span>
              <i class="legend-dot price-dot"></i>価格
            </span>
            <span>
              <i class="legend-dot review-dot"></i>日本語レビュー
            </span>
            <span>
              <i class="legend-dot device-dot"></i>対応環境
            </span>
          </div>
        </header>

        <div class="choice-board">
          <form class="candidate-tray" data-candidate-form>
            <div class="panel-label">
              <div>
                <span>候補置き場</span>
                <strong data-candidate-count>3 / 6</strong>
              </div>
              <button class="quiet-button" data-example type="button">
                例を置く
              </button>
            </div>
            <div class="candidate-inputs" data-inputs>
              {[1, 2, 3].map((number) => (
                <label class="candidate-input">
                  <span aria-hidden="true">{number}</span>
                  <input
                    aria-label={`候補${number}`}
                    autocomplete="off"
                    inputmode="url"
                    name="candidate"
                    placeholder="Steam URL または App ID"
                    spellcheck={false}
                    type="text"
                  />
                  <button aria-label={`候補${number}を消す`} data-remove type="button">
                    ×
                  </button>
                </label>
              ))}
            </div>
            <button class="add-button" data-add type="button">
              <span>＋</span> 候補を追加
            </button>
            <p class="form-error" data-form-error role="alert"></p>
            <button class="compare-button" type="submit">
              <span class="compare-icon" aria-hidden="true">
                ⇄
              </span>
              横に並べて比べる
            </button>
            <p class="tray-note">2〜6本。候補URLは比較にだけ使い、履歴として保存しません。</p>
          </form>

          <section class="comparison-stage" aria-label="ゲーム比較">
            <div class="stage-toolbar">
              <div class="status-label">
                <span class="status-light"></span>
                <strong data-stage-title>選び台</strong>
              </div>
              <div class="sort-controls" data-sort-controls hidden>
                <span>並び順</span>
                <button aria-pressed="true" data-sort="input" type="button">
                  入力順
                </button>
                <button aria-pressed="false" data-sort="review" type="button">
                  評判
                </button>
                <button aria-pressed="false" data-sort="discount" type="button">
                  セール
                </button>
              </div>
              <time data-fetched-at></time>
            </div>

            <div class="empty-cards" data-empty-state aria-hidden="true">
              {[1, 2, 3].map((number) => (
                <article class="empty-card">
                  <div class="empty-cover">
                    <span>{number}</span>
                  </div>
                  <div class="empty-lines">
                    <i></i>
                    <i></i>
                    <i></i>
                  </div>
                  <div class="empty-meter">
                    <i></i>
                  </div>
                </article>
              ))}
            </div>

            <div class="loading-state" data-loading hidden>
              <div class="loading-stack" aria-hidden="true">
                <i></i>
                <i></i>
                <i></i>
              </div>
              <p>候補の価格と日本語レビューを確認しています…</p>
            </div>

            <div class="game-grid" data-game-grid aria-live="polite"></div>
            <p class="stage-note">
              Steamの公開情報を短時間キャッシュして表示します。価格・対応状況は購入前にSteamで再確認してください。
            </p>
          </section>
        </div>

        <aside class="decision-dock" data-decision-dock hidden>
          <div>
            <span>今夜の一本</span>
            <strong data-decision-name></strong>
          </div>
          <button class="reset-decision" data-reset-decision type="button">
            選び直す
          </button>
          <a class="steam-button" data-steam-link href="#" rel="external">
            Steamで見る <span aria-hidden="true">↗</span>
          </a>
        </aside>
      </section>
      <script src="/app.js"></script>
    </Layout>
  );
}

export function PrivacyPage() {
  return (
    <Layout title="プライバシー | つみえらび">
      <article class="prose">
        <p class="eyebrow">PRIVACY</p>
        <h1>候補の履歴は保存しません。</h1>
        <section>
          <h2>Steamから取得する情報</h2>
          <p>
            入力された公開App
            IDについて、商品名、画像、価格、日本語対応、対応OS、ジャンル、発売日、日本語レビューの集計を取得します。
            レビュー本文、Steamアカウント、ウィッシュリストやライブラリは取得しません。取得結果は負荷軽減のため最長7日保持し、表示には6時間以内のキャッシュを使います。
          </p>
        </section>
        <section>
          <h2>利用状況</h2>
          <p>
            ページ表示、比較完了、一本を選んだ操作、Steamへの遷移を、ブラウザで生成したランダムな匿名IDとともに記録します。
            URLや選んだゲームのApp
            IDは利用状況へ保存しません。匿名IDはブラウザのlocalStorageに保存し、Cookieは使いません。
          </p>
        </section>
        <section>
          <h2>濫用防止と削除</h2>
          <p>
            短時間の過剰アクセスを抑えるため、ネットワーク識別子から作った復元できないハッシュを最長20分保持します。
            集計イベントは35日以内に削除します。ブラウザ側の匿名IDは、サイトデータの削除でいつでも消去できます。
          </p>
        </section>
        <section>
          <h2>外部サービス</h2>
          <p>
            商品情報と画像はSteamから取得します。このサービスはValve
            CorporationまたはSteamによる承認・提携サービスではありません。
            Steamの情報は現状有姿で提供され、正確性や継続性を保証しません。
          </p>
        </section>
        <section>
          <h2>運営</h2>
          <p>
            運営者はyhay81です。セキュリティ上の連絡はGitHubのPrivate vulnerability
            reportingをご利用ください。
          </p>
        </section>
      </article>
    </Layout>
  );
}

export function NotFoundPage() {
  return (
    <Layout title="ページが見つかりません | つみえらび">
      <article class="prose not-found">
        <p class="eyebrow">404</p>
        <h1>この選び台は見つかりません。</h1>
        <p>
          <a class="text-link" href="/">
            候補を置く画面へ戻る
          </a>
        </p>
      </article>
    </Layout>
  );
}
