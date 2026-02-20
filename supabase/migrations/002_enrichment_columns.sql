-- Enrichment columns for production database readiness
-- Adds fields needed by spotify-drip, musicbrainz-drip, and backfill scripts

-- ============================================
-- TRACK ENRICHMENT FIELDS
-- ============================================

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artwork_url TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS spotify_preview_url TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS popularity INTEGER;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS album_name TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- ============================================
-- ARTIST ENRICHMENT FIELDS
-- ============================================

ALTER TABLE artists ADD COLUMN IF NOT EXISTS spotify_artist_id TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS popularity INTEGER;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- ============================================
-- SET ENRICHMENT FIELDS
-- ============================================

ALTER TABLE sets ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- ============================================
-- INDEXES FOR ENRICHMENT QUERIES
-- ============================================

-- Tracks missing enrichment (used by spotify-drip cron)
CREATE INDEX IF NOT EXISTS idx_tracks_not_enriched
  ON tracks(enriched_at) WHERE enriched_at IS NULL;

-- Tracks missing Spotify data (used by spotify-drip cron)
CREATE INDEX IF NOT EXISTS idx_tracks_no_spotify
  ON tracks(id) WHERE spotify_url IS NULL AND is_unreleased IS NOT TRUE;

-- Artists missing enrichment
CREATE INDEX IF NOT EXISTS idx_artists_not_enriched
  ON artists(enriched_at) WHERE enriched_at IS NULL;

-- Artists missing images (used by backfill-artist-images)
CREATE INDEX IF NOT EXISTS idx_artists_no_image
  ON artists(id) WHERE image_url IS NULL;

-- Artists missing Spotify data
CREATE INDEX IF NOT EXISTS idx_artists_no_spotify
  ON artists(id) WHERE spotify_url IS NULL;

-- Sets missing cover art (used by backfill-thumbnails)
CREATE INDEX IF NOT EXISTS idx_sets_no_cover
  ON sets(id) WHERE cover_url IS NULL AND youtube_url IS NOT NULL;

-- Sets missing artist link (used by backfill-links)
CREATE INDEX IF NOT EXISTS idx_sets_no_artist_id
  ON sets(id) WHERE artist_id IS NULL AND artist_name IS NOT NULL;

-- Tracks missing artist link
CREATE INDEX IF NOT EXISTS idx_tracks_no_artist_id
  ON tracks(id) WHERE artist_id IS NULL AND artist_name IS NOT NULL;
