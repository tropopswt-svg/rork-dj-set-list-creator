import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // GET — return waitlist count
  if (req.method === 'GET') {
    try {
      const { count, error } = await supabase
        .from('waitlist')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      return res.status(200).json({ count: count || 0 });
    } catch (error) {
      console.error('[Waitlist] Count error:', error);
      return res.status(500).json({ error: 'Failed to fetch count' });
    }
  }

  // POST — add email to waitlist
  if (req.method === 'POST') {
    try {
      const { email, name, city, source } = req.body || {};

      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      const row = { email: email.toLowerCase().trim(), source: source || 'direct' };
      if (name) row.name = name.trim();
      if (city) row.city = city.trim();

      const { data, error } = await supabase
        .from('waitlist')
        .upsert(row, { onConflict: 'email' })
        .select();

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('[Waitlist] Signup error:', error);
      return res.status(500).json({ error: 'Failed to join waitlist' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
