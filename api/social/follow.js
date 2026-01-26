// API endpoint for following/unfollowing users and artists
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

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
    // GET - Get following list
    if (req.method === 'GET') {
      const { type } = req.query; // 'users', 'artists', or 'all'

      let query = supabase
        .from('follows')
        .select(`
          *,
          following_user:profiles!following_user_id(id, username, display_name, avatar_url),
          following_artist:artists!following_artist_id(id, name, slug, image_url)
        `)
        .eq('follower_id', user.id)
        .order('created_at', { ascending: false });

      if (type === 'users') {
        query = query.not('following_user_id', 'is', null);
      } else if (type === 'artists') {
        query = query.not('following_artist_id', 'is', null);
      }

      const { data, error } = await query;

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, following: data });
    }

    // POST - Follow a user or artist
    if (req.method === 'POST') {
      const { user_id, artist_id } = req.body;

      if (!user_id && !artist_id) {
        return res.status(400).json({ error: 'Must provide user_id or artist_id' });
      }

      if (user_id && artist_id) {
        return res.status(400).json({ error: 'Cannot follow both user and artist at once' });
      }

      // Check if already following
      let existingQuery = supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id);

      if (user_id) {
        existingQuery = existingQuery.eq('following_user_id', user_id);
      } else {
        existingQuery = existingQuery.eq('following_artist_id', artist_id);
      }

      const { data: existing } = await existingQuery.single();

      if (existing) {
        return res.status(400).json({ error: 'Already following' });
      }

      // Create follow
      const { data, error } = await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          following_user_id: user_id || null,
          following_artist_id: artist_id || null,
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Create activity
      await supabase.from('activity').insert({
        user_id: user.id,
        activity_type: user_id ? 'follow_user' : 'follow_artist',
        target_user_id: user_id || null,
        artist_id: artist_id || null,
      });

      return res.status(201).json({ success: true, follow: data });
    }

    // DELETE - Unfollow a user or artist
    if (req.method === 'DELETE') {
      const { user_id, artist_id } = req.body;

      if (!user_id && !artist_id) {
        return res.status(400).json({ error: 'Must provide user_id or artist_id' });
      }

      let deleteQuery = supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id);

      if (user_id) {
        deleteQuery = deleteQuery.eq('following_user_id', user_id);
      } else {
        deleteQuery = deleteQuery.eq('following_artist_id', artist_id);
      }

      const { error } = await deleteQuery;

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Follow error:', error);
    return res.status(500).json({ error: error.message });
  }
}
