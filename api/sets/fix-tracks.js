// API endpoint to fix individual set_tracks (delete, swap, clear-spotify, update)
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ready',
      description: 'POST to fix individual set_tracks.',
      actions: ['delete', 'swap', 'clear-spotify', 'update'],
      usage: {
        delete: '{ "action": "delete", "trackId": "uuid", "setId": "uuid" }',
        swap: '{ "action": "swap", "trackId": "uuid" }',
        'clear-spotify': '{ "action": "clear-spotify", "trackId": "uuid" }',
        update: '{ "action": "update", "trackId": "uuid", "artist": "...", "title": "..." }',
      },
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const { action, trackId, setId, artist, title } = req.body || {};

    if (!trackId) {
      return res.status(400).json({ error: 'trackId is required' });
    }

    // ========== DELETE ==========
    if (action === 'delete') {
      if (!setId) {
        return res.status(400).json({ error: 'setId is required for delete' });
      }

      const { error: deleteError } = await supabase
        .from('set_tracks')
        .delete()
        .eq('id', trackId);

      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }

      // Decrement track_count on the parent set
      const { data: set } = await supabase
        .from('sets')
        .select('track_count')
        .eq('id', setId)
        .single();

      if (set && set.track_count > 0) {
        await supabase
          .from('sets')
          .update({ track_count: set.track_count - 1 })
          .eq('id', setId);
      }

      console.log(`[Fix Tracks] Deleted track ${trackId} from set ${setId}`);
      return res.status(200).json({
        success: true,
        message: `Deleted track ${trackId} from set ${setId}`,
      });
    }

    // ========== SWAP ==========
    if (action === 'swap') {
      const { data: track, error: fetchError } = await supabase
        .from('set_tracks')
        .select('artist_name, track_title')
        .eq('id', trackId)
        .single();

      if (fetchError || !track) {
        return res.status(404).json({ error: 'Track not found' });
      }

      const { error: updateError } = await supabase
        .from('set_tracks')
        .update({
          artist_name: track.track_title,
          track_title: track.artist_name,
          spotify_data: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trackId);

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      console.log(`[Fix Tracks] Swapped: "${track.artist_name}" <-> "${track.track_title}"`);
      return res.status(200).json({
        success: true,
        message: `Swapped: "${track.artist_name}" <-> "${track.track_title}"`,
        before: { artist: track.artist_name, title: track.track_title },
        after: { artist: track.track_title, title: track.artist_name },
      });
    }

    // ========== CLEAR SPOTIFY ==========
    if (action === 'clear-spotify') {
      const { error: updateError } = await supabase
        .from('set_tracks')
        .update({
          spotify_data: null,
          is_unreleased: true,
          unreleased_source: 'manual_clear',
          updated_at: new Date().toISOString(),
        })
        .eq('id', trackId);

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      console.log(`[Fix Tracks] Cleared spotify_data on track ${trackId}`);
      return res.status(200).json({
        success: true,
        message: `Cleared spotify_data on track ${trackId}, marked unreleased`,
      });
    }

    // ========== UPDATE ==========
    if (action === 'update') {
      if (!artist && !title) {
        return res.status(400).json({ error: 'artist and/or title required for update' });
      }

      const updateData = { updated_at: new Date().toISOString() };
      if (artist) updateData.artist_name = artist;
      if (title) updateData.track_title = title;

      const { error: updateError } = await supabase
        .from('set_tracks')
        .update(updateData)
        .eq('id', trackId);

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      console.log(`[Fix Tracks] Updated track ${trackId}:`, updateData);
      return res.status(200).json({
        success: true,
        message: `Updated track ${trackId}`,
        updated: updateData,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (error) {
    console.error('[Fix Tracks] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
