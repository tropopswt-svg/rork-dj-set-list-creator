-- Create sets table to store DJ set metadata
CREATE TABLE IF NOT EXISTS sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  dj_name TEXT,
  dj_id UUID REFERENCES artists(id),
  venue TEXT,
  event_name TEXT,
  event_date DATE,
  duration_seconds INTEGER,
  track_count INTEGER DEFAULT 0,

  -- Source URLs
  tracklist_url TEXT UNIQUE,  -- 1001tracklists URL
  soundcloud_url TEXT,
  youtube_url TEXT,
  mixcloud_url TEXT,
  spotify_url TEXT,
  apple_music_url TEXT,

  -- Metadata
  genre TEXT,
  description TEXT,
  source TEXT DEFAULT '1001tracklists',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create set_tracks junction table
CREATE TABLE IF NOT EXISTS set_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,

  -- Track info (stored here too in case track doesn't exist yet)
  artist_name TEXT,
  track_title TEXT,

  position INTEGER NOT NULL,
  timestamp_seconds INTEGER,
  timestamp_str TEXT,
  is_id BOOLEAN DEFAULT FALSE,  -- Is it an unreleased/ID track?

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(set_id, position)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sets_dj_name ON sets(dj_name);
CREATE INDEX IF NOT EXISTS idx_sets_dj_id ON sets(dj_id);
CREATE INDEX IF NOT EXISTS idx_sets_tracklist_url ON sets(tracklist_url);
CREATE INDEX IF NOT EXISTS idx_sets_soundcloud_url ON sets(soundcloud_url);
CREATE INDEX IF NOT EXISTS idx_sets_youtube_url ON sets(youtube_url);
CREATE INDEX IF NOT EXISTS idx_sets_event_date ON sets(event_date);
CREATE INDEX IF NOT EXISTS idx_set_tracks_set_id ON set_tracks(set_id);
CREATE INDEX IF NOT EXISTS idx_set_tracks_track_id ON set_tracks(track_id);

-- Enable RLS
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_tracks ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on sets" ON sets FOR SELECT USING (true);
CREATE POLICY "Allow public read access on set_tracks" ON set_tracks FOR SELECT USING (true);

-- Allow inserts (for API)
CREATE POLICY "Allow public insert on sets" ON sets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on set_tracks" ON set_tracks FOR INSERT WITH CHECK (true);

-- Allow updates (for API)
CREATE POLICY "Allow public update on sets" ON sets FOR UPDATE USING (true);
CREATE POLICY "Allow public update on set_tracks" ON set_tracks FOR UPDATE USING (true);
