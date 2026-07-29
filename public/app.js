(() => {
  "use strict";

  const form = document.querySelector("[data-candidate-form]");
  const inputsRoot = document.querySelector("[data-inputs]");
  const grid = document.querySelector("[data-game-grid]");
  const empty = document.querySelector("[data-empty-state]");
  const loading = document.querySelector("[data-loading]");
  const error = document.querySelector("[data-form-error]");
  const addButton = document.querySelector("[data-add]");
  const exampleButton = document.querySelector("[data-example]");
  const counter = document.querySelector("[data-candidate-count]");
  const stageTitle = document.querySelector("[data-stage-title]");
  const sortControls = document.querySelector("[data-sort-controls]");
  const fetchedAt = document.querySelector("[data-fetched-at]");
  const dock = document.querySelector("[data-decision-dock]");
  const decisionName = document.querySelector("[data-decision-name]");
  const steamLink = document.querySelector("[data-steam-link]");
  const resetDecision = document.querySelector("[data-reset-decision]");

  if (!(form instanceof HTMLFormElement) || !inputsRoot || !grid) return;

  const automated =
    new URLSearchParams(location.search).get("qa") === "1" || navigator.webdriver === true;
  const storageKey = "tsumi-erabi:session";
  let games = [];
  let selectedAppId = null;
  let currentSort = "input";

  const sessionId = (() => {
    try {
      const existing = localStorage.getItem(storageKey);
      if (existing) return existing;
      const created = crypto.randomUUID();
      localStorage.setItem(storageKey, created);
      return created;
    } catch {
      return crypto.randomUUID();
    }
  })();

  const event = (name, appCount = games.length) =>
    fetch("/api/events", {
      body: JSON.stringify({ appCount, automated, name, sessionId }),
      headers: { "content-type": "application/json" },
      keepalive: true,
      method: "POST",
    }).catch(() => {});

  const candidateInputs = () => [...inputsRoot.querySelectorAll('input[name="candidate"]')];

  const renumber = () => {
    const labels = [...inputsRoot.querySelectorAll(".candidate-input")];
    labels.forEach((label, index) => {
      const number = label.querySelector(":scope > span");
      const remove = label.querySelector("[data-remove]");
      if (number) number.textContent = String(index + 1);
      if (remove) remove.setAttribute("aria-label", `候補${index + 1}を消す`);
      const input = label.querySelector("input");
      input?.setAttribute("aria-label", `候補${index + 1}`);
    });
    if (counter) counter.textContent = `${labels.length} / 6`;
    if (addButton instanceof HTMLButtonElement) addButton.hidden = labels.length >= 6;
  };

  const makeInput = () => {
    const label = document.createElement("label");
    label.className = "candidate-input";
    const number = document.createElement("span");
    number.setAttribute("aria-hidden", "true");
    const input = document.createElement("input");
    input.setAttribute("aria-label", "候補");
    input.autocomplete = "off";
    input.inputMode = "url";
    input.name = "candidate";
    input.placeholder = "Steam URL または App ID";
    input.spellcheck = false;
    input.type = "text";
    const remove = document.createElement("button");
    remove.dataset.remove = "";
    remove.type = "button";
    remove.textContent = "×";
    label.append(number, input, remove);
    return label;
  };

  const clearDecision = () => {
    selectedAppId = null;
    if (dock instanceof HTMLElement) dock.hidden = true;
    render();
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const reviewText = (game) => {
    if (game.review.recentSample === 0) return "新着の日本語レビューなし";
    return `新着${game.review.recentSample}件`;
  };

  const makeGameCard = (game) => {
    const card = el("article", "game-card");
    card.dataset.appId = String(game.appId);
    if (selectedAppId === game.appId) card.classList.add("is-chosen");
    else if (selectedAppId !== null) card.classList.add("is-not-chosen");

    if (selectedAppId === game.appId) card.append(el("span", "chosen-ribbon", "今夜の一本"));

    const cover = el("div", "game-cover");
    const image = document.createElement("img");
    image.alt = "";
    image.decoding = "async";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.src = game.headerImage;
    cover.append(image);
    if (game.discountPercent > 0) {
      cover.append(el("span", "discount-flag", `-${game.discountPercent}%`));
    }

    const body = el("div", "game-body");
    body.append(el("h2", "game-name", game.name));
    const tags = el("div", "tag-row");
    tags.append(
      el(
        "span",
        `tag ${game.japanese ? "jp" : "no-jp"}`,
        game.japanese ? "日本語対応" : "日本語表記なし",
      ),
    );
    game.platforms.forEach((platform) => tags.append(el("span", "tag", platform)));
    body.append(tags);

    const price = el("div", "price-row");
    price.append(el("strong", "", game.price));
    if (game.priceBefore) price.append(el("del", "", game.priceBefore));
    body.append(price);

    const review = el("div", "review-block");
    const reviewHeading = el("div", "review-heading");
    reviewHeading.append(
      el("span", "", "日本語レビュー"),
      el("strong", "", game.review.description),
    );
    const meter = el("div", "review-meter");
    const fill = el("i");
    fill.style.width = `${game.review.recentPositivePercent ?? 0}%`;
    meter.append(fill);
    const reviewNumbers = el("div", "review-numbers");
    reviewNumbers.append(
      el(
        "strong",
        "",
        game.review.recentPositivePercent === null
          ? "—"
          : `${game.review.recentPositivePercent}% 好評`,
      ),
      el("span", "", `${reviewText(game)} · 累計${game.review.total.toLocaleString("ja-JP")}件`),
    );
    review.append(reviewHeading, meter, reviewNumbers);
    body.append(review);

    const meta = el("div", "game-meta");
    const release = el("div");
    release.append(el("span", "", "発売"), el("strong", "", game.releaseDate));
    const genre = el("div");
    genre.append(
      el("span", "", "ジャンル"),
      el("strong", "", game.genres.length ? game.genres.join(" / ") : "未掲載"),
    );
    meta.append(release, genre);
    body.append(meta);

    const choose = el(
      "button",
      "choose-button",
      selectedAppId === game.appId ? "選択中" : "今夜の一本にする",
    );
    choose.type = "button";
    choose.addEventListener("click", () => {
      selectedAppId = game.appId;
      if (decisionName) decisionName.textContent = game.name;
      if (steamLink instanceof HTMLAnchorElement) steamLink.href = game.steamUrl;
      if (dock instanceof HTMLElement) dock.hidden = false;
      void event("decision_made");
      render();
      dock?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    body.append(choose);
    card.append(cover, body);
    return card;
  };

  const sortedGames = () => {
    const copy = [...games];
    if (currentSort === "review") {
      copy.sort(
        (left, right) =>
          (right.review.recentPositivePercent ?? -1) - (left.review.recentPositivePercent ?? -1),
      );
    }
    if (currentSort === "discount") {
      copy.sort((left, right) => right.discountPercent - left.discountPercent);
    }
    return copy;
  };

  const render = () => {
    grid.replaceChildren(...sortedGames().map(makeGameCard));
  };

  inputsRoot.addEventListener("click", (clickEvent) => {
    const button =
      clickEvent.target instanceof Element ? clickEvent.target.closest("[data-remove]") : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const labels = inputsRoot.querySelectorAll(".candidate-input");
    const label = button.closest(".candidate-input");
    const input = label?.querySelector("input");
    if (labels.length <= 2 && input instanceof HTMLInputElement) {
      input.value = "";
      input.focus();
      return;
    }
    label?.remove();
    renumber();
  });

  addButton?.addEventListener("click", () => {
    if (candidateInputs().length >= 6) return;
    const label = makeInput();
    inputsRoot.append(label);
    renumber();
    label.querySelector("input")?.focus();
  });

  exampleButton?.addEventListener("click", () => {
    const examples = [
      "https://store.steampowered.com/app/413150/",
      "https://store.steampowered.com/app/2379780/",
      "https://store.steampowered.com/app/1145360/",
    ];
    candidateInputs().forEach((input, index) => {
      input.value = examples[index] ?? "";
    });
    if (error) error.textContent = "";
  });

  sortControls?.addEventListener("click", (clickEvent) => {
    const button =
      clickEvent.target instanceof Element ? clickEvent.target.closest("[data-sort]") : null;
    if (!(button instanceof HTMLButtonElement)) return;
    currentSort = button.dataset.sort ?? "input";
    sortControls.querySelectorAll("[data-sort]").forEach((candidate) => {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    });
    render();
  });

  resetDecision?.addEventListener("click", clearDecision);
  steamLink?.addEventListener("click", () => {
    void event("steam_opened");
  });

  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const candidates = candidateInputs()
      .map((input) => input.value.trim())
      .filter(Boolean);
    const unique = new Set(candidates);
    if (unique.size < 2) {
      if (error) error.textContent = "異なるSteam URLまたはApp IDを2本以上置いてください。";
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    if (submit instanceof HTMLButtonElement) submit.disabled = true;
    if (error) error.textContent = "";
    if (empty instanceof HTMLElement) empty.hidden = true;
    if (loading instanceof HTMLElement) loading.hidden = false;
    games = [];
    selectedAppId = null;
    if (dock instanceof HTMLElement) dock.hidden = true;
    grid.replaceChildren();
    if (sortControls instanceof HTMLElement) sortControls.hidden = true;
    if (stageTitle) stageTitle.textContent = "取得中";

    try {
      const response = await fetch("/api/compare", {
        body: JSON.stringify({ automated, candidates, sessionId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) {
        const message =
          result.error === "rate_limited"
            ? "短時間の比較回数が多いため、少し待ってからお試しください。"
            : "確認できるゲームが2本未満でした。Steamの商品URLまたはApp IDを見直してください。";
        if (error) error.textContent = message;
        if (empty instanceof HTMLElement) empty.hidden = false;
        if (stageTitle) stageTitle.textContent = "選び台";
        return;
      }
      games = result.games;
      currentSort = "input";
      selectedAppId = null;
      render();
      if (sortControls instanceof HTMLElement) {
        sortControls.hidden = false;
        sortControls.querySelectorAll("[data-sort]").forEach((button) => {
          button.setAttribute("aria-pressed", String(button.dataset.sort === "input"));
        });
      }
      if (stageTitle) stageTitle.textContent = `${games.length}本を比較中`;
      if (fetchedAt) {
        const date = new Date(result.fetchedAt);
        fetchedAt.textContent = `${date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}更新`;
      }
      if (result.unavailable?.length && error) {
        error.textContent = `${result.unavailable.length}本は確認できなかったため、残りを表示しました。`;
      }
    } catch {
      if (error) error.textContent = "通信できませんでした。少し待って、もう一度お試しください。";
      if (empty instanceof HTMLElement) empty.hidden = false;
      if (stageTitle) stageTitle.textContent = "選び台";
    } finally {
      if (loading instanceof HTMLElement) loading.hidden = true;
      if (submit instanceof HTMLButtonElement) submit.disabled = false;
    }
  });

  renumber();
  void event("visited", 0);
})();
