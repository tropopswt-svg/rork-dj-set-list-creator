// API endpoint to list sets from database
import { createClient } from '@supabase/supabase-js';

// Extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Generate YouTube thumbnail URL from video ID
function getYouTubeThumbnail(videoId) {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

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
      limit = 20,
      offset = 0,
      dj,
      search,
      sort = 'recent' // 'recent' or 'popular'
    } = req.query;

    let query = supabase
      .from('sets')
      .select('*, artists:dj_id(image_url)', { count: 'exact' });

    // Filter by DJ
    if (dj) {
      query = query.ilike('dj_name', `%${dj}%`);
    }

    // Search by title, DJ, or venue
    if (search) {
      query = query.or(`title.ilike.%${search}%,dj_name.ilike.%${search}%,venue.ilike.%${search}%`);
    }

    // Sort
    if (sort === 'popular') {
      query = query.order('track_count', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: sets, error, count } = await query;

    if (error) {
      console.error('Sets query error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Transform to match app's SetList type
    const transformedSets = sets.map(set => {
      // Use stored cover_url first, then fall back to YouTube thumbnail
      const youtubeVideoId = extractYouTubeVideoId(set.youtube_url);
      const coverUrl = set.cover_url || getYouTubeThumbnail(youtubeVideoId);

      return {
        id: set.id,
        name: set.title,
        artist: set.dj_name || 'Unknown Artist',
        artistImageUrl: set.artists?.image_url || null,
        venue: set.venue || null,
        location: set.location || null,
        date: set.event_date || set.created_at,
        totalDuration: set.duration_seconds || 0,
        trackCount: set.track_count || 0,
        coverUrl,
        sourceLinks: [
          set.tracklist_url && { platform: '1001tracklists', url: set.tracklist_url },
          set.youtube_url && { platform: 'youtube', url: set.youtube_url },
          set.soundcloud_url && { platform: 'soundcloud', url: set.soundcloud_url },
          set.mixcloud_url && { platform: 'mixcloud', url: set.mixcloud_url },
        ].filter(Boolean),
        source: set.source,
        hasGaps: false,
      };
    });

    return res.status(200).json({
      success: true,
      sets: transformedSets,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

  } catch (error) {
    console.error('Sets API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
