// API endpoint for user profiles
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { id } = req.query;

  try {
    // GET - Get user profile
    if (req.method === 'GET') {
      // Check if id is a username (starts with @) or UUID
      const isUsername = id.startsWith('@') || !id.includes('-');
      const lookupValue = id.startsWith('@') ? id.substring(1) : id;

      let query = supabase
        .from('profiles')
        .select('*');

      if (isUsername) {
        query = query.eq('username', lookupValue.toLowerCase());
      } else {
        query = query.eq('id', lookupValue);
      }

      const { data: profile, error } = await query.single();

      if (error || !profile) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if profile is public
      if (!profile.is_public) {
        // Check if requester is the profile owner
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.replace('Bearer ', '');
          const { data: { user } } = await supabase.auth.getUser(token);

          if (!user || user.id !== profile.id) {
            return res.status(403).json({ error: 'Profile is private' });
          }
        } else {
          return res.status(403).json({ error: 'Profile is private' });
        }
      }

      // Get recent contributions if allowed
      let contributions = [];
      if (profile.show_contributions) {
        const { data } = await supabase
          .from('contributions')
          .select(`
            *,
            set:sets(id, name, artist_name, cover_url)
          `)
          .eq('user_id', profile.id)
          .eq('status', 'verified')
          .order('created_at', { ascending: false })
          .limit(10);
        contributions = data || [];
      }

      // Get recent liked sets if allowed
      let likedSets = [];
      if (profile.show_favorites) {
        const { data } = await supabase
          .from('likes')
          .select(`
            *,
            set:sets(id, name, artist_name, cover_url, duration_seconds)
          `)
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(10);
        likedSets = data || [];
      }

      // Check if current user is following this profile
      let isFollowing = false;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);

        if (user) {
          const { data: follow } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', user.id)
            .eq('following_user_id', profile.id)
            .single();
          isFollowing = !!follow;
        }
      }

      return res.status(200).json({
        success: true,
        profile: {
          ...profile,
          contributions,
          likedSets,
        },
        isFollowing,
      });
    }

    // PUT - Update profile (auth required, can only update own profile)
    if (req.method === 'PUT') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Can only update own profile
      if (user.id !== id) {
        return res.status(403).json({ error: 'Can only update your own profile' });
      }

      const {
        display_name,
        bio,
        website,
        avatar_url,
        favorite_genres,
        is_public,
        show_contributions,
        show_favorites,
        push_notifications,
        email_notifications,
        weekly_digest,
      } = req.body;

      const updates = {};
      if (display_name !== undefined) updates.display_name = display_name;
      if (bio !== undefined) updates.bio = bio;
      if (website !== undefined) updates.website = website;
      if (avatar_url !== undefined) updates.avatar_url = avatar_url;
      if (favorite_genres !== undefined) updates.favorite_genres = favorite_genres;
      if (is_public !== undefined) updates.is_public = is_public;
      if (show_contributions !== undefined) updates.show_contributions = show_contributions;
      if (show_favorites !== undefined) updates.show_favorites = show_favorites;
      if (push_notifications !== undefined) updates.push_notifications = push_notifications;
      if (email_notifications !== undefined) updates.email_notifications = email_notifications;
      if (weekly_digest !== undefined) updates.weekly_digest = weekly_digest;

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, profile: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('User profile error:', error);
    return res.status(500).json({ error: error.message });
  }
}
