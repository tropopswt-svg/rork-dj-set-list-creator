-- Apple Music cache tables and rate-limit tracking
-- Mirrors 014_spotify_cache.sql pattern

-- ========== Track Cache ==========
CREATE TABLE IF NOT EXISTS applemusic_track_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_key TEXT NOT NULL UNIQUE,  -- normalized "artist|||title" (same format as spotify_track_cache)
  artist_name TEXT NOT NULL,
  track_title TEXT NOT NULL,
  found BOOLEAN NOT NULL DEFAULT FALSE,
  applemusic_data JSONB DEFAULT NULL,   -- full Apple Music response when found
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for batch lookups
CREATE INDEX IF NOT EXISTS idx_applemusic_track_cache_lookup
ON applemusic_track_cache (lookup_key);

-- Auto-expire not-found entries after 30 days so we retry them
CREATE INDEX IF NOT EXISTS idx_applemusic_track_cache_not_found_ttl
ON applemusic_track_cache (updated_at)
WHERE found = FALSE;

-- ========== Rate Limit Tracking ==========
-- Singleton row tracking API request budget
CREATE TABLE IF NOT EXISTS applemusic_rate_limit (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- enforce singleton
  requests_this_window INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ DEFAULT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert the singleton row
INSERT INTO applemusic_rate_limit (id, requests_this_window, window_start)
VALUES (1, 0, now())
ON CONFLICT (id) DO NOTHING;

-- ========== Atomic request counter function ==========
-- Resets the window if >60s have passed, then increments counter
-- Budget: 100 requests per minute (conservative for Apple Music's generous limits)
CREATE OR REPLACE FUNCTION increment_applemusic_requests()
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, is_locked BOOLEAN) AS $$
DECLARE
  v_locked_until TIMESTAMPTZ;
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  -- Get current state
  SELECT rl.locked_until, rl.window_start, rl.requests_this_window
  INTO v_locked_until, v_window_start, v_count
  FROM applemusic_rate_limit rl
  WHERE rl.id = 1
  FOR UPDATE;

  -- Check hard lockout
  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN QUERY SELECT FALSE, v_count, TRUE;
    RETURN;
  END IF;

  -- Clear expired lockout
  IF v_locked_until IS NOT NULL AND v_locked_until <= now() THEN
    UPDATE applemusic_rate_limit SET locked_until = NULL WHERE applemusic_rate_limit.id = 1;
    v_locked_until := NULL;
  END IF;

  -- Reset window if >60 seconds have passed
  IF v_window_start + INTERVAL '60 seconds' < now() THEN
    UPDATE applemusic_rate_limit
    SET requests_this_window = 1,
        window_start = now(),
        updated_at = now()
    WHERE applemusic_rate_limit.id = 1;
    RETURN QUERY SELECT TRUE, 1, FALSE;
    RETURN;
  END IF;

  -- Check budget (max 100 per minute)
  IF v_count >= 100 THEN
    RETURN QUERY SELECT FALSE, v_count, FALSE;
    RETURN;
  END IF;

  -- Increment
  UPDATE applemusic_rate_limit
  SET requests_this_window = requests_this_window + 1,
      updated_at = now()
  WHERE applemusic_rate_limit.id = 1;

  RETURN QUERY SELECT TRUE, v_count + 1, FALSE;
END;
$$ LANGUAGE plpgsql;

-- ========== Row Level Security ==========
ALTER TABLE applemusic_track_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE applemusic_rate_limit ENABLE ROW LEVEL SECURITY;

-- Service role (used by API endpoints) gets full access
CREATE POLICY "Service role full access on applemusic track cache"
  ON applemusic_track_cache FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on applemusic rate limit"
  ON applemusic_rate_limit FOR ALL
  USING (true) WITH CHECK (true);
