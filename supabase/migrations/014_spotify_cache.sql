-- Global Spotify cache tables and rate-limit tracking
-- Prevents duplicate API calls for the same track/artist across all sets

-- ========== Track Cache ==========
CREATE TABLE IF NOT EXISTS spotify_track_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_key TEXT NOT NULL UNIQUE,  -- normalized "artist|||title"
  artist_name TEXT NOT NULL,
  track_title TEXT NOT NULL,
  found BOOLEAN NOT NULL DEFAULT FALSE,
  spotify_data JSONB DEFAULT NULL,   -- full Spotify response when found
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for batch lookups
CREATE INDEX IF NOT EXISTS idx_spotify_track_cache_lookup
ON spotify_track_cache (lookup_key);

-- Auto-expire not-found entries after 30 days so we retry them
CREATE INDEX IF NOT EXISTS idx_spotify_track_cache_not_found_ttl
ON spotify_track_cache (updated_at)
WHERE found = FALSE;

-- ========== Artist Cache ==========
CREATE TABLE IF NOT EXISTS spotify_artist_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_key TEXT NOT NULL UNIQUE,  -- normalized artist name
  artist_name TEXT NOT NULL,
  found BOOLEAN NOT NULL DEFAULT FALSE,
  spotify_data JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spotify_artist_cache_lookup
ON spotify_artist_cache (lookup_key);

-- ========== Rate Limit Tracking ==========
-- Singleton row tracking API request budget
CREATE TABLE IF NOT EXISTS spotify_rate_limit (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- enforce singleton
  requests_this_window INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ DEFAULT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert the singleton row
INSERT INTO spotify_rate_limit (id, requests_this_window, window_start)
VALUES (1, 0, now())
ON CONFLICT (id) DO NOTHING;

-- ========== Atomic request counter function ==========
-- Resets the window if >60s have passed, then increments counter
CREATE OR REPLACE FUNCTION increment_spotify_requests()
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, is_locked BOOLEAN) AS $$
DECLARE
  v_locked_until TIMESTAMPTZ;
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  -- Get current state
  SELECT rl.locked_until, rl.window_start, rl.requests_this_window
  INTO v_locked_until, v_window_start, v_count
  FROM spotify_rate_limit rl
  WHERE rl.id = 1
  FOR UPDATE;

  -- Check hard lockout
  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN QUERY SELECT FALSE, v_count, TRUE;
    RETURN;
  END IF;

  -- Clear expired lockout
  IF v_locked_until IS NOT NULL AND v_locked_until <= now() THEN
    UPDATE spotify_rate_limit SET locked_until = NULL WHERE spotify_rate_limit.id = 1;
    v_locked_until := NULL;
  END IF;

  -- Reset window if >60 seconds have passed
  IF v_window_start + INTERVAL '60 seconds' < now() THEN
    UPDATE spotify_rate_limit
    SET requests_this_window = 1,
        window_start = now(),
        updated_at = now()
    WHERE spotify_rate_limit.id = 1;
    RETURN QUERY SELECT TRUE, 1, FALSE;
    RETURN;
  END IF;

  -- Check budget (max 30 per minute)
  IF v_count >= 30 THEN
    RETURN QUERY SELECT FALSE, v_count, FALSE;
    RETURN;
  END IF;

  -- Increment
  UPDATE spotify_rate_limit
  SET requests_this_window = requests_this_window + 1,
      updated_at = now()
  WHERE spotify_rate_limit.id = 1;

  RETURN QUERY SELECT TRUE, v_count + 1, FALSE;
END;
$$ LANGUAGE plpgsql;

-- ========== Row Level Security ==========
ALTER TABLE spotify_track_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE spotify_artist_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE spotify_rate_limit ENABLE ROW LEVEL SECURITY;

-- Service role (used by API endpoints) gets full access
CREATE POLICY "Service role full access on track cache"
  ON spotify_track_cache FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on artist cache"
  ON spotify_artist_cache FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on rate limit"
  ON spotify_rate_limit FOR ALL
  USING (true) WITH CHECK (true);
