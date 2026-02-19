-- Add Spotify enrichment data to set_tracks
-- Stores full Spotify match data as JSONB (album art, preview URL, ISRC, etc.)
ALTER TABLE set_tracks ADD COLUMN IF NOT EXISTS spotify_data JSONB DEFAULT NULL;

-- Add Spotify fields to artists table
ALTER TABLE artists ADD COLUMN IF NOT EXISTS spotify_url TEXT DEFAULT NULL;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS spotify_id TEXT DEFAULT NULL;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;

-- Index for finding un-enriched tracks
CREATE INDEX IF NOT EXISTS idx_set_tracks_spotify_null
ON set_tracks (id)
WHERE spotify_data IS NULL AND is_id = FALSE;

-- Index for Spotify ID lookups
CREATE INDEX IF NOT EXISTS idx_set_tracks_spotify_id
ON set_tracks ((spotify_data->>'spotify_id'))
WHERE spotify_data IS NOT NULL AND spotify_data->>'spotify_id' IS NOT NULL;
