-- TRACK'D Database Schema
-- Artists, Tracks, and relationships for the DJ set identification app

-- ============================================
-- ARTISTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL-friendly name (e.g., "chris-stussy")
  image_url TEXT,
  bio TEXT,
  
  -- Social/streaming links
  spotify_url TEXT,
  soundcloud_url TEXT,
  instagram_url TEXT,
  resident_advisor_url TEXT,
  bandcamp_url TEXT,
  beatport_url TEXT,
  
  -- Metadata
  genres TEXT[] DEFAULT '{}',
  country TEXT,
  
  -- Stats (denormalized for performance)
  tracks_count INTEGER DEFAULT 0,
  sets_count INTEGER DEFAULT 0,
  
  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artist aliases for fuzzy matching
CREATE TABLE IF NOT EXISTS artist_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_lower TEXT NOT NULL, -- Lowercase for matching
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(alias_lower)
);

-- ============================================
-- TRACKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_normalized TEXT NOT NULL, -- Lowercase, stripped for matching
  
  -- Primary artist
  artist_id UUID REFERENCES artists(id),
  artist_name TEXT NOT NULL, -- Denormalized for display
  
  -- Remix/edit artist (if applicable)
  remix_artist_id UUID REFERENCES artists(id),
  remix_artist_name TEXT,
  remix_type TEXT, -- 'remix', 'edit', 'vip', 'bootleg', etc.
  
  -- Release info
  label TEXT,
  release_year INTEGER,
  is_unreleased BOOLEAN DEFAULT FALSE,
  
  -- Links
  spotify_url TEXT,
  beatport_url TEXT,
  soundcloud_url TEXT,
  youtube_url TEXT,
  
  -- Audio identification
  isrc TEXT, -- International Standard Recording Code
  duration_seconds INTEGER,
  bpm INTEGER,
  key TEXT,
  
  -- Stats
  times_played INTEGER DEFAULT 0, -- How many sets feature this track
  
  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track aliases for different naming conventions
CREATE TABLE IF NOT EXISTS track_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  title_alias TEXT NOT NULL,
  title_alias_normalized TEXT NOT NULL,
  artist_alias TEXT, -- Sometimes tracks are credited differently
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(title_alias_normalized, artist_alias)
);

-- ============================================
-- SETS TABLE (for linking)
-- ============================================
CREATE TABLE IF NOT EXISTS sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT, -- ID from the app
  name TEXT NOT NULL,
  
  -- Artist performing the set
  artist_id UUID REFERENCES artists(id),
  artist_name TEXT NOT NULL,
  
  -- Event info
  venue TEXT,
  event_name TEXT,
  set_date DATE,
  
  -- Source links
  youtube_url TEXT,
  soundcloud_url TEXT,
  
  -- Metadata
  duration_seconds INTEGER,
  tracks_count INTEGER DEFAULT 0,
  cover_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracks in a set (junction table)
CREATE TABLE IF NOT EXISTS set_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  track_id UUID REFERENCES tracks(id), -- NULL if unidentified
  
  -- Position in set
  position INTEGER NOT NULL,
  timestamp_seconds INTEGER,
  
  -- If track not in database yet, store raw info
  raw_title TEXT,
  raw_artist TEXT,
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 0.5,
  source TEXT, -- 'comment', 'description', '1001tracklists', 'shazam'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(set_id, position)
);

-- ============================================
-- INDEXES
-- ============================================

-- Artist search
CREATE INDEX idx_artists_name_lower ON artists(LOWER(name));
CREATE INDEX idx_artists_slug ON artists(slug);
CREATE INDEX idx_artist_aliases_lower ON artist_aliases(alias_lower);

-- Track search
CREATE INDEX idx_tracks_title_normalized ON tracks(title_normalized);
CREATE INDEX idx_tracks_artist_id ON tracks(artist_id);
CREATE INDEX idx_track_aliases_normalized ON track_aliases(title_alias_normalized);

-- Set lookups
CREATE INDEX idx_sets_artist_id ON sets(artist_id);
CREATE INDEX idx_set_tracks_set_id ON set_tracks(set_id);
CREATE INDEX idx_set_tracks_track_id ON set_tracks(track_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER artists_updated_at
  BEFORE UPDATE ON artists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tracks_updated_at
  BEFORE UPDATE ON tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sets_updated_at
  BEFORE UPDATE ON sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to normalize text for matching
CREATE OR REPLACE FUNCTION normalize_text(input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(input, '[^\w\s]', '', 'g'), -- Remove special chars
      '\s+', ' ', 'g' -- Normalize whitespace
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION generate_slug(input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(input, '[^\w\s-]', '', 'g'),
      '\s+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_tracks ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can view)
CREATE POLICY "Public read access" ON artists FOR SELECT USING (true);
CREATE POLICY "Public read access" ON artist_aliases FOR SELECT USING (true);
CREATE POLICY "Public read access" ON tracks FOR SELECT USING (true);
CREATE POLICY "Public read access" ON track_aliases FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sets FOR SELECT USING (true);
CREATE POLICY "Public read access" ON set_tracks FOR SELECT USING (true);

-- For now, allow all inserts/updates (we can restrict later with auth)
CREATE POLICY "Allow inserts" ON artists FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow updates" ON artists FOR UPDATE USING (true);
CREATE POLICY "Allow inserts" ON artist_aliases FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow inserts" ON tracks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow updates" ON tracks FOR UPDATE USING (true);
CREATE POLICY "Allow inserts" ON track_aliases FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow inserts" ON sets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow updates" ON sets FOR UPDATE USING (true);
CREATE POLICY "Allow inserts" ON set_tracks FOR INSERT WITH CHECK (true);
