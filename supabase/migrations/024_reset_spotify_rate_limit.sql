-- Reset Spotify rate limit for testing
-- Run this in Supabase SQL editor to unlock the rate limiter

UPDATE spotify_rate_limit
SET
  locked_until = NULL,
  requests_this_window = 0,
  window_start = now()
WHERE id = 1;

-- Verify
SELECT id, locked_until, requests_this_window, window_start FROM spotify_rate_limit;
