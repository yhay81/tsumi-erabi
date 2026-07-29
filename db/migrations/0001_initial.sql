CREATE TABLE IF NOT EXISTS game_cache (
  app_id INTEGER PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS game_cache_fetched_at_idx
ON game_cache (fetched_at);

CREATE TABLE IF NOT EXISTS product_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_hash TEXT NOT NULL,
  name TEXT NOT NULL CHECK (name IN ('visited', 'comparison_loaded', 'decision_made', 'steam_opened')),
  app_count INTEGER NOT NULL DEFAULT 0 CHECK (app_count BETWEEN 0 AND 6),
  is_automated INTEGER NOT NULL DEFAULT 0 CHECK (is_automated IN (0, 1)),
  occurred_on TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS product_events_session_idx
ON product_events (session_hash, created_at);

CREATE INDEX IF NOT EXISTS product_events_name_idx
ON product_events (name, occurred_on);

CREATE TABLE IF NOT EXISTS request_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS request_limits_expires_at_idx
ON request_limits (expires_at);
