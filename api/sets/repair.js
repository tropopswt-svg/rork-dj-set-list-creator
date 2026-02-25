// API endpoint to diagnose and repair set track counts
// Checks actual set_tracks vs sets.track_count and fixes discrepancies
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseKey = serviceKey || anonKey;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // GET: Diagnose a set
  if (req.method === 'GET') {
    const { setId } = req.query;
    if (!setId) return res.status(400).json({ error: 'setId query param required' });

    const { data: set } = await supabase
      .from('sets')
      .select('id, title, dj_name, track_count, tracklist_url, youtube_url, soundcloud_url, source')
      .eq('id', setId)
      .single();

    if (!set) return res.status(404).json({ error: 'Set not found' });

    const { count: actualCount } = await supabase
      .from('set_tracks')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', setId);

    const { data: tracks } = await supabase
      .from('set_tracks')
      .select('id, track_title, artist_name, position, source, is_timed, timestamp_seconds')
      .eq('set_id', setId)
      .order('position', { ascending: true });

    return res.status(200).json({
      set: {
        id: set.id,
        title: set.title,
        djName: set.dj_name,
        source: set.source,
        tracklistUrl: set.tracklist_url,
        youtubeUrl: set.youtube_url,
        soundcloudUrl: set.soundcloud_url,
      },
      trackCount: {
        metadata: set.track_count,
        actual: actualCount,
        mismatch: set.track_count !== actualCount,
      },
      tracks: tracks || [],
    });
  }

  // POST: Repair a set (fix track_count, optionally re-import)
  if (req.method === 'POST') {
    const { setId } = req.body;
    if (!setId) return res.status(400).json({ error: 'setId is required' });

    const { data: set } = await supabase
      .from('sets')
      .select('id, title, track_count')
      .eq('id', setId)
      .single();

    if (!set) return res.status(404).json({ error: 'Set not found' });

    // Count actual tracks
    const { count: actualCount } = await supabase
      .from('set_tracks')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', setId);

    // Fix track_count if mismatched
    if (actualCount !== null && actualCount !== set.track_count) {
      await supabase
        .from('sets')
        .update({ track_count: actualCount })
        .eq('id', setId);
    }

    return res.status(200).json({
      success: true,
      setId,
      previousTrackCount: set.track_count,
      actualTrackCount: actualCount,
      fixed: actualCount !== set.track_count,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
