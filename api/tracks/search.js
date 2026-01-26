// API endpoint to search tracks from database
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

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const {
      q = '',
      limit = 20,
    } = req.query;

    if (!q || q.length < 2) {
      return res.status(200).json({
        success: true,
        tracks: [],
        message: 'Query too short',
      });
    }

    // Search tracks by title or artist
    // Using case-insensitive pattern matching
    const { data: tracks, error } = await supabase
      .from('tracks')
      .select('id, title, artist')
      .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
      .limit(parseInt(limit));

    if (error) {
      console.error('Track search error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Transform tracks for response
    const transformedTracks = tracks.map(track => ({
      id: track.id,
      title: track.title || 'Unknown Title',
      artist: track.artist || 'Unknown Artist',
    }));

    return res.status(200).json({
      success: true,
      tracks: transformedTracks,
      count: transformedTracks.length,
    });

  } catch (error) {
    console.error('Track search API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
