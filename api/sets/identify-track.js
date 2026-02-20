// API endpoint to identify an unknown track
import { createClient } from '@supabase/supabase-js';
import { cleanTrackTitleUnreleased } from '../_lib/track-utils.js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseKey = serviceKey || anonKey;

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
    const { setId, trackId, artist, title, contributedBy } = req.body;

    if (!setId || !trackId) {
      return res.status(400).json({ error: 'setId and trackId are required' });
    }

    if (!artist || !title) {
      return res.status(400).json({ error: 'artist and title are required' });
    }

    // Update the track with the identification
    const { title: cleanTitle, isUnreleased } = cleanTrackTitleUnreleased(title);
    const updateData = {
      artist_name: artist,
      track_title: cleanTitle,
      is_id: false,
      source: 'user',
      contributed_by: contributedBy || 'Community',
      updated_at: new Date().toISOString(),
    };
    if (isUnreleased) {
      updateData.is_unreleased = true;
      updateData.unreleased_source = 'comment_hint';
    }
    const { data: updatedTrack, error: updateError } = await supabase
      .from('set_tracks')
      .update(updateData)
      .eq('id', trackId)
      .eq('set_id', setId)
      .select()
      .single();

    if (updateError) {
      console.error('[Identify Track] Update error:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    console.log(`[Identify Track] Updated track ${trackId} to "${title}" by "${artist}"`);

    return res.status(200).json({
      success: true,
      message: 'Track identified successfully',
      track: updatedTrack,
    });

  } catch (error) {
    console.error('Identify track error:', error);
    return res.status(500).json({ error: error.message });
  }
}
