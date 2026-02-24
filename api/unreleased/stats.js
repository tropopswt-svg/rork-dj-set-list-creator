// API endpoint to get unreleased track catalog statistics
// GET /api/unreleased/stats
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
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

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // Get counts by ACRCloud status
    const { data: statusRows } = await supabase
      .from('unreleased_tracks')
      .select('acrcloud_status')
      .eq('is_active', true);

    const counts = { total: 0, pending: 0, uploaded: 0, failed: 0 };
    (statusRows || []).forEach(row => {
      counts.total++;
      if (row.acrcloud_status === 'pending') counts.pending++;
      if (row.acrcloud_status === 'uploaded') counts.uploaded++;
      if (row.acrcloud_status === 'failed') counts.failed++;
    });

    // Get counts by source platform
    const { data: platformRows } = await supabase
      .from('unreleased_tracks')
      .select('source_platform')
      .eq('is_active', true);

    const byPlatform = {};
    (platformRows || []).forEach(row => {
      byPlatform[row.source_platform] = (byPlatform[row.source_platform] || 0) + 1;
    });

    // Total identifications
    const { count: totalIdentifications } = await supabase
      .from('unreleased_identifications')
      .select('*', { count: 'exact', head: true });

    // Most identified tracks
    const limit = parseInt(req.query?.limit) || 10;
    const { data: mostIdentified } = await supabase
      .from('unreleased_tracks')
      .select('id, title, artist, times_identified, source_platform, acrcloud_status, last_identified_at')
      .eq('is_active', true)
      .gt('times_identified', 0)
      .order('times_identified', { ascending: false })
      .limit(limit);

    return res.status(200).json({
      success: true,
      stats: {
        ...counts,
        byPlatform,
        totalIdentifications: totalIdentifications || 0,
      },
      mostIdentified: (mostIdentified || []).map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        timesIdentified: t.times_identified,
        platform: t.source_platform,
        acrcloudStatus: t.acrcloud_status,
        lastIdentifiedAt: t.last_identified_at,
      })),
    });

  } catch (error) {
    console.error('Unreleased stats error:', error);
    return res.status(500).json({ error: error.message });
  }
}
