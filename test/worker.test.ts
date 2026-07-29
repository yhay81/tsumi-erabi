import { afterEach, describe, expect, it, vi } from "vitest";

import { extractAppId, fetchSteamGame, parseCandidateInputs, shapeSteamGame } from "../src/steam";
import { app, type Bindings } from "../src/worker";

const sessionId = "7c0dbe70-8c47-4fc0-aa62-52427133c612";
const sameOrigin = { "content-type": "application/json", "sec-fetch-site": "same-origin" };

type Call = {
  arguments: unknown[];
  sql: string;
};

const makeBindings = (options: { requestCount?: number } = {}) => {
  const calls: Call[] = [];
  const cache = new Map<number, { fetched_at: number; payload: string }>();
  const prepare = vi.fn((sql: string) => {
    const call: Call = { arguments: [], sql };
    calls.push(call);
    const statement = {
      bind: vi.fn((...arguments_: unknown[]) => {
        call.arguments = arguments_;
        return statement;
      }),
      first: vi.fn(async () => {
        if (sql.includes("FROM game_cache")) {
          return cache.get(Number(call.arguments[0])) ?? null;
        }
        if (sql.includes("FROM request_limits")) return { count: options.requestCount ?? 0 };
        if (sql.includes("FROM product_events")) return { count: 0 };
        return null;
      }),
      run: vi.fn(async () => {
        if (sql.includes("INSERT INTO game_cache")) {
          cache.set(Number(call.arguments[0]), {
            fetched_at: Number(call.arguments[2]),
            payload: String(call.arguments[1]),
          });
        }
        return { success: true };
      }),
    };
    return statement;
  });
  const batch = vi.fn(async () => []);
  return {
    bindings: {
      ASSETS: { fetch: () => Promise.resolve(new Response("not used")) },
      DB: { batch, prepare },
    } as unknown as Bindings,
    cache,
    calls,
  };
};

const steamFetch = vi.fn(async (input: string | URL | Request) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
  if (url.pathname === "/api/appdetails") {
    const appId = url.searchParams.get("appids") ?? "0";
    return Response.json({
      [appId]: {
        data: {
          genres: [{ description: "インディー" }, { description: "RPG" }],
          header_image: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
          is_free: false,
          name: `Game ${appId}`,
          platforms: { linux: false, mac: true, windows: true },
          price_overview: {
            discount_percent: 20,
            final_formatted: "¥ 960",
            initial_formatted: "¥ 1,200",
          },
          release_date: { coming_soon: false, date: "2026年7月1日" },
          supported_languages: "英語, 日本語<strong>*</strong>",
          type: "game",
        },
        success: true,
      },
    });
  }
  if (url.pathname.startsWith("/appreviews/")) {
    return Response.json({
      query_summary: {
        review_score_desc: "Very Positive",
        total_negative: 10,
        total_positive: 90,
        total_reviews: 100,
      },
      reviews: [{ voted_up: true }, { voted_up: true }, { voted_up: false }],
      success: 1,
    });
  }
  return new Response("not found", { status: 404 });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  steamFetch.mockClear();
});

describe("Steam candidate parsing", () => {
  it("accepts Steam store URLs and numeric App IDs only", () => {
    expect(extractAppId("https://store.steampowered.com/app/413150/Stardew_Valley/")).toBe(413150);
    expect(extractAppId("２３７９７８０")).toBe(2379780);
    expect(extractAppId("https://example.com/app/413150")).toBeNull();
    expect(parseCandidateInputs(["413150", "413150", "2379780", "bad"])).toEqual([413150, 2379780]);
  });

  it("keeps only aggregate review data and normalizes Japanese product details", () => {
    const game = shapeSteamGame(
      413150,
      {
        genres: [{ description: "RPG" }],
        header_image: "https://shared.fastly.steamstatic.com/example.jpg",
        name: "Stardew Valley",
        platforms: { linux: true, mac: true, windows: true },
        price_overview: { discount_percent: 0, final_formatted: "¥ 1,480" },
        release_date: { date: "2016年2月27日" },
        supported_languages: "英語, 日本語<strong>*</strong>",
        type: "game",
      },
      {
        query_summary: {
          review_score_desc: "Very Positive",
          total_positive: 90,
          total_reviews: 100,
        },
        reviews: [{ voted_up: true }, { voted_up: false }],
        success: 1,
      },
    );
    expect(game).toEqual(
      expect.objectContaining({
        japanese: true,
        name: "Stardew Valley",
        platforms: ["Windows", "macOS", "Linux"],
        price: "¥ 1,480",
      }),
    );
    expect(game.review).toEqual(
      expect.objectContaining({
        description: "非常に好評",
        positivePercent: 90,
        recentPositivePercent: 50,
        recentSample: 2,
      }),
    );
    expect(JSON.stringify(game)).not.toContain("timestamp_created");
  });

  it("caches shaped game data for repeated comparisons", async () => {
    const { bindings } = makeBindings();
    const now = 1_800_000_000;
    const first = await fetchSteamGame(bindings.DB, 413150, steamFetch as typeof fetch, now);
    const second = await fetchSteamGame(bindings.DB, 413150, steamFetch as typeof fetch, now + 60);
    expect(first.name).toBe("Game 413150");
    expect(second).toEqual(first);
    expect(steamFetch).toHaveBeenCalledTimes(2);
  });
});

describe("つみえらび worker", () => {
  it("renders the comparison board with modest typography and no experiment copy", async () => {
    const response = await app.request("/", undefined, makeBindings().bindings);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("content-security-policy")).toContain(
      "shared.fastly.steamstatic.com",
    );
    expect(html).toContain('lang="ja"');
    expect(html).toContain('class="choice-board"');
    expect(html).toContain("Steam URL または App ID");
    expect(html).toContain('aria-label="候補1"');
    expect(html).toContain("横に並べて比べる");
    expect(html).toContain("今夜の一本");
    expect(html).not.toContain('class="hero"');
    expect(html).not.toContain("Success signal");
    expect(html).not.toContain("検証");
  });

  it("loads two Steam candidates, caches aggregate data, and records the comparison", async () => {
    vi.stubGlobal("fetch", steamFetch);
    const { bindings, calls } = makeBindings();
    const response = await app.request(
      "/api/compare",
      {
        body: JSON.stringify({
          automated: true,
          candidates: ["413150", "https://store.steampowered.com/app/2379780/"],
          sessionId,
        }),
        headers: sameOrigin,
        method: "POST",
      },
      bindings,
    );
    const result = await response.json<{
      games: Array<{ appId: number; name: string }>;
      unavailable: unknown[];
    }>();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(result.games.map((game) => game.appId)).toEqual([413150, 2379780]);
    expect(result.unavailable).toEqual([]);
    expect(calls.filter((call) => call.sql.includes("INSERT INTO game_cache"))).toHaveLength(2);
    const eventCall = calls.find((call) => call.sql.includes("INSERT INTO product_events"));
    expect(eventCall?.arguments).toContain("comparison_loaded");
    expect(eventCall?.arguments).toContain(1);
  });

  it("rejects cross-site, duplicate, and rate-limited comparison requests", async () => {
    const crossSite = await app.request(
      "/api/compare",
      {
        body: JSON.stringify({ candidates: ["413150", "2379780"], sessionId }),
        headers: { "content-type": "application/json", "sec-fetch-site": "cross-site" },
        method: "POST",
      },
      makeBindings().bindings,
    );
    expect(crossSite.status).toBe(403);

    const duplicate = await app.request(
      "/api/compare",
      {
        body: JSON.stringify({ candidates: ["413150", "413150"], sessionId }),
        headers: sameOrigin,
        method: "POST",
      },
      makeBindings().bindings,
    );
    expect(duplicate.status).toBe(400);

    const limited = await app.request(
      "/api/compare",
      {
        body: JSON.stringify({ candidates: ["413150", "2379780"], sessionId }),
        headers: sameOrigin,
        method: "POST",
      },
      makeBindings({ requestCount: 30 }).bindings,
    );
    expect(limited.status).toBe(429);
  });

  it("accepts only named aggregate events and hashes the anonymous session", async () => {
    const { bindings, calls } = makeBindings();
    const accepted = await app.request(
      "/api/events",
      {
        body: JSON.stringify({
          appCount: 3,
          automated: false,
          name: "decision_made",
          sessionId,
        }),
        headers: sameOrigin,
        method: "POST",
      },
      bindings,
    );
    expect(accepted.status).toBe(204);
    const insert = calls.find((call) => call.sql.includes("INSERT INTO product_events"));
    expect(insert?.arguments).toContain("decision_made");
    expect(insert?.arguments).not.toContain(sessionId);
    expect(String(insert?.arguments[0])).toMatch(/^[0-9a-f]{64}$/);

    const invalid = await app.request(
      "/api/events",
      {
        body: JSON.stringify({ appCount: 3, name: "game_selected_413150", sessionId }),
        headers: sameOrigin,
        method: "POST",
      },
      makeBindings().bindings,
    );
    expect(invalid.status).toBe(400);
  });

  it("documents retention, Steam independence, no review text, and no cookies", async () => {
    const response = await app.request("/privacy", undefined, makeBindings().bindings);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("レビュー本文");
    expect(html).toContain("Cookieは使いません");
    expect(html).toContain("35日以内");
    expect(html).toContain("承認・提携サービスではありません");
  });

  it("serves HTML for missing pages, JSON for missing APIs, and a safe health response", async () => {
    const bindings = makeBindings().bindings;
    const page = await app.request("/missing", undefined, bindings);
    const api = await app.request("/api/missing", undefined, bindings);
    const health = await app.request("/healthz", undefined, bindings);
    expect(page.status).toBe(404);
    expect(await page.text()).toContain("ページが見つかりません");
    expect(api.status).toBe(404);
    expect(await api.json()).toEqual(expect.objectContaining({ error: "not_found" }));
    expect(await health.json()).toEqual(
      expect.objectContaining({ healthy: true, service: "tsumi-erabi" }),
    );
  });
});
