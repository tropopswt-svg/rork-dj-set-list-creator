// API endpoint: /api/sets/similar?setId=xxx
// Finds similar sets based on shared tracks, same artist, or same venue

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { setId } = req.query;

  if (!setId) {
    return res.status(400).json({ success: false, error: 'setId is required' });
  }

  const supabase = getSupabase();

  try {
    // Get the current set details
    const { data: currentSet, error: setError } = await supabase
      .from('sets')
      .select('id, title, name, artist_id, venue, artists(name)')
      .eq('id', setId)
      .single();

    if (setError || !currentSet) {
      return res.status(404).json({ success: false, error: 'Set not found' });
    }

    // Get tracks in this set
    const { data: currentTracks } = await supabase
      .from('set_tracks')
      .select('track_id')
      .eq('set_id', setId)
      .not('track_id', 'is', null);

    const trackIds = (currentTracks || []).map(t => t.track_id).filter(Boolean);

    // Score-based similarity scoring
    const scoreMap = new Map(); // setId -> { score, reasons[] }

    // 1. Find sets sharing tracks (10 pts per shared track)
    if (trackIds.length > 0) {
      const { data: sharedSets } = await supabase
        .from('set_tracks')
        .select('set_id, track_id')
        .in('track_id', trackIds)
        .neq('set_id', setId);

      if (sharedSets) {
        const grouped = {};
        for (const row of sharedSets) {
          if (!grouped[row.set_id]) grouped[row.set_id] = 0;
          grouped[row.set_id]++;
        }
        for (const [id, count] of Object.entries(grouped)) {
          const existing = scoreMap.get(id) || { score: 0, reasons: [] };
          existing.score += count * 10;
          existing.reasons.push(`${count} shared track${count > 1 ? 's' : ''}`);
          scoreMap.set(id, existing);
        }
      }
    }

    // 2. Find sets by same artist (5 pts)
    if (currentSet.artist_id) {
      const { data: artistSets } = await supabase
        .from('sets')
        .select('id')
        .eq('artist_id', currentSet.artist_id)
        .neq('id', setId)
        .limit(20);

      if (artistSets) {
        for (const s of artistSets) {
          const existing = scoreMap.get(s.id) || { score: 0, reasons: [] };
          existing.score += 5;
          existing.reasons.push('Same artist');
          scoreMap.set(s.id, existing);
        }
      }
    }

    // 3. Find sets at same venue (3 pts)
    if (currentSet.venue) {
      const { data: venueSets } = await supabase
        .from('sets')
        .select('id')
        .eq('venue', currentSet.venue)
        .neq('id', setId)
        .limit(20);

      if (venueSets) {
        for (const s of venueSets) {
          const existing = scoreMap.get(s.id) || { score: 0, reasons: [] };
          existing.score += 3;
          existing.reasons.push('Same venue');
          scoreMap.set(s.id, existing);
        }
      }
    }

    // Sort by score and take top 6
    const topIds = [...scoreMap.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 6)
      .map(([id, data]) => ({ id, ...data }));

    if (topIds.length === 0) {
      return res.status(200).json({ success: true, similarSets: [] });
    }

    // Fetch full set details for top matches
    const { data: fullSets } = await supabase
      .from('sets')
      .select('id, title, name, venue, event_date, cover_url, youtube_url, artists(name), track_count')
      .in('id', topIds.map(t => t.id));

    const similarSets = topIds.map(match => {
      const set = (fullSets || []).find(s => s.id === match.id);
      if (!set) return null;

      return {
        id: set.id,
        name: set.title || set.name,
        artist: set.artists?.name || 'Unknown Artist',
        venue: set.venue,
        date: set.event_date,
        coverUrl: set.cover_url || (set.youtube_url
          ? `https://img.youtube.com/vi/${set.youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]}/mqdefault.jpg`
          : null),
        trackCount: set.track_count || 0,
        score: match.score,
        reason: match.reasons[0], // Primary reason
      };
    }).filter(Boolean);

    return res.status(200).json({ success: true, similarSets });
  } catch (error) {
    console.error('[similar] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
