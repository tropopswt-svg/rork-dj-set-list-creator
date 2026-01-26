// API endpoint for liking/unliking sets
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
    // GET - Get user's liked sets
    if (req.method === 'GET') {
      const { set_id } = req.query;

      // If set_id provided, check if user liked that set
      if (set_id) {
        const { data } = await supabase
          .from('likes')
          .select('id')
          .eq('user_id', user.id)
          .eq('set_id', set_id)
          .single();

        return res.status(200).json({ success: true, liked: !!data });
      }

      // Otherwise, get all liked sets
      const { data, error } = await supabase
        .from('likes')
        .select(`
          *,
          set:sets(id, name, artist_name, cover_url, duration_seconds, tracks_count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, likes: data });
    }

    // POST - Like a set
    if (req.method === 'POST') {
      const { set_id } = req.body;

      if (!set_id) {
        return res.status(400).json({ error: 'set_id is required' });
      }

      // Check if already liked
      const { data: existing } = await supabase
        .from('likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('set_id', set_id)
        .single();

      if (existing) {
        return res.status(400).json({ error: 'Already liked' });
      }

      // Create like
      const { data, error } = await supabase
        .from('likes')
        .insert({
          user_id: user.id,
          set_id: set_id,
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Create activity
      await supabase.from('activity').insert({
        user_id: user.id,
        activity_type: 'like_set',
        set_id: set_id,
      });

      return res.status(201).json({ success: true, like: data });
    }

    // DELETE - Unlike a set
    if (req.method === 'DELETE') {
      const { set_id } = req.body;

      if (!set_id) {
        return res.status(400).json({ error: 'set_id is required' });
      }

      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('set_id', set_id);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Like error:', error);
    return res.status(500).json({ error: error.message });
  }
}
