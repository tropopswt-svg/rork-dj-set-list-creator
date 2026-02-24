-- Catalog scale + Spotify validation hardening
-- Safe, forward-only migration. No destructive changes.

-- Optional extension for similarity search at scale
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- TRACKS: canonical identity + validation metadata
-- ============================================================

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS canonical_fingerprint TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS spotify_track_id TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS spotify_album_id TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS spotify_artist_ids TEXT[] DEFAULT '{}';
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS spotify_release_date DATE;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS spotify_release_precision TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending';
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS validation_confidence NUMERIC(4,3);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS validation_source TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();

-- Keep validation status constrained but migration-safe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tracks_validation_status_check'
  ) THEN
    ALTER TABLE tracks
      ADD CONSTRAINT tracks_validation_status_check
      CHECK (validation_status IN ('pending', 'verified', 'unmatched', 'conflict', 'manual'));
  END IF;
END $$;

-- Canonical fingerprint helper
CREATE OR REPLACE FUNCTION build_track_fingerprint(track_title TEXT, artist_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(TRIM(REGEXP_REPLACE(COALESCE(artist_name, ''), '\s+', ' ', 'g')))
    || '|||' ||
    LOWER(TRIM(REGEXP_REPLACE(COALESCE(track_title, ''), '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill fingerprint and seen timestamps
UPDATE tracks
SET canonical_fingerprint = build_track_fingerprint(title, artist_name)
WHERE canonical_fingerprint IS NULL;

UPDATE tracks
SET first_seen_at = COALESCE(first_seen_at, created_at),
    last_seen_at = COALESCE(last_seen_at, updated_at, created_at)
WHERE first_seen_at IS NULL OR last_seen_at IS NULL;

-- Indexes for scale and lookup
CREATE INDEX IF NOT EXISTS idx_tracks_canonical_fingerprint ON tracks(canonical_fingerprint);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tracks_spotify_track_id ON tracks(spotify_track_id)
  WHERE spotify_track_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_validation_status ON tracks(validation_status);
CREATE INDEX IF NOT EXISTS idx_tracks_last_validated_at ON tracks(last_validated_at);
CREATE INDEX IF NOT EXISTS idx_tracks_title_trgm ON tracks USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_name_trgm ON tracks USING gin (artist_name gin_trgm_ops);

-- ============================================================
-- TRACK EXTERNAL IDS (future-proof providers)
-- ============================================================

CREATE TABLE IF NOT EXISTS track_external_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- spotify|apple_music|beatport|youtube|discogs|musicbrainz
  external_id TEXT NOT NULL,
  external_url TEXT,
  confidence NUMERIC(4,3),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_track_external_ids_track_id ON track_external_ids(track_id);
CREATE INDEX IF NOT EXISTS idx_track_external_ids_provider_track ON track_external_ids(provider, track_id);

ALTER TABLE track_external_ids ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'track_external_ids' AND policyname = 'Public read access track_external_ids'
  ) THEN
    CREATE POLICY "Public read access track_external_ids"
      ON track_external_ids FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'track_external_ids' AND policyname = 'Allow inserts track_external_ids'
  ) THEN
    CREATE POLICY "Allow inserts track_external_ids"
      ON track_external_ids FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'track_external_ids' AND policyname = 'Allow updates track_external_ids'
  ) THEN
    CREATE POLICY "Allow updates track_external_ids"
      ON track_external_ids FOR UPDATE USING (true);
  END IF;
END $$;

-- ============================================================
-- VALIDATION JOB QUEUE
-- ============================================================

CREATE TABLE IF NOT EXISTS track_validation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'spotify',
  status TEXT NOT NULL DEFAULT 'queued', -- queued|processing|done|failed|skipped
  priority INTEGER NOT NULL DEFAULT 100,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  error TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_track_validation_jobs_pick
  ON track_validation_jobs(status, run_after, priority, created_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_track_validation_jobs_track_status
  ON track_validation_jobs(track_id, status);

ALTER TABLE track_validation_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'track_validation_jobs' AND policyname = 'Public read access track_validation_jobs'
  ) THEN
    CREATE POLICY "Public read access track_validation_jobs"
      ON track_validation_jobs FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'track_validation_jobs' AND policyname = 'Allow inserts track_validation_jobs'
  ) THEN
    CREATE POLICY "Allow inserts track_validation_jobs"
      ON track_validation_jobs FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'track_validation_jobs' AND policyname = 'Allow updates track_validation_jobs'
  ) THEN
    CREATE POLICY "Allow updates track_validation_jobs"
      ON track_validation_jobs FOR UPDATE USING (true);
  END IF;
END $$;

-- Avoid duplicate queued jobs for same track/provider
CREATE UNIQUE INDEX IF NOT EXISTS uq_track_validation_jobs_open
ON track_validation_jobs(track_id, provider)
WHERE status IN ('queued', 'processing');

-- Queue helper
CREATE OR REPLACE FUNCTION enqueue_track_validation(p_track_id UUID, p_provider TEXT DEFAULT 'spotify', p_priority INTEGER DEFAULT 100)
RETURNS VOID AS $$
BEGIN
  INSERT INTO track_validation_jobs (track_id, provider, priority, status)
  VALUES (p_track_id, p_provider, p_priority, 'queued')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Enqueue tracks missing validation
INSERT INTO track_validation_jobs (track_id, provider, priority, status)
SELECT t.id, 'spotify', 100, 'queued'
FROM tracks t
LEFT JOIN track_validation_jobs q
  ON q.track_id = t.id
 AND q.provider = 'spotify'
 AND q.status IN ('queued', 'processing')
WHERE q.id IS NULL
  AND (t.validation_status IS NULL OR t.validation_status = 'pending');

-- ============================================================
-- SET_TRACKS: better matching telemetry
-- ============================================================

ALTER TABLE set_tracks ADD COLUMN IF NOT EXISTS match_method TEXT; -- exact|alias|fuzzy|manual|id|unknown
ALTER TABLE set_tracks ADD COLUMN IF NOT EXISTS match_confidence NUMERIC(4,3);
ALTER TABLE set_tracks ADD COLUMN IF NOT EXISTS validated_track_id UUID REFERENCES tracks(id);

CREATE INDEX IF NOT EXISTS idx_set_tracks_validated_track_id ON set_tracks(validated_track_id);

-- ============================================================
-- Trigger upkeep
-- ============================================================

DROP TRIGGER IF EXISTS track_external_ids_updated_at ON track_external_ids;
CREATE TRIGGER track_external_ids_updated_at
  BEFORE UPDATE ON track_external_ids
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS track_validation_jobs_updated_at ON track_validation_jobs;
CREATE TRIGGER track_validation_jobs_updated_at
  BEFORE UPDATE ON track_validation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
