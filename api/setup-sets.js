// Setup sets and set_tracks tables
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(200).json({
      status: 'ready',
      description: 'POST to create sets and set_tracks tables',
      instructions: 'Run the SQL migration in Supabase Dashboard instead for full schema setup',
    });
  }

  // For now, just return the SQL that needs to be run
  // The anon key can't create tables, so user needs to run this in Supabase dashboard
  const sql = `
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
  tracklist_url TEXT UNIQUE,
  soundcloud_url TEXT,
  youtube_url TEXT,
  mixcloud_url TEXT,
  spotify_url TEXT,
  apple_music_url TEXT,
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
  artist_name TEXT,
  track_title TEXT,
  position INTEGER NOT NULL,
  timestamp_seconds INTEGER,
  timestamp_str TEXT,
  is_id BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(set_id, position)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sets_tracklist_url ON sets(tracklist_url);
CREATE INDEX IF NOT EXISTS idx_sets_soundcloud_url ON sets(soundcloud_url);
CREATE INDEX IF NOT EXISTS idx_sets_youtube_url ON sets(youtube_url);
CREATE INDEX IF NOT EXISTS idx_set_tracks_set_id ON set_tracks(set_id);
CREATE INDEX IF NOT EXISTS idx_set_tracks_track_id ON set_tracks(track_id);

-- Enable RLS and policies
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on sets" ON sets FOR SELECT USING (true);
CREATE POLICY "Allow public read on set_tracks" ON set_tracks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on sets" ON sets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on set_tracks" ON set_tracks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on sets" ON sets FOR UPDATE USING (true);
`;

  return res.status(200).json({
    message: 'Copy and run this SQL in your Supabase Dashboard > SQL Editor',
    sql: sql,
  });
}
