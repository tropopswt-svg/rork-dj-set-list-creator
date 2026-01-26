// API endpoint for activity feed
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // Get auth token from header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { limit = 50, offset = 0 } = req.query;

    // Get user's following list
    const { data: following } = await supabase
      .from('follows')
      .select('following_user_id, following_artist_id')
      .eq('follower_id', user.id);

    if (!following || following.length === 0) {
      return res.status(200).json({
        success: true,
        feed: [],
        message: 'Follow users or artists to see their activity'
      });
    }

    const followedUserIds = following
      .filter(f => f.following_user_id)
      .map(f => f.following_user_id);

    const followedArtistIds = following
      .filter(f => f.following_artist_id)
      .map(f => f.following_artist_id);

    // Build activity query - only show sets + contributions (per user preference)
    let query = supabase
      .from('activity')
      .select(`
        *,
        user:profiles!user_id(id, username, display_name, avatar_url),
        set:sets(id, name, artist_name, cover_url, duration_seconds, tracks_count),
        artist:artists(id, name, slug, image_url),
        target_user:profiles!target_user_id(id, username, display_name, avatar_url)
      `)
      .in('activity_type', ['track_id', 'new_set'])
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Filter by followed users OR artists with new sets
    if (followedUserIds.length > 0 && followedArtistIds.length > 0) {
      query = query.or(`user_id.in.(${followedUserIds.join(',')}),artist_id.in.(${followedArtistIds.join(',')})`);
    } else if (followedUserIds.length > 0) {
      query = query.in('user_id', followedUserIds);
    } else if (followedArtistIds.length > 0) {
      query = query.in('artist_id', followedArtistIds);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Also get new sets from followed artists (even if no activity entry)
    const { data: artistSets } = await supabase
      .from('sets')
      .select('*')
      .in('artist_id', followedArtistIds.length > 0 ? followedArtistIds : ['none'])
      .order('created_at', { ascending: false })
      .limit(20);

    // Merge and deduplicate
    const feedItems = data || [];

    // Add artist sets that aren't already in the feed
    if (artistSets) {
      const existingSetIds = new Set(feedItems.filter(f => f.set_id).map(f => f.set_id));
      for (const set of artistSets) {
        if (!existingSetIds.has(set.id)) {
          feedItems.push({
            id: `set-${set.id}`,
            activity_type: 'new_set',
            set_id: set.id,
            artist_id: set.artist_id,
            created_at: set.created_at,
            set: set,
            user: null,
            metadata: {},
          });
        }
      }
    }

    // Sort by date
    feedItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({
      success: true,
      feed: feedItems.slice(0, parseInt(limit)),
      hasMore: feedItems.length > parseInt(limit),
    });

  } catch (error) {
    console.error('Feed error:', error);
    return res.status(500).json({ error: error.message });
  }
}
