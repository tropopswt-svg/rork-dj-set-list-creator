-- Track ID Suggestions: Community crowd-sourcing for unknown tracks
-- Users can suggest track identifications and vote on suggestions

-- Suggestions table
CREATE TABLE IF NOT EXISTS track_id_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  track_timestamp INTEGER NOT NULL DEFAULT 0, -- position in set (seconds)
  track_id TEXT, -- optional reference to the track being ID'd
  user_id UUID NOT NULL,
  suggested_title TEXT NOT NULL,
  suggested_artist TEXT NOT NULL,
  votes_up INTEGER NOT NULL DEFAULT 0,
  votes_down INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Votes on suggestions
CREATE TABLE IF NOT EXISTS suggestion_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES track_id_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(suggestion_id, user_id) -- One vote per user per suggestion
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suggestions_set_id ON track_id_suggestions(set_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON track_id_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestion_votes_suggestion ON suggestion_votes(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_votes_user ON suggestion_votes(user_id);

-- Updated at trigger
CREATE TRIGGER update_suggestions_updated_at
  BEFORE UPDATE ON track_id_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE track_id_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read suggestions
CREATE POLICY "suggestions_public_read" ON track_id_suggestions
  FOR SELECT USING (true);

-- Authenticated users can insert suggestions
CREATE POLICY "suggestions_auth_insert" ON track_id_suggestions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Authenticated users can update own suggestions
CREATE POLICY "suggestions_auth_update_own" ON track_id_suggestions
  FOR UPDATE USING (auth.uid() = user_id);

-- Anyone can read votes
CREATE POLICY "votes_public_read" ON suggestion_votes
  FOR SELECT USING (true);

-- Authenticated users can insert/update their votes
CREATE POLICY "votes_auth_insert" ON suggestion_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "votes_auth_update_own" ON suggestion_votes
  FOR UPDATE USING (auth.uid() = user_id);
