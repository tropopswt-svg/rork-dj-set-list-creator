// API endpoint to get database stats for Chrome extension
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  // Try both EXPO_PUBLIC_ and regular env vars (for Vercel)
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Stats] Missing Supabase config:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
    });
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
    const { count: trackCount, error: trackError } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true });

    const { count: artistCount, error: artistError } = await supabase
      .from('artists')
      .select('*', { count: 'exact', head: true });

    const { count: setCount, error: setError } = await supabase
      .from('sets')
      .select('*', { count: 'exact', head: true });

    // Get recent tracks (last 10)
    const { data: recentTracks, error: recentError } = await supabase
      .from('tracks')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (trackError || artistError || recentError) {
      console.error('Stats query error:', trackError || artistError || recentError);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalTracks: trackCount || 0,
        totalArtists: artistCount || 0,
        totalSets: setCount || 0,
        recentTracks: recentTracks || [],
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: error.message });
  }
}
