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

  // POST: Repair a set (fix track_count, clean garbage tracks, reset source overwrite)
  if (req.method === 'POST') {
    const { setId, action } = req.body || {};
    if (!setId) return res.status(400).json({ error: 'setId is required' });

    const { data: set } = await supabase
      .from('sets')
      .select('id, title, track_count, source')
      .eq('id', setId)
      .single();

    if (!set) return res.status(404).json({ error: 'Set not found' });

    const results = { setId, actions: [] };

    // Action: cleanGarbage — remove tracks with obviously bad titles from YouTube comments
    if (!action || action === 'cleanGarbage') {
      const { data: allTracks } = await supabase
        .from('set_tracks')
        .select('id, track_title, artist_name, position, source')
        .eq('set_id', setId);

      const garbageIds = [];
      for (const t of (allTracks || [])) {
        const title = t.track_title || '';
        const artist = t.artist_name || '';
        const combined = `${artist} ${title}`;
        // Detect garbage: very long text (comment fragments), contains emoji, contains "RIP", "rest in peace", etc.
        const isGarbage =
          combined.length > 120 ||
          /rest in peace|RIP |🙏|❤️|🔥|😍|💀/i.test(combined) ||
          /love the |reminds me of|this track/i.test(combined) ||
          /let's get this \(/i.test(title) ||
          /\(fc\d/i.test(title);

        if (isGarbage) {
          garbageIds.push({ id: t.id, title: `${t.artist_name} - ${t.track_title}` });
        }
      }

      if (garbageIds.length > 0) {
        for (const g of garbageIds) {
          await supabase.from('set_tracks').delete().eq('id', g.id);
        }
        results.actions.push({ action: 'cleanGarbage', removed: garbageIds.length, tracks: garbageIds.map(g => g.title) });
      }
    }

    // Action: fixSource — reset source back to '1001tracklists' for tracks that were wrongly overwritten
    if (!action || action === 'fixSource') {
      if (set.source === '1001tracklists') {
        const { data: wrongSource } = await supabase
          .from('set_tracks')
          .select('id')
          .eq('set_id', setId)
          .eq('source', 'youtube');

        if (wrongSource && wrongSource.length > 0) {
          for (const t of wrongSource) {
            await supabase.from('set_tracks').update({ source: '1001tracklists' }).eq('id', t.id);
          }
          results.actions.push({ action: 'fixSource', fixed: wrongSource.length });
        }
      }
    }

    // Always: fix track_count to match actual rows
    const { count: actualCount } = await supabase
      .from('set_tracks')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', setId);

    if (actualCount !== null && actualCount !== set.track_count) {
      await supabase
        .from('sets')
        .update({ track_count: actualCount })
        .eq('id', setId);
      results.actions.push({ action: 'fixCount', from: set.track_count, to: actualCount });
    }

    results.success = true;
    results.finalTrackCount = actualCount;
    return res.status(200).json(results);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
