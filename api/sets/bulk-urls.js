// API endpoint to bulk update set URLs
// Allows mass-loading of YouTube/SoundCloud URLs to sets
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // GET: List sets that need URLs
  if (req.method === 'GET') {
    try {
      const { missing = 'any', limit = 100 } = req.query;

      let query = supabase
        .from('sets')
        .select('id, title, dj_name, youtube_url, soundcloud_url, tracklist_url')
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));

      // Filter by what's missing
      if (missing === 'youtube') {
        query = query.is('youtube_url', null);
      } else if (missing === 'soundcloud') {
        query = query.is('soundcloud_url', null);
      } else if (missing === 'both') {
        query = query.is('youtube_url', null).is('soundcloud_url', null);
      } else if (missing === 'any') {
        // Sets missing at least one source
        query = query.or('youtube_url.is.null,soundcloud_url.is.null');
      }

      const { data: sets, error } = await query;

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        sets: sets.map(s => ({
          id: s.id,
          title: s.title,
          dj_name: s.dj_name,
          youtube_url: s.youtube_url,
          soundcloud_url: s.soundcloud_url,
          tracklist_url: s.tracklist_url,
          needs: {
            youtube: !s.youtube_url,
            soundcloud: !s.soundcloud_url,
          },
        })),
        total: sets.length,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST: Bulk update URLs
  if (req.method === 'POST') {
    try {
      const { updates } = req.body;

      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ error: 'updates array is required' });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [],
      };

      for (const update of updates) {
        const { id, youtube_url, soundcloud_url, mixcloud_url, spotify_url, apple_music_url } = update;

        if (!id) {
          results.failed++;
          results.errors.push({ id: null, error: 'Missing set id' });
          continue;
        }

        // Build update object with only provided fields
        const updateData = {};
        if (youtube_url !== undefined) updateData.youtube_url = youtube_url;
        if (soundcloud_url !== undefined) updateData.soundcloud_url = soundcloud_url;
        if (mixcloud_url !== undefined) updateData.mixcloud_url = mixcloud_url;
        if (spotify_url !== undefined) updateData.spotify_url = spotify_url;
        if (apple_music_url !== undefined) updateData.apple_music_url = apple_music_url;

        if (Object.keys(updateData).length === 0) {
          results.failed++;
          results.errors.push({ id, error: 'No URLs provided to update' });
          continue;
        }

        const { error } = await supabase
          .from('sets')
          .update(updateData)
          .eq('id', id);

        if (error) {
          results.failed++;
          results.errors.push({ id, error: error.message });
        } else {
          results.success++;
        }
      }

      return res.status(200).json({
        success: true,
        results,
        message: `Updated ${results.success} sets, ${results.failed} failed`,
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
