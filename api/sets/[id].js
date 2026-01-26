// API endpoint to get a single set with its tracklist
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Set ID is required' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // Get the set
    const { data: set, error: setError } = await supabase
      .from('sets')
      .select('*')
      .eq('id', id)
      .single();

    if (setError) {
      if (setError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Set not found' });
      }
      console.error('Set query error:', setError);
      return res.status(500).json({ error: setError.message });
    }

    // Get the tracklist
    const { data: setTracks, error: tracksError } = await supabase
      .from('set_tracks')
      .select('*')
      .eq('set_id', id)
      .order('position', { ascending: true });

    if (tracksError) {
      console.error('Tracks query error:', tracksError);
      return res.status(500).json({ error: tracksError.message });
    }

    // Count gaps (ID tracks)
    const gapCount = setTracks?.filter(t => t.is_id)?.length || 0;
    const hasGaps = gapCount > 0;

    // Transform tracks to match app's Track type
    const tracks = setTracks?.map(track => ({
      id: track.id,
      title: track.track_title || 'Unknown',
      artist: track.artist_name || 'Unknown',
      position: track.position,
      timestamp: track.timestamp_seconds || 0,
      timestampStr: track.timestamp_str || '0:00',
      isId: track.is_id || false,
      isTimed: track.is_timed !== false, // Default to true for backwards compatibility
      trackId: track.track_id, // Reference to tracks table
      addedAt: track.created_at,
      // Source is '1001tracklists' since that's where set_tracks come from
      source: track.source || '1001tracklists',
      verified: !track.is_id,
      confidence: track.is_id ? 0 : 1,
    })) || [];

    // Transform set to match app's SetList type
    const transformedSet = {
      id: set.id,
      name: set.title,
      artist: set.dj_name || 'Unknown Artist',
      venue: set.venue || null,
      eventName: set.event_name || null,
      date: set.event_date || set.created_at,
      totalDuration: set.duration_seconds || 0,
      trackCount: set.track_count || tracks.length,
      coverUrl: null,
      sourceLinks: [
        set.tracklist_url && { platform: '1001tracklists', url: set.tracklist_url },
        set.youtube_url && { platform: 'youtube', url: set.youtube_url },
        set.soundcloud_url && { platform: 'soundcloud', url: set.soundcloud_url },
        set.mixcloud_url && { platform: 'mixcloud', url: set.mixcloud_url },
        set.spotify_url && { platform: 'spotify', url: set.spotify_url },
        set.apple_music_url && { platform: 'apple', url: set.apple_music_url },
      ].filter(Boolean),
      source: set.source,
      tracks,
      hasGaps,
      gapCount,
      description: set.description,
      genre: set.genre,
      // Analysis flags
      youtubeAnalyzed: set.youtube_analyzed || false,
      soundcloudAnalyzed: set.soundcloud_analyzed || false,
    };

    return res.status(200).json({
      success: true,
      set: transformedSet,
    });

  } catch (error) {
    console.error('Set detail API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
