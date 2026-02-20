-- Remove stock Unsplash image fallbacks from database functions
-- These should return NULL instead of stock photos

-- Update get_track_appearances function
CREATE OR REPLACE FUNCTION get_track_appearances(
  p_track_title TEXT,
  p_artist_name TEXT,
  p_exclude_set_id UUID DEFAULT NULL
)
RETURNS TABLE (
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
    COALESCE(s.cover_url, NULL) as cover_url,
    s.tracklist_url
  FROM set_tracks st
  JOIN sets s ON st.set_id = s.id
  WHERE
    LOWER(st.track_title) = LOWER(p_track_title)
    AND LOWER(st.artist_name) ILIKE '%' || LOWER(SPLIT_PART(p_artist_name, '&', 1)) || '%'
    AND (p_exclude_set_id IS NULL OR s.id != p_exclude_set_id)
  ORDER BY s.event_date DESC NULLS LAST
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Update find_similar_tracks function
CREATE OR REPLACE FUNCTION find_similar_tracks(
  p_track_title TEXT,
  p_artist_name TEXT,
  p_exclude_set_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
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
    COALESCE(s.cover_url, NULL) as cover_url,
    s.tracklist_url,
    (
      CASE WHEN LOWER(st.track_title) = LOWER(p_track_title) THEN 1.0 ELSE 0.5 END +
      CASE WHEN LOWER(st.artist_name) ILIKE '%' || LOWER(p_artist_name) || '%' THEN 0.5 ELSE 0 END
    )::FLOAT as match_score
  FROM set_tracks st
  JOIN sets s ON st.set_id = s.id
  WHERE
    (
      LOWER(st.track_title) = LOWER(p_track_title)
      OR similarity(LOWER(st.track_title), LOWER(p_track_title)) > 0.4
    )
    AND (
      LOWER(st.artist_name) ILIKE '%' || LOWER(SPLIT_PART(p_artist_name, '&', 1)) || '%'
      OR similarity(LOWER(st.artist_name), LOWER(p_artist_name)) > 0.3
    )
    AND (p_exclude_set_id IS NULL OR s.id != p_exclude_set_id)
  ORDER BY match_score DESC, s.event_date DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
