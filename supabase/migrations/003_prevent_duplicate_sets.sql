-- Migration: Prevent duplicate sets
-- Adds composite unique constraints and utility functions

-- ============================================
-- UNIQUE CONSTRAINTS
-- ============================================

-- Unique constraint on DJ + Event + Date (the most reliable way to identify a set)
-- This prevents "Chris Stussy @ Boiler Room Edinburgh 2024-05-19" from being added twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_sets_unique_dj_event_date
ON sets (LOWER(dj_name), LOWER(event_name), event_date)
WHERE dj_name IS NOT NULL AND event_name IS NOT NULL AND event_date IS NOT NULL;

-- Make soundcloud_url unique if provided
ALTER TABLE sets DROP CONSTRAINT IF EXISTS sets_soundcloud_url_key;
ALTER TABLE sets ADD CONSTRAINT sets_soundcloud_url_key UNIQUE (soundcloud_url);

-- Make youtube_url unique if provided
ALTER TABLE sets DROP CONSTRAINT IF EXISTS sets_youtube_url_key;
ALTER TABLE sets ADD CONSTRAINT sets_youtube_url_key UNIQUE (youtube_url);

-- Make mixcloud_url unique if provided
ALTER TABLE sets DROP CONSTRAINT IF EXISTS sets_mixcloud_url_key;
ALTER TABLE sets ADD CONSTRAINT sets_mixcloud_url_key UNIQUE (mixcloud_url);

-- ============================================
-- DUPLICATE CHECK FUNCTION
-- ============================================

-- Function to check if a set already exists
-- Returns the existing set ID if found, NULL otherwise
CREATE OR REPLACE FUNCTION check_duplicate_set(
  p_dj_name TEXT,
  p_event_name TEXT,
  p_event_date DATE,
  p_tracklist_url TEXT DEFAULT NULL,
  p_soundcloud_url TEXT DEFAULT NULL,
  p_youtube_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  existing_id UUID;
BEGIN
  -- First check by tracklist URL (most reliable)
  IF p_tracklist_url IS NOT NULL THEN
    SELECT id INTO existing_id FROM sets WHERE tracklist_url = p_tracklist_url;
    IF existing_id IS NOT NULL THEN
      RETURN existing_id;
    END IF;
  END IF;

  -- Check by YouTube URL
  IF p_youtube_url IS NOT NULL THEN
    SELECT id INTO existing_id FROM sets WHERE youtube_url = p_youtube_url;
    IF existing_id IS NOT NULL THEN
      RETURN existing_id;
    END IF;
  END IF;

  -- Check by SoundCloud URL
  IF p_soundcloud_url IS NOT NULL THEN
    SELECT id INTO existing_id FROM sets WHERE soundcloud_url = p_soundcloud_url;
    IF existing_id IS NOT NULL THEN
      RETURN existing_id;
    END IF;
  END IF;

  -- Check by DJ + Event + Date combination
  IF p_dj_name IS NOT NULL AND p_event_name IS NOT NULL AND p_event_date IS NOT NULL THEN
    SELECT id INTO existing_id FROM sets
    WHERE LOWER(dj_name) = LOWER(p_dj_name)
      AND LOWER(event_name) = LOWER(p_event_name)
      AND event_date = p_event_date;
    IF existing_id IS NOT NULL THEN
      RETURN existing_id;
    END IF;
  END IF;

  -- Check by similar title (fuzzy match)
  IF p_dj_name IS NOT NULL AND p_event_date IS NOT NULL THEN
    SELECT id INTO existing_id FROM sets
    WHERE LOWER(dj_name) = LOWER(p_dj_name)
      AND event_date = p_event_date
    LIMIT 1;
    IF existing_id IS NOT NULL THEN
      RETURN existing_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPSERT FUNCTION FOR SETS
-- ============================================

-- Function to insert or update a set (prevents duplicates automatically)
CREATE OR REPLACE FUNCTION upsert_set(
  p_title TEXT,
  p_dj_name TEXT,
  p_venue TEXT DEFAULT NULL,
  p_event_name TEXT DEFAULT NULL,
  p_event_date DATE DEFAULT NULL,
  p_tracklist_url TEXT DEFAULT NULL,
  p_soundcloud_url TEXT DEFAULT NULL,
  p_youtube_url TEXT DEFAULT NULL,
  p_mixcloud_url TEXT DEFAULT NULL,
  p_genre TEXT DEFAULT NULL,
  p_duration_seconds INTEGER DEFAULT NULL
)
RETURNS TABLE(id UUID, is_new BOOLEAN) AS $$
DECLARE
  existing_id UUID;
  new_id UUID;
  slug_val TEXT;
BEGIN
  -- Check for existing set
  existing_id := check_duplicate_set(
    p_dj_name,
    p_event_name,
    p_event_date,
    p_tracklist_url,
    p_soundcloud_url,
    p_youtube_url
  );

  IF existing_id IS NOT NULL THEN
    -- Update existing set with any new information
    UPDATE sets SET
      title = COALESCE(p_title, sets.title),
      venue = COALESCE(p_venue, sets.venue),
      tracklist_url = COALESCE(p_tracklist_url, sets.tracklist_url),
      soundcloud_url = COALESCE(p_soundcloud_url, sets.soundcloud_url),
      youtube_url = COALESCE(p_youtube_url, sets.youtube_url),
      mixcloud_url = COALESCE(p_mixcloud_url, sets.mixcloud_url),
      genre = COALESCE(p_genre, sets.genre),
      duration_seconds = COALESCE(p_duration_seconds, sets.duration_seconds),
      updated_at = NOW()
    WHERE sets.id = existing_id;

    RETURN QUERY SELECT existing_id, FALSE;
  ELSE
    -- Generate slug
    slug_val := LOWER(REGEXP_REPLACE(
      REGEXP_REPLACE(p_title, '[^\w\s-]', '', 'g'),
      '\s+', '-', 'g'
    ));

    -- Insert new set
    INSERT INTO sets (
      title, slug, dj_name, venue, event_name, event_date,
      tracklist_url, soundcloud_url, youtube_url, mixcloud_url,
      genre, duration_seconds
    ) VALUES (
      p_title, slug_val, p_dj_name, p_venue, p_event_name, p_event_date,
      p_tracklist_url, p_soundcloud_url, p_youtube_url, p_mixcloud_url,
      p_genre, p_duration_seconds
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      updated_at = NOW()
    RETURNING sets.id INTO new_id;

    RETURN QUERY SELECT new_id, TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEARCH FOR SIMILAR SETS
-- ============================================

-- Function to find similar sets (for UI suggestions)
CREATE OR REPLACE FUNCTION find_similar_sets(
  p_dj_name TEXT,
  p_title TEXT DEFAULT NULL,
  p_event_date DATE DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  dj_name TEXT,
  event_name TEXT,
  event_date DATE,
  similarity_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.title,
    s.dj_name,
    s.event_name,
    s.event_date,
    (
      CASE WHEN LOWER(s.dj_name) = LOWER(p_dj_name) THEN 0.5 ELSE 0 END +
      CASE WHEN p_event_date IS NOT NULL AND s.event_date = p_event_date THEN 0.3 ELSE 0 END +
      CASE WHEN p_title IS NOT NULL AND s.title ILIKE '%' || p_title || '%' THEN 0.2 ELSE 0 END
    )::FLOAT as similarity_score
  FROM sets s
  WHERE
    LOWER(s.dj_name) = LOWER(p_dj_name)
    OR (p_title IS NOT NULL AND s.title ILIKE '%' || p_title || '%')
  ORDER BY similarity_score DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;
