-- Add unreleased tracking columns to set_tracks
ALTER TABLE set_tracks ADD COLUMN IF NOT EXISTS is_unreleased BOOLEAN DEFAULT FALSE;
ALTER TABLE set_tracks ADD COLUMN IF NOT EXISTS unreleased_source TEXT DEFAULT NULL;
-- unreleased_source values: 'comment_hint', 'spotify_not_found', 'manual'

-- ============================================================
-- TRIGGER: Auto-clean unreleased indicators from track_title
-- on every INSERT and UPDATE. This is the safety net that
-- guarantees clean titles regardless of which API writes them.
-- ============================================================

CREATE OR REPLACE FUNCTION clean_unreleased_from_title()
RETURNS TRIGGER AS $$
DECLARE
  original_title TEXT;
  cleaned TEXT;
  has_indicator BOOLEAN;
BEGIN
  original_title := NEW.track_title;
  IF original_title IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if title contains any unreleased indicators
  has_indicator := original_title ~* '\bunreleased\b'
    OR original_title ~* '\bforthcoming\b'
    OR original_title ~* '\(dub\s*\??\)'
    OR original_title ~* '\bdubplate\b'
    OR original_title ~* '\bwhite\s*label\b'
    OR original_title ~* '\(VIP\)';

  IF NOT has_indicator THEN
    RETURN NEW;
  END IF;

  -- Flag as unreleased (only if not already set by Spotify enrichment)
  IF NEW.unreleased_source IS NULL OR NEW.unreleased_source = '' THEN
    NEW.is_unreleased := true;
    NEW.unreleased_source := 'comment_hint';
  END IF;

  -- Strip indicators from title
  cleaned := original_title;
  cleaned := REGEXP_REPLACE(cleaned, '\s*\(?\s*unreleased\s*\??\s*\)?\s*', ' ', 'gi');
  cleaned := REGEXP_REPLACE(cleaned, '\s*\(?\s*forthcoming\s*\)?\s*', ' ', 'gi');
  cleaned := REGEXP_REPLACE(cleaned, '\s*\(\s*dub\s*\??\s*\)\s*', ' ', 'gi');
  cleaned := REGEXP_REPLACE(cleaned, '\s*\(?\s*dubplate\s*\)?\s*', ' ', 'gi');
  cleaned := REGEXP_REPLACE(cleaned, '\s*\(?\s*white\s*label\s*\)?\s*', ' ', 'gi');
  cleaned := REGEXP_REPLACE(cleaned, '\s*\(\s*VIP\s*\)\s*', ' ', 'gi');
  -- Collapse whitespace
  cleaned := REGEXP_REPLACE(cleaned, '\s+', ' ', 'g');
  cleaned := TRIM(cleaned);
  -- Remove trailing/leading broken parens
  cleaned := REGEXP_REPLACE(cleaned, '\(\s*$', '', 'g');
  cleaned := REGEXP_REPLACE(cleaned, '^\s*\)', '', 'g');
  cleaned := TRIM(cleaned);

  NEW.track_title := cleaned;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clean_unreleased_title ON set_tracks;
CREATE TRIGGER trg_clean_unreleased_title
  BEFORE INSERT OR UPDATE OF track_title ON set_tracks
  FOR EACH ROW
  EXECUTE FUNCTION clean_unreleased_from_title();

-- ============================================================
-- RETROACTIVE SCAN: Flag unreleased tracks
-- ============================================================

-- 1) Spotify checked but not found -> unreleased
UPDATE set_tracks
SET is_unreleased = true, unreleased_source = 'spotify_not_found'
WHERE spotify_data IS NOT NULL
  AND (spotify_data->>'found')::text = 'false'
  AND is_id = false
  AND track_title IS NOT NULL AND track_title != 'ID';

-- 2) Title contains unreleased indicators -> flag and set source
--    (The trigger will also clean the title text on the next UPDATE)
UPDATE set_tracks
SET is_unreleased = true,
    unreleased_source = COALESCE(unreleased_source, 'comment_hint')
WHERE is_unreleased = false
  AND track_title IS NOT NULL
  AND (
    track_title ~* '\bunreleased\b'
    OR track_title ~* '\bforthcoming\b'
    OR track_title ~* '\bdubplate\b'
    OR track_title ~* '\bwhite\s*label\b'
  );

-- ============================================================
-- CLEAN INDICATOR TEXT FROM EXISTING TITLES (set_tracks)
-- We do a no-op title update to fire the trigger on dirty rows
-- ============================================================

UPDATE set_tracks
SET track_title = track_title
WHERE track_title ~* 'unreleased|forthcoming|dubplate|white\s*label|\(dub\)|\(VIP\)';

-- Clean trailing broken parens that might pre-date the trigger
UPDATE set_tracks
SET track_title = TRIM(REGEXP_REPLACE(track_title, '\(\s*$', '', 'g'))
WHERE track_title ~ '\(\s*$';

-- ============================================================
-- CLEAN INDICATOR TEXT FROM TITLES (tracks table too)
-- ============================================================

UPDATE tracks
SET title = TRIM(REGEXP_REPLACE(
  REGEXP_REPLACE(title, '\s*\(?\s*unreleased\s*\??\s*\)?\s*', ' ', 'gi'),
  '\s+', ' ', 'g'))
WHERE title ~* 'unreleased';

UPDATE tracks
SET title = TRIM(REGEXP_REPLACE(
  REGEXP_REPLACE(title, '\s*\(?\s*forthcoming\s*\)?\s*', ' ', 'gi'),
  '\s+', ' ', 'g'))
WHERE title ~* 'forthcoming';

UPDATE tracks
SET title = TRIM(REGEXP_REPLACE(
  REGEXP_REPLACE(title, '\s*\(?\s*dubplate\s*\)?\s*', ' ', 'gi'),
  '\s+', ' ', 'g'))
WHERE title ~* 'dubplate';

UPDATE tracks
SET title = TRIM(REGEXP_REPLACE(
  REGEXP_REPLACE(title, '\s*\(?\s*white\s*label\s*\)?\s*', ' ', 'gi'),
  '\s+', ' ', 'g'))
WHERE title ~* 'white\s*label';

UPDATE tracks
SET title = TRIM(REGEXP_REPLACE(title, '\(\s*$', '', 'g'))
WHERE title ~ '\(\s*$';

-- Flag is_unreleased on the tracks table where title had an indicator
UPDATE tracks
SET is_unreleased = true
WHERE is_unreleased = false
  AND title IS NOT NULL
  AND (
    title ~* '\bunreleased\b'
    OR title ~* '\bforthcoming\b'
    OR title ~* '\bdubplate\b'
    OR title ~* '\bwhite\s*label\b'
  );

-- Flag tracks as unreleased if their set_tracks appearances are all unreleased
-- and none have a confirmed Spotify match
UPDATE tracks t
SET is_unreleased = true
WHERE t.is_unreleased = false
  AND EXISTS (
    SELECT 1 FROM set_tracks st
    WHERE st.track_id = t.id AND st.is_unreleased = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM set_tracks st
    WHERE st.track_id = t.id AND st.is_unreleased = false
      AND st.spotify_data IS NOT NULL
      AND (st.spotify_data->>'spotify_id') IS NOT NULL
  );
