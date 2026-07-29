import { Hono } from "hono";
import { requestId } from "hono/request-id";

import { securityHeaders } from "./middleware/security";
import { fetchSteamGame, parseCandidateInputs, SteamLookupError } from "./steam";
import { HomePage, NotFoundPage, PrivacyPage } from "./ui/pages";

export type Bindings = {
  ASSETS: Fetcher;
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();
const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const eventNames = new Set(["visited", "decision_made", "steam_opened"]);
const daySeconds = 86_400;

app.use("*", requestId());
app.use("*", securityHeaders);

const nowSeconds = () => Math.floor(Date.now() / 1000);

const normalize = (value: unknown, maximum: number) =>
  typeof value === "string" ? value.normalize("NFKC").trim().slice(0, maximum) : "";

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const isSameOriginMutation = (request: Request) => {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
};

const isJsonRequest = (request: Request) =>
  request.headers.get("content-type")?.toLowerCase().startsWith("application/json") ?? false;

const noStore = async (response: Response | Promise<Response>) => {
  const resolved = await response;
  resolved.headers.set("Cache-Control", "no-store, private");
  return resolved;
};

const recordEvent = async (
  db: D1Database,
  sessionId: string,
  name: string,
  appCount: number,
  automated: boolean,
) => {
  const sessionHash = await sha256(sessionId);
  const timestamp = nowSeconds();
  const daily = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM product_events WHERE session_hash = ? AND created_at >= ?",
    )
    .bind(sessionHash, timestamp - daySeconds)
    .first<{ count: number }>();
  if ((daily?.count ?? 0) >= 200) return false;
  await db
    .prepare(
      `INSERT INTO product_events
       (session_hash, name, app_count, is_automated, occurred_on, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      sessionHash,
      name,
      appCount,
      automated ? 1 : 0,
      new Date().toISOString().slice(0, 10),
      timestamp,
    )
    .run();
  return true;
};

const withinNetworkLimit = async (db: D1Database, request: Request) => {
  const address =
    request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "local";
  const bucket = Math.floor(nowSeconds() / 600);
  const key = await sha256(`${address}:${bucket}`);
  const current = await db
    .prepare("SELECT count FROM request_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number }>();
  if ((current?.count ?? 0) >= 30) return false;
  await db
    .prepare(
      `INSERT INTO request_limits (key, count, expires_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET count = count + 1`,
    )
    .bind(key, nowSeconds() + 1_200)
    .run();
  return true;
};

app.get("/", (c) => c.html(<HomePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));

app.post("/api/compare", async (c) => {
  if (!isSameOriginMutation(c.req.raw)) return c.json({ error: "forbidden" }, 403);
  if (!isJsonRequest(c.req.raw)) return c.json({ error: "unsupported_media_type" }, 415);
  if (Number(c.req.header("content-length") ?? 0) > 8_000) {
    return c.json({ error: "payload_too_large" }, 413);
  }
  if (!(await withinNetworkLimit(c.env.DB, c.req.raw))) {
    return noStore(c.json({ error: "rate_limited" }, 429));
  }

  const body = await c.req.json<{
    automated?: boolean;
    candidates?: unknown[];
    sessionId?: string;
  }>();
  const sessionId = normalize(body.sessionId, 36);
  const appIds = parseCandidateInputs(body.candidates);
  if (!sessionIdPattern.test(sessionId) || appIds.length < 2) {
    return noStore(c.json({ error: "invalid_candidates" }, 400));
  }

  const settled = await Promise.allSettled(
    appIds.map(async (appId) => ({ appId, game: await fetchSteamGame(c.env.DB, appId) })),
  );
  const games = settled
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<{
        appId: number;
        game: Awaited<ReturnType<typeof fetchSteamGame>>;
      }> => result.status === "fulfilled",
    )
    .map((result) => result.value.game);
  const unavailable = settled.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          {
            appId: appIds[index],
            error:
              result.reason instanceof SteamLookupError ? result.reason.code : "upstream_error",
          },
        ]
      : [],
  );

  if (games.length < 2) {
    return noStore(c.json({ error: "not_enough_games", unavailable }, 422));
  }
  await recordEvent(
    c.env.DB,
    sessionId,
    "comparison_loaded",
    games.length,
    body.automated === true,
  );
  return noStore(
    c.json({
      fetchedAt: new Date().toISOString(),
      games,
      unavailable,
    }),
  );
});

app.post("/api/events", async (c) => {
  if (!isSameOriginMutation(c.req.raw)) return c.json({ error: "forbidden" }, 403);
  if (!isJsonRequest(c.req.raw)) return c.json({ error: "unsupported_media_type" }, 415);
  const body = await c.req.json<{
    appCount?: number;
    automated?: boolean;
    name?: string;
    sessionId?: string;
  }>();
  const sessionId = normalize(body.sessionId, 36);
  const name = normalize(body.name, 40);
  const appCount = Number(body.appCount);
  if (
    !sessionIdPattern.test(sessionId) ||
    !eventNames.has(name) ||
    !Number.isInteger(appCount) ||
    appCount < 0 ||
    appCount > 6
  ) {
    return c.json({ error: "invalid_event" }, 400);
  }
  const accepted = await recordEvent(c.env.DB, sessionId, name, appCount, body.automated === true);
  return accepted ? c.body(null, 204) : c.json({ error: "rate_limited" }, 429);
});

app.get("/healthz", (c) =>
  c.json({
    healthy: true,
    service: "tsumi-erabi",
    time: new Date().toISOString(),
  }),
);

app.notFound((c) =>
  c.req.path.startsWith("/api/")
    ? c.json({ error: "not_found", requestId: c.get("requestId") }, 404)
    : c.html(<NotFoundPage />, 404),
);

app.onError((error, c) => {
  console.error(
    JSON.stringify({
      event: "request_failed",
      message: error.message,
      requestId: c.get("requestId"),
    }),
  );

  return c.json(
    {
      error: "internal_error",
      requestId: c.get("requestId"),
    },
    500,
  );
});

const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (_controller, env) => {
  const now = nowSeconds();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM request_limits WHERE expires_at < ?").bind(now),
    env.DB.prepare("DELETE FROM game_cache WHERE fetched_at < ?").bind(now - 7 * daySeconds),
    env.DB.prepare("DELETE FROM product_events WHERE created_at < ?").bind(now - 35 * daySeconds),
  ]);
};

export { app };
export default { fetch: app.fetch, scheduled };
