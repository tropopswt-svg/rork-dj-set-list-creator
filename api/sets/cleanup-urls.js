// API endpoint to clean up invalid URLs from sets
// Removes URLs that point to DJ profiles instead of actual tracklists
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// Check if a URL is an invalid DJ profile URL (not a tracklist)
function isInvalidUrl(url) {
  if (!url) return false;

  // DJ profile URLs that aren't useful for playback/analysis
  const invalidPatterns = [
    /1001tracklists\.com\/dj\//,  // DJ profile pages
    /1001tracklists\.com\/artist\//,  // Artist pages
    /1001tracklists\.com\/label\//,  // Label pages
  ];

  // Valid tracklist URL pattern
  const validTracklistPattern = /1001tracklists\.com\/tracklist\//;

  // If it's a 1001tracklists URL but not a tracklist page, it's invalid
  if (url.includes('1001tracklists.com')) {
    return !validTracklistPattern.test(url);
  }

  return false;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // GET: Preview what would be cleaned up
  if (req.method === 'GET') {
    try {
      const { data: sets, error } = await supabase
        .from('sets')
        .select('id, title, dj_name, tracklist_url, youtube_url, soundcloud_url')
        .not('tracklist_url', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const invalidSets = sets.filter(s => isInvalidUrl(s.tracklist_url));
      const validSets = sets.filter(s => !isInvalidUrl(s.tracklist_url));

      return res.status(200).json({
        success: true,
        preview: true,
        summary: {
          totalSets: sets.length,
          invalidUrls: invalidSets.length,
          validUrls: validSets.length,
        },
        invalidSets: invalidSets.map(s => ({
          id: s.id,
          title: s.title,
          dj_name: s.dj_name,
          tracklist_url: s.tracklist_url,
          has_youtube: !!s.youtube_url,
          has_soundcloud: !!s.soundcloud_url,
        })),
        message: 'POST to this endpoint to clean up invalid URLs',
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST: Actually clean up the invalid URLs
  if (req.method === 'POST') {
    try {
      // Get all sets with tracklist_url
      const { data: sets, error } = await supabase
        .from('sets')
        .select('id, tracklist_url')
        .not('tracklist_url', 'is', null);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const invalidSets = sets.filter(s => isInvalidUrl(s.tracklist_url));
      let cleaned = 0;
      const errors = [];

      for (const set of invalidSets) {
        const { error: updateError } = await supabase
          .from('sets')
          .update({ tracklist_url: null })
          .eq('id', set.id);

        if (updateError) {
          errors.push({ id: set.id, error: updateError.message });
        } else {
          cleaned++;
        }
      }

      return res.status(200).json({
        success: true,
        cleaned,
        total: invalidSets.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Cleaned ${cleaned} invalid URLs from sets`,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
