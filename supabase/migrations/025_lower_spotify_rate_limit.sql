-- Lower Spotify rate-limit budget from 15/min to 8/min
-- Two-pass search (spotify-core.js) makes up to 2 real API calls per track,
-- so the old 15/min budget allowed up to 30 actual Spotify calls/min — enough to trigger 429s.
-- 8 DB slots × 2 real calls = 16 actual Spotify calls/min, well within Spotify's limits.

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

  -- Check budget (max 8 per minute — accounts for two-pass search making 2 real API calls per track)
  IF v_count >= 8 THEN
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
