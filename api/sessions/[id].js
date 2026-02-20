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

      if (action === 'save_as_set') {
        const { title, dj_name, venue, event_date } = req.body;

        // Fetch the session and its tracks
        const { data: session, error: sessionError } = await supabase
          .from('listening_sessions')
          .select('*, session_tracks(*)')
          .eq('id', id)
          .single();

        if (sessionError || !session) {
          return res.status(404).json({ success: false, error: 'Session not found' });
        }

        const tracks = session.session_tracks || [];

        // Build set metadata
        const setTitle = title || session.title || `Live Set - ${new Date().toLocaleDateString()}`;
        const djName = dj_name || 'Recorded Live';

        // Generate a slug from the title
        const slug = setTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 100)
          + '-' + Date.now().toString(36);

        // Try to find the DJ's artist record
        let djId = null;
        if (djName && djName !== 'Recorded Live') {
          const djSlug = djName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          const { data: djData } = await supabase
            .from('artists')
            .select('id')
            .eq('slug', djSlug)
            .single();
          if (djData) djId = djData.id;
        }

        // Calculate duration from session timestamps
        let durationSeconds = null;
        if (session.started_at && session.ended_at) {
          durationSeconds = Math.round(
            (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000
          );
        }

        // Create a new set with source: 'recorded'
        const { data: newSet, error: setError } = await supabase
          .from('sets')
          .insert({
            title: setTitle,
            slug,
            dj_name: djName,
            dj_id: djId,
            venue: venue || null,
            event_date: event_date || new Date().toISOString().split('T')[0],
            duration_seconds: durationSeconds,
            source: 'recorded',
            track_count: tracks.length,
          })
          .select()
          .single();

        if (setError) throw setError;

        // Copy session_tracks into set_tracks with all available data
        if (tracks.length > 0) {
          const setTracks = tracks
            .sort((a, b) => a.position - b.position)
            .map((t, index) => ({
              set_id: newSet.id,
              artist_name: t.artist,
              track_title: t.title,
              position: index + 1,
              is_id: false,
              spotify_data: t.spotify_url ? JSON.stringify({
                external_urls: { spotify: t.spotify_url },
                album: t.album ? { name: t.album } : undefined,
                name: t.title,
                artists: [{ name: t.artist }],
              }) : null,
            }));

          const { error: insertError } = await supabase
            .from('set_tracks')
            .insert(setTracks);

          if (insertError) throw insertError;
        }

        // Update artist track/set counts if we linked a DJ
        if (djId) {
          const { count: setsCount } = await supabase
            .from('sets')
            .select('*', { count: 'exact', head: true })
            .eq('dj_id', djId);
          await supabase
            .from('artists')
            .update({ sets_count: setsCount || 0 })
            .eq('id', djId);
        }

        return res.status(201).json({ success: true, setId: newSet.id });
      }

      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[sessions/id] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
