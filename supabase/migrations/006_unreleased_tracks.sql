-- Unreleased Tracks Catalog
-- Database schema for managing unreleased/ID tracks with ACRCloud bucket integration

-- ============================================
-- UNRELEASED TRACKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS unreleased_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core metadata
  title TEXT NOT NULL,
  artist TEXT NOT NULL,

  -- Source info
  source_platform TEXT NOT NULL, -- 'soundcloud', 'instagram', 'tiktok', 'manual'
  source_url TEXT NOT NULL UNIQUE,
  source_user TEXT, -- original uploader username
  source_post_date TIMESTAMPTZ,

  -- ACRCloud integration
  acrcloud_acr_id TEXT UNIQUE, -- ID returned after upload to bucket
  acrcloud_status TEXT DEFAULT 'pending', -- 'pending', 'uploaded', 'failed', 'removed'
  fingerprint_created_at TIMESTAMPTZ,

  -- Quality/confidence
  confidence_score DECIMAL(3,2) DEFAULT 0.5, -- 0-1, how confident we are in metadata
  audio_duration_seconds INTEGER,
  audio_quality TEXT, -- 'high', 'medium', 'low', 'clip'

  -- Identification stats
  times_identified INTEGER DEFAULT 0,
  last_identified_at TIMESTAMPTZ,

  -- Management
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Optional extended metadata (for future)
  metadata JSONB DEFAULT '{}'
);

-- ============================================
-- UNRELEASED IDENTIFICATIONS TABLE
-- Track when unreleased tracks get identified (analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS unreleased_identifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unreleased_track_id UUID REFERENCES unreleased_tracks(id) ON DELETE CASCADE,
  identified_in_set_id UUID REFERENCES sets(id) ON DELETE SET NULL,
  identified_at TIMESTAMPTZ DEFAULT NOW(),
  confidence DECIMAL(3,2)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_unreleased_source_platform ON unreleased_tracks(source_platform);
CREATE INDEX idx_unreleased_acrcloud_status ON unreleased_tracks(acrcloud_status);
CREATE INDEX idx_unreleased_artist ON unreleased_tracks(artist);
CREATE INDEX idx_unreleased_acrcloud_acr_id ON unreleased_tracks(acrcloud_acr_id);
CREATE INDEX idx_unreleased_is_active ON unreleased_tracks(is_active);
CREATE INDEX idx_unreleased_identifications_track ON unreleased_identifications(unreleased_track_id);
CREATE INDEX idx_unreleased_identifications_set ON unreleased_identifications(identified_in_set_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE TRIGGER unreleased_tracks_updated_at
  BEFORE UPDATE ON unreleased_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE unreleased_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE unreleased_identifications ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access" ON unreleased_tracks FOR SELECT USING (true);
CREATE POLICY "Public read access" ON unreleased_identifications FOR SELECT USING (true);

-- Allow inserts/updates (can be restricted later with auth)
CREATE POLICY "Allow inserts" ON unreleased_tracks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow updates" ON unreleased_tracks FOR UPDATE USING (true);
CREATE POLICY "Allow deletes" ON unreleased_tracks FOR DELETE USING (true);
CREATE POLICY "Allow inserts" ON unreleased_identifications FOR INSERT WITH CHECK (true);
