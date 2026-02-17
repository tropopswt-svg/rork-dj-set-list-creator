-- Migration: Track Appearances - Find all sets a track appears in
-- Enables the "Featured In X Sets" functionality

-- ============================================
-- INDEX FOR FAST TRACK LOOKUPS
-- ============================================

-- Index for finding tracks by normalized title + artist
CREATE INDEX IF NOT EXISTS idx_set_tracks_artist_title
ON set_tracks (LOWER(artist_name), LOWER(track_title));

-- Index for the tracks table to match against
CREATE INDEX IF NOT EXISTS idx_tracks_artist_title_normalized
ON tracks (LOWER(artist_name), title_normalized);

-- ============================================
-- FIND ALL SETS A TRACK APPEARS IN
-- ============================================

-- Function to find all sets where a specific track (by title and artist) appears
CREATE OR REPLACE FUNCTION get_track_appearances(
  p_track_title TEXT,
  p_artist_name TEXT,
  p_exclude_set_id UUID DEFAULT NULL
)
RETURNS TABLE(
  set_id UUID,
  set_title TEXT,
  dj_name TEXT,
  venue TEXT,
  event_date DATE,
  position INTEGER,
  timestamp_seconds INTEGER,
  cover_url TEXT,
  tracklist_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as set_id,
    s.title as set_title,
    s.dj_name,
    s.venue,
    s.event_date,
    st.position,
    st.timestamp_seconds,
    COALESCE(
      (SELECT youtube_url FROM sets WHERE id = s.id),
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop'
    ) as cover_url,
    s.tracklist_url
  FROM set_tracks st
  JOIN sets s ON st.set_id = s.id
  WHERE
    -- Match by normalized title and artist (case insensitive)
    LOWER(st.track_title) = LOWER(p_track_title)
    AND LOWER(st.artist_name) ILIKE '%' || LOWER(SPLIT_PART(p_artist_name, '&', 1)) || '%'
    -- Exclude the current set if provided
    AND (p_exclude_set_id IS NULL OR s.id != p_exclude_set_id)
  ORDER BY s.event_date DESC NULLS LAST
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FIND TRACKS BY FUZZY MATCH
-- ============================================

-- Function to find track appearances with fuzzy matching
-- Useful when track titles might have slight variations
CREATE OR REPLACE FUNCTION get_track_appearances_fuzzy(
  p_track_title TEXT,
  p_artist_name TEXT,
  p_exclude_set_id UUID DEFAULT NULL
)
RETURNS TABLE(
  set_id UUID,
  set_title TEXT,
  dj_name TEXT,
  venue TEXT,
  event_date DATE,
  position INTEGER,
  timestamp_seconds INTEGER,
  cover_url TEXT,
  tracklist_url TEXT,
  match_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as set_id,
    s.title as set_title,
    s.dj_name,
    s.venue,
    s.event_date,
    st.position,
    st.timestamp_seconds,
    COALESCE(s.youtube_url, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop') as cover_url,
    s.tracklist_url,
    -- Simple similarity score based on matching
    (
      CASE WHEN LOWER(st.track_title) = LOWER(p_track_title) THEN 1.0 ELSE 0.5 END +
      CASE WHEN LOWER(st.artist_name) ILIKE '%' || LOWER(p_artist_name) || '%' THEN 0.5 ELSE 0 END
    )::FLOAT as match_score
  FROM set_tracks st
  JOIN sets s ON st.set_id = s.id
  WHERE
    -- Fuzzy match on title (contains)
    (
      LOWER(st.track_title) ILIKE '%' || LOWER(p_track_title) || '%'
      OR LOWER(p_track_title) ILIKE '%' || LOWER(st.track_title) || '%'
    )
    -- Match artist (partial)
    AND LOWER(st.artist_name) ILIKE '%' || LOWER(SPLIT_PART(p_artist_name, ' ', 1)) || '%'
    -- Exclude current set
    AND (p_exclude_set_id IS NULL OR s.id != p_exclude_set_id)
  ORDER BY match_score DESC, s.event_date DESC NULLS LAST
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GET TRACK PLAY COUNT
-- ============================================

-- Function to count how many sets a track appears in
CREATE OR REPLACE FUNCTION get_track_play_count(
  p_track_title TEXT,
  p_artist_name TEXT
)
RETURNS INTEGER AS $$
DECLARE
  play_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT st.set_id) INTO play_count
  FROM set_tracks st
  WHERE
    LOWER(st.track_title) = LOWER(p_track_title)
    AND LOWER(st.artist_name) ILIKE '%' || LOWER(SPLIT_PART(p_artist_name, '&', 1)) || '%';

  RETURN play_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- POPULAR TRACKS VIEW
-- ============================================

-- View to see most played tracks across all sets
CREATE OR REPLACE VIEW popular_tracks AS
SELECT
  st.artist_name,
  st.track_title,
  COUNT(DISTINCT st.set_id) as times_played,
  ARRAY_AGG(DISTINCT s.dj_name) as played_by_djs
FROM set_tracks st
JOIN sets s ON st.set_id = s.id
WHERE st.track_title IS NOT NULL
  AND st.artist_name IS NOT NULL
  AND LOWER(st.track_title) != 'id'
  AND LOWER(st.artist_name) != 'id'
GROUP BY st.artist_name, st.track_title
HAVING COUNT(DISTINCT st.set_id) > 1
ORDER BY times_played DESC;
