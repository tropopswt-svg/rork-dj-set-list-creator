// API endpoint to clear all source URLs from sets (for cleanup)
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const { confirm } = req.body;

    if (confirm !== 'CLEAR_ALL_SOURCES') {
      return res.status(400).json({
        error: 'Must confirm with { "confirm": "CLEAR_ALL_SOURCES" }'
      });
    }

    // Clear all source URLs from all sets
    const { data, error } = await supabase
      .from('sets')
      .update({
        youtube_url: null,
        soundcloud_url: null,
        mixcloud_url: null,
      })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Match all rows

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Also reset track sources to '1001tracklists' since we're removing YT/SC analysis
    const { error: tracksError } = await supabase
      .from('set_tracks')
      .update({ source: '1001tracklists' })
      .in('source', ['youtube', 'soundcloud']);

    if (tracksError) {
      console.error('Error resetting track sources:', tracksError);
    }

    return res.status(200).json({
      success: true,
      message: 'Cleared all source URLs from all sets and reset track sources',
    });

  } catch (error) {
    console.error('Clear sources error:', error);
    return res.status(500).json({ error: error.message });
  }
}
