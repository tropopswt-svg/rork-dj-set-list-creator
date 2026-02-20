// API endpoint to add a source URL to a set
import { createClient } from '@supabase/supabase-js';

// Use service role key for server-side write operations (bypasses RLS)
function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const { setId, url, platform } = req.body;

    if (!setId) {
      return res.status(400).json({ error: 'setId is required' });
    }

    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    if (!platform || !['youtube', 'soundcloud', 'mixcloud'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be youtube, soundcloud, or mixcloud' });
    }

    // Check if set exists
    const { data: set, error: setError } = await supabase
      .from('sets')
      .select('id, youtube_url, soundcloud_url, mixcloud_url')
      .eq('id', setId)
      .single();

    if (setError || !set) {
      return res.status(404).json({ error: 'Set not found' });
    }

    // If source already exists, update it
    const urlField = `${platform}_url`;
    if (set[urlField] && set[urlField] === url) {
      return res.status(200).json({ success: true, message: `${platform} link already set`, setId, platform, url });
    }

    // Generate a cover image URL from the source if the set doesn't have one
    const update = { [urlField]: url };

    // Check if set already has a cover_url
    const { data: currentSet } = await supabase
      .from('sets')
      .select('cover_url')
      .eq('id', setId)
      .single();

    if (!currentSet?.cover_url) {
      if (platform === 'youtube') {
        // Extract YouTube video ID and generate thumbnail
        const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        if (videoIdMatch) {
          update.cover_url = `https://img.youtube.com/vi/${videoIdMatch[1]}/maxresdefault.jpg`;
        }
      } else if (platform === 'soundcloud') {
        // Try to fetch SoundCloud thumbnail via oEmbed
        try {
          const oembedRes = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`);
          if (oembedRes.ok) {
            const oembed = await oembedRes.json();
            if (oembed.thumbnail_url) {
              update.cover_url = oembed.thumbnail_url.replace('-large', '-t500x500');
            }
          }
        } catch (e) {
          // SoundCloud thumbnail fetch failed, skip
        }
      }
    }

    const { error: updateError } = await supabase
      .from('sets')
      .update(update)
      .eq('id', setId);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({
      success: true,
      message: `Added ${platform} source to set`,
      setId,
      platform,
      url,
    });

  } catch (error) {
    console.error('Add source error:', error);
    return res.status(500).json({ error: error.message });
  }
}
