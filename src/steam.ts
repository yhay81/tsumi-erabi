export type SteamGame = {
  appId: number;
  discountPercent: number;
  genres: string[];
  headerImage: string;
  isFree: boolean;
  japanese: boolean;
  name: string;
  platforms: string[];
  price: string;
  priceBefore: string;
  releaseDate: string;
  review: {
    description: string;
    positive: number;
    positivePercent: number | null;
    recentPositive: number;
    recentPositivePercent: number | null;
    recentSample: number;
    total: number;
  };
  steamUrl: string;
};

type CacheRow = {
  fetched_at: number;
  payload: string;
};

type AppDetailsData = {
  genres?: Array<{ description?: string }>;
  header_image?: string;
  is_free?: boolean;
  name?: string;
  platforms?: Record<string, boolean>;
  price_overview?: {
    discount_percent?: number;
    final_formatted?: string;
    initial_formatted?: string;
  };
  release_date?: {
    coming_soon?: boolean;
    date?: string;
  };
  supported_languages?: string;
  type?: string;
};

type ReviewResponse = {
  query_summary?: {
    review_score_desc?: string;
    total_negative?: number;
    total_positive?: number;
    total_reviews?: number;
  };
  reviews?: Array<{
    timestamp_created?: number;
    voted_up?: boolean;
  }>;
  success?: number;
};

const cacheSeconds = 6 * 60 * 60;
const allowedImageHosts = new Set([
  "cdn.akamai.steamstatic.com",
  "shared.akamai.steamstatic.com",
  "shared.fastly.steamstatic.com",
]);

export class SteamLookupError extends Error {
  constructor(
    public readonly code: "not_found" | "upstream_error",
    message: string,
  ) {
    super(message);
  }
}

export function extractAppId(value: string) {
  const normalized = value.normalize("NFKC").trim();
  if (/^\d{1,10}$/.test(normalized)) return Number(normalized);
  try {
    const url = new URL(normalized);
    if (!["store.steampowered.com", "www.store.steampowered.com"].includes(url.hostname)) {
      return null;
    }
    const match = url.pathname.match(/^\/app\/(\d{1,10})(?:\/|$)/);
    return match?.[1] ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

export function parseCandidateInputs(values: unknown) {
  if (!Array.isArray(values)) return [];
  const appIds = values
    .filter((value): value is string => typeof value === "string")
    .map(extractAppId)
    .filter((value): value is number => value !== null && Number.isSafeInteger(value) && value > 0);
  return [...new Set(appIds)].slice(0, 6);
}

const safeImageUrl = (value: string | undefined, appId: number) => {
  try {
    if (!value) throw new Error("missing");
    const url = new URL(value);
    if (url.protocol !== "https:" || !allowedImageHosts.has(url.hostname)) {
      throw new Error("invalid");
    }
    return url.toString();
  } catch {
    return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
  }
};

const integer = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;

const percent = (positive: number, total: number) =>
  total > 0 ? Math.round((positive / total) * 100) : null;

const japaneseReviewLabel = (value: string | undefined, total: number) => {
  if (total === 0) return "日本語レビューなし";
  const labels: Record<string, string> = {
    "Overwhelmingly Positive": "圧倒的に好評",
    "Very Positive": "非常に好評",
    Positive: "好評",
    "Mostly Positive": "やや好評",
    Mixed: "賛否両論",
    "Mostly Negative": "やや不評",
    Negative: "不評",
    "Very Negative": "非常に不評",
    "Overwhelmingly Negative": "圧倒的に不評",
  };
  return (value && labels[value]) || "評価あり";
};

export function shapeSteamGame(
  appId: number,
  details: AppDetailsData,
  reviews: ReviewResponse,
): SteamGame {
  const name = details.name?.trim();
  if (!name || (details.type && !["game", "dlc", "demo"].includes(details.type))) {
    throw new SteamLookupError("not_found", "Steamの商品ページを確認できませんでした。");
  }

  const total = integer(reviews.query_summary?.total_reviews);
  const positive = integer(reviews.query_summary?.total_positive);
  const recent = (reviews.reviews ?? []).slice(0, 100);
  const recentPositive = recent.filter((review) => review.voted_up === true).length;
  const platformLabels = [
    ["windows", "Windows"],
    ["mac", "macOS"],
    ["linux", "Linux"],
  ] as const;
  const platforms = platformLabels
    .filter(([platform]) => details.platforms?.[platform])
    .map(([, label]) => label);
  const supportedLanguages = (details.supported_languages ?? "").replace(/<[^>]+>/g, "");
  const price = details.price_overview;
  const isFree = details.is_free === true;

  return {
    appId,
    discountPercent: integer(price?.discount_percent),
    genres: (details.genres ?? [])
      .map((genre) => genre.description?.trim())
      .filter((genre): genre is string => Boolean(genre))
      .slice(0, 3),
    headerImage: safeImageUrl(details.header_image, appId),
    isFree,
    japanese: /日本語|Japanese/i.test(supportedLanguages),
    name,
    platforms,
    price: isFree ? "無料" : price?.final_formatted?.trim() || "価格はSteamで確認",
    priceBefore:
      !isFree && integer(price?.discount_percent) > 0 ? price?.initial_formatted?.trim() || "" : "",
    releaseDate: details.release_date?.coming_soon
      ? "近日登場"
      : details.release_date?.date?.trim() || "発売日未掲載",
    review: {
      description: japaneseReviewLabel(reviews.query_summary?.review_score_desc, total),
      positive,
      positivePercent: percent(positive, total),
      recentPositive,
      recentPositivePercent: percent(recentPositive, recent.length),
      recentSample: recent.length,
      total,
    },
    steamUrl: `https://store.steampowered.com/app/${appId}/?l=japanese`,
  };
}

const fetchJson = async <T>(url: string, fetcher: typeof fetch) => {
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new SteamLookupError("upstream_error", "Steamへ接続できませんでした。");
  return response.json<T>();
};

export async function fetchSteamGame(
  db: D1Database,
  appId: number,
  fetcher: typeof fetch = fetch,
  now = Math.floor(Date.now() / 1000),
) {
  const cached = await db
    .prepare("SELECT payload, fetched_at FROM game_cache WHERE app_id = ?")
    .bind(appId)
    .first<CacheRow>();
  if (cached && cached.fetched_at >= now - cacheSeconds) {
    try {
      return JSON.parse(cached.payload) as SteamGame;
    } catch {
      // A malformed cache entry is replaced by the live response below.
    }
  }

  const [detailPayload, reviewPayload] = await Promise.all([
    fetchJson<Record<string, { data?: AppDetailsData; success?: boolean }>>(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=jp&l=japanese`,
      fetcher,
    ),
    fetchJson<ReviewResponse>(
      `https://store.steampowered.com/appreviews/${appId}?json=1&language=japanese&filter=recent&num_per_page=100&purchase_type=all&filter_offtopic_activity=1`,
      fetcher,
    ),
  ]);

  const details = detailPayload[String(appId)];
  if (!details?.success || !details.data || reviewPayload.success !== 1) {
    throw new SteamLookupError("not_found", "Steamの商品ページを確認できませんでした。");
  }
  const game = shapeSteamGame(appId, details.data, reviewPayload);
  await db
    .prepare(
      `INSERT INTO game_cache (app_id, payload, fetched_at)
       VALUES (?, ?, ?)
       ON CONFLICT(app_id) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    )
    .bind(appId, JSON.stringify(game), now)
    .run();
  return game;
}
