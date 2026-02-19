// API endpoint: /api/sessions
// List and create listening sessions

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export default async function handler(req, res) {
  const supabase = getSupabase();

  try {
    if (req.method === 'GET') {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }

      const { data, error } = await supabase
        .from('listening_sessions')
        .select('*, session_tracks(*)')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return res.status(200).json({ success: true, sessions: data || [] });
    }

    if (req.method === 'POST') {
      const { userId, title } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }

      const { data, error } = await supabase
        .from('listening_sessions')
        .insert({
          user_id: userId,
          title: title || `Live Session - ${new Date().toLocaleString()}`,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ success: true, session: data });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[sessions] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
