-- Listening Sessions: Continuous identification mode
-- Users can start a live session that records multiple tracks

CREATE TABLE IF NOT EXISTS listening_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT DEFAULT 'Live Session',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  tracks_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES listening_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  identified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  position INTEGER NOT NULL DEFAULT 0,
  spotify_url TEXT,
  album TEXT,
  label TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON listening_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON listening_sessions(status);
CREATE INDEX IF NOT EXISTS idx_session_tracks_session ON session_tracks(session_id);

-- RLS Policies
ALTER TABLE listening_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_tracks ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own sessions
CREATE POLICY "sessions_own_read" ON listening_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "sessions_own_insert" ON listening_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_own_update" ON listening_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can read/write tracks in their own sessions
CREATE POLICY "session_tracks_own_read" ON session_tracks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listening_sessions
      WHERE listening_sessions.id = session_tracks.session_id
      AND listening_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "session_tracks_own_insert" ON session_tracks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM listening_sessions
      WHERE listening_sessions.id = session_tracks.session_id
      AND listening_sessions.user_id = auth.uid()
    )
  );
