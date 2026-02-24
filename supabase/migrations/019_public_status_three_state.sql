-- Public status simplification (3-state model) + internal confidence fields
-- Public statuses are strictly: released | unreleased | id

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS public_status TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS internal_confidence NUMERIC(4,3);

ALTER TABLE set_tracks ADD COLUMN IF NOT EXISTS public_status TEXT;
ALTER TABLE set_tracks ADD COLUMN IF NOT EXISTS internal_confidence NUMERIC(4,3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tracks_public_status_check'
  ) THEN
    ALTER TABLE tracks
      ADD CONSTRAINT tracks_public_status_check
      CHECK (public_status IN ('released', 'unreleased', 'id') OR public_status IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'set_tracks_public_status_check'
  ) THEN
    ALTER TABLE set_tracks
      ADD CONSTRAINT set_tracks_public_status_check
      CHECK (public_status IN ('released', 'unreleased', 'id') OR public_status IS NULL);
  END IF;
END $$;

-- Backfill tracks based on existing signals
UPDATE tracks
SET public_status = CASE
  WHEN is_unreleased = TRUE THEN 'unreleased'
  WHEN COALESCE(TRIM(LOWER(title)), '') IN ('id', 'unknown', 'unknown track') THEN 'id'
  WHEN spotify_url IS NOT NULL OR spotify_track_id IS NOT NULL OR verified = TRUE THEN 'released'
  ELSE 'id'
END
WHERE public_status IS NULL;

UPDATE tracks
SET internal_confidence = CASE
  WHEN public_status = 'released' THEN COALESCE(validation_confidence, 0.900)
  WHEN public_status = 'unreleased' THEN COALESCE(validation_confidence, 0.750)
  ELSE COALESCE(validation_confidence, 0.350)
END
WHERE internal_confidence IS NULL;

-- Backfill set_tracks based on existing signals
-- First backfill rows that are linked to a canonical track
UPDATE set_tracks st
SET public_status = CASE
  WHEN st.is_unreleased = TRUE THEN 'unreleased'
  WHEN st.is_id = TRUE OR COALESCE(TRIM(LOWER(st.track_title)), '') IN ('id', 'unknown', 'unknown track') THEN 'id'
  ELSE COALESCE(t.public_status, 'released')
END
FROM tracks t
WHERE st.public_status IS NULL
  AND st.track_id = t.id;

-- Then backfill unlinked rows
UPDATE set_tracks st
SET public_status = CASE
  WHEN st.is_unreleased = TRUE THEN 'unreleased'
  WHEN st.is_id = TRUE OR COALESCE(TRIM(LOWER(st.track_title)), '') IN ('id', 'unknown', 'unknown track') THEN 'id'
  WHEN st.spotify_data IS NOT NULL AND (st.spotify_data->>'spotify_id') IS NOT NULL THEN 'released'
  ELSE 'id'
END
WHERE st.public_status IS NULL;

UPDATE set_tracks
SET internal_confidence = CASE
  WHEN public_status = 'released' THEN COALESCE(match_confidence, 0.900)
  WHEN public_status = 'unreleased' THEN COALESCE(match_confidence, 0.750)
  ELSE COALESCE(match_confidence, 0.350)
END
WHERE internal_confidence IS NULL;

CREATE INDEX IF NOT EXISTS idx_tracks_public_status ON tracks(public_status);
CREATE INDEX IF NOT EXISTS idx_set_tracks_public_status ON set_tracks(public_status);
