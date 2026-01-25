// API endpoint to get database stats for Chrome extension
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // Get total counts
    const { count: trackCount } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true });

    const { count: artistCount } = await supabase
      .from('artists')
      .select('*', { count: 'exact', head: true });

    const { count: setCount } = await supabase
      .from('sets')
      .select('*', { count: 'exact', head: true });

    // Get Beatport-specific counts
    const { count: beatportTracks } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .not('beatport_url', 'is', null);

    const { count: beatportArtists } = await supabase
      .from('artists')
      .select('*', { count: 'exact', head: true })
      .not('beatport_url', 'is', null);

    // Get SoundCloud-specific counts
    const { count: soundcloudTracks } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .not('soundcloud_url', 'is', null);

    // Get recent tracks (last 20) with more details
    const { data: recentTracks } = await supabase
      .from('tracks')
      .select('id, title, artist_name, label, bpm, key, beatport_url, soundcloud_url, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    // Get recent artists (last 10)
    const { data: recentArtists } = await supabase
      .from('artists')
      .select('id, name, genres, beatport_url, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    return res.status(200).json({
      success: true,
      stats: {
        totalTracks: trackCount || 0,
        totalArtists: artistCount || 0,
        totalSets: setCount || 0,
        bySource: {
          beatport: {
            tracks: beatportTracks || 0,
            artists: beatportArtists || 0,
          },
          soundcloud: {
            tracks: soundcloudTracks || 0,
          },
        },
        recentTracks: recentTracks || [],
        recentArtists: recentArtists || [],
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: error.message });
  }
}
