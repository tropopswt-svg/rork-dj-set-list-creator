// API endpoint: /api/sessions/[id]
// Get session details, end session, add tracks to session

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export default async function handler(req, res) {
  const { id } = req.query;
  const supabase = getSupabase();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('listening_sessions')
        .select('*, session_tracks(*)')
        .eq('id', id)
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, session: data });
    }

    if (req.method === 'PUT') {
      const { action, track } = req.body;

      if (action === 'end') {
        // End the session
        const { data: session } = await supabase
          .from('listening_sessions')
          .select('id')
          .eq('id', id)
          .single();

        if (!session) {
          return res.status(404).json({ success: false, error: 'Session not found' });
        }

        // Count tracks
        const { count } = await supabase
          .from('session_tracks')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', id);

        const { data, error } = await supabase
          .from('listening_sessions')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
            tracks_count: count || 0,
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        return res.status(200).json({ success: true, session: data });
      }

      if (action === 'add_track' && track) {
        // Add a track to the session
        // Get current track count for position
        const { count } = await supabase
          .from('session_tracks')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', id);

        const { data, error } = await supabase
          .from('session_tracks')
          .insert({
            session_id: id,
            title: track.title,
            artist: track.artist,
            confidence: track.confidence || 0,
            position: (count || 0) + 1,
            spotify_url: track.spotifyUrl || null,
            album: track.album || null,
            label: track.label || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Update session track count
        await supabase
          .from('listening_sessions')
          .update({ tracks_count: (count || 0) + 1 })
          .eq('id', id);

        return res.status(201).json({ success: true, track: data });
      }

      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[sessions/id] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
