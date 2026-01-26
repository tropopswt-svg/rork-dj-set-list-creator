// API endpoint for comments on sets
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // GET - Get comments for a set (public, no auth required)
    if (req.method === 'GET') {
      const { set_id, limit = 50 } = req.query;

      if (!set_id) {
        return res.status(400).json({ error: 'set_id is required' });
      }

      // Get top-level comments
      const { data: comments, error } = await supabase
        .from('comments')
        .select(`
          *,
          user:profiles!user_id(id, username, display_name, avatar_url)
        `)
        .eq('set_id', set_id)
        .eq('is_deleted', false)
        .is('parent_id', null)
        .order('created_at', { ascending: true })
        .limit(parseInt(limit));

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Get replies for each comment
      for (const comment of comments || []) {
        const { data: replies } = await supabase
          .from('comments')
          .select(`
            *,
            user:profiles!user_id(id, username, display_name, avatar_url)
          `)
          .eq('parent_id', comment.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true });

        comment.replies = replies || [];
      }

      return res.status(200).json({ success: true, comments: comments || [] });
    }

    // Auth required for POST, PUT, DELETE
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // POST - Add a comment
    if (req.method === 'POST') {
      const { set_id, content, parent_id, timestamp_seconds } = req.body;

      if (!set_id || !content) {
        return res.status(400).json({ error: 'set_id and content are required' });
      }

      if (content.length > 1000) {
        return res.status(400).json({ error: 'Comment too long (max 1000 characters)' });
      }

      const { data, error } = await supabase
        .from('comments')
        .insert({
          user_id: user.id,
          set_id: set_id,
          content: content.trim(),
          parent_id: parent_id || null,
          timestamp_seconds: timestamp_seconds || null,
        })
        .select(`
          *,
          user:profiles!user_id(id, username, display_name, avatar_url)
        `)
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Create activity
      await supabase.from('activity').insert({
        user_id: user.id,
        activity_type: 'comment',
        set_id: set_id,
        comment_id: data.id,
        metadata: {
          content_preview: content.substring(0, 100),
          timestamp: timestamp_seconds,
        },
      });

      // If it's a reply, notify the parent comment author
      if (parent_id) {
        const { data: parentComment } = await supabase
          .from('comments')
          .select('user_id')
          .eq('id', parent_id)
          .single();

        if (parentComment && parentComment.user_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: parentComment.user_id,
            notification_type: 'comment_reply',
            from_user_id: user.id,
            set_id: set_id,
            comment_id: data.id,
            title: 'New reply to your comment',
            body: content.substring(0, 100),
          });
        }
      }

      return res.status(201).json({ success: true, comment: data });
    }

    // PUT - Edit a comment
    if (req.method === 'PUT') {
      const { comment_id, content } = req.body;

      if (!comment_id || !content) {
        return res.status(400).json({ error: 'comment_id and content are required' });
      }

      if (content.length > 1000) {
        return res.status(400).json({ error: 'Comment too long (max 1000 characters)' });
      }

      const { data, error } = await supabase
        .from('comments')
        .update({
          content: content.trim(),
          is_edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', comment_id)
        .eq('user_id', user.id) // Ensure user owns comment
        .select(`
          *,
          user:profiles!user_id(id, username, display_name, avatar_url)
        `)
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (!data) {
        return res.status(404).json({ error: 'Comment not found or not authorized' });
      }

      return res.status(200).json({ success: true, comment: data });
    }

    // DELETE - Delete a comment (soft delete)
    if (req.method === 'DELETE') {
      const { comment_id } = req.body;

      if (!comment_id) {
        return res.status(400).json({ error: 'comment_id is required' });
      }

      const { error } = await supabase
        .from('comments')
        .update({
          is_deleted: true,
          content: '[deleted]',
          updated_at: new Date().toISOString(),
        })
        .eq('id', comment_id)
        .eq('user_id', user.id);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Comments error:', error);
    return res.status(500).json({ error: error.message });
  }
}
