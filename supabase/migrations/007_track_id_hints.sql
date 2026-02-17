-- Track ID Hints Table
-- Stores ID-related comments from social media for track identification crowdsourcing
-- Only stores meaningful comments (replies to "ID?" questions, direct track mentions, links)

-- ============================================
-- TRACK ID HINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS track_id_hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to the unreleased track
  unreleased_track_id UUID REFERENCES unreleased_tracks(id) ON DELETE CASCADE,

  -- Source info
  platform TEXT NOT NULL, -- 'tiktok', 'instagram', 'soundcloud'
  hint_type TEXT NOT NULL, -- 'id_response', 'direct_mention', 'link', 'timestamp_ref'

  -- The actual comment data
  original_comment TEXT NOT NULL,
  commenter_username TEXT,

  -- Parsed/extracted info
  parsed_artist TEXT,
  parsed_title TEXT,
  extracted_links TEXT[], -- Array of extracted music service links
  timestamp_reference TEXT, -- e.g., "2:30" if mentioned

  -- Confidence and verification
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')) DEFAULT 'medium',
  is_reply_to_id_request BOOLEAN DEFAULT false,
  verified BOOLEAN DEFAULT false, -- Admin can mark as verified
  verified_at TIMESTAMPTZ,
  verified_by TEXT, -- Username/ID of verifier

  -- If verified, store the confirmed info
  confirmed_artist TEXT,
  confirmed_title TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- For looking up hints by track
CREATE INDEX idx_track_id_hints_track ON track_id_hints(unreleased_track_id);

-- For finding unverified hints (review queue)
CREATE INDEX idx_track_id_hints_unverified ON track_id_hints(verified) WHERE verified = false;

-- For filtering by platform
CREATE INDEX idx_track_id_hints_platform ON track_id_hints(platform);

-- For high-confidence hints
CREATE INDEX idx_track_id_hints_confidence ON track_id_hints(confidence);

-- For id_response type hints (most valuable)
CREATE INDEX idx_track_id_hints_type ON track_id_hints(hint_type);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE TRIGGER track_id_hints_updated_at
  BEFORE UPDATE ON track_id_hints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE track_id_hints ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access" ON track_id_hints FOR SELECT USING (true);

-- Allow inserts
CREATE POLICY "Allow inserts" ON track_id_hints FOR INSERT WITH CHECK (true);

-- Allow updates (for verification)
CREATE POLICY "Allow updates" ON track_id_hints FOR UPDATE USING (true);

-- Allow deletes
CREATE POLICY "Allow deletes" ON track_id_hints FOR DELETE USING (true);
