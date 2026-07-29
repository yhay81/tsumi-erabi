SELECT
  COUNT(DISTINCT CASE WHEN name = 'visited' THEN session_hash END) AS users,
  COUNT(DISTINCT CASE WHEN name = 'comparison_loaded' THEN session_hash END) AS comparers,
  COUNT(CASE WHEN name = 'comparison_loaded' THEN 1 END) AS comparisons,
  COUNT(DISTINCT CASE WHEN name = 'decision_made' THEN session_hash END) AS decision_makers,
  COUNT(CASE WHEN name = 'decision_made' THEN 1 END) AS decisions,
  COUNT(DISTINCT CASE WHEN name = 'steam_opened' THEN session_hash END) AS steam_visitors,
  COUNT(CASE WHEN name = 'steam_opened' THEN 1 END) AS steam_opens,
  COUNT(DISTINCT CASE WHEN name = 'visited' AND occurred_on >= date('now', '-6 days') THEN session_hash END) AS users_7d,
  COUNT(DISTINCT CASE WHEN name = 'comparison_loaded' AND occurred_on >= date('now', '-6 days') THEN session_hash END) AS comparers_7d,
  COUNT(DISTINCT CASE WHEN name = 'steam_opened' AND occurred_on >= date('now', '-6 days') THEN session_hash END) AS steam_visitors_7d,
  COUNT(DISTINCT CASE WHEN active_days >= 2 THEN session_hash END) AS returned_users,
  (SELECT COUNT(*) FROM game_cache) AS cached_games
FROM product_events
LEFT JOIN (
  SELECT session_hash, COUNT(DISTINCT occurred_on) AS active_days
  FROM product_events
  WHERE is_automated = 0
  GROUP BY session_hash
) active_sessions USING (session_hash)
WHERE is_automated = 0;
