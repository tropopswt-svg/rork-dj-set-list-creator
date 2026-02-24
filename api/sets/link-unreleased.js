/**
 * POST /api/sets/link-unreleased
 *
 * Retroactively link set_tracks that are unreleased/ID tracks to entries
 * in the unreleased_tracks table, populating unreleased_identifications.
 *
 * Body: { setId?: string } — omit to process all sets
 *
 * Matching logic:
 * - For each set_track where is_unreleased=true or is_id=true
 * - Fuzzy-match title+artist against unreleased_tracks
 * - Insert into unreleased_identifications (skip duplicates)
 */

import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 120 };

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// Normalize a string for fuzzy matching
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if two strings are a fuzzy match (substring or close match)
function isFuzzyMatch(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { setId } = req.body || {};

  try {
    // 1. Fetch set_tracks that are unreleased or still ID'd
    let trackQuery = supabase
      .from('set_tracks')
      .select('id, set_id, title, artist, is_unreleased, is_id')
      .or('is_unreleased.eq.true,is_id.eq.true');

    if (setId) {
      trackQuery = trackQuery.eq('set_id', setId);
    }

    const { data: setTracks, error: trackError } = await trackQuery;
    if (trackError) return res.status(500).json({ error: trackError.message });

    console.log(`[Link Unreleased] Processing ${setTracks?.length || 0} set tracks`);

    // 2. Fetch all active unreleased tracks for matching
    const { data: unreleasedTracks, error: unreleasedError } = await supabase
      .from('unreleased_tracks')
      .select('id, title, artist')
      .neq('acrcloud_status', 'released_confirmed');

    if (unreleasedError) return res.status(500).json({ error: unreleasedError.message });

    console.log(`[Link Unreleased] Matching against ${unreleasedTracks?.length || 0} unreleased tracks`);

    // 3. Fetch existing identifications to avoid duplicates
    const { data: existingIds } = await supabase
      .from('unreleased_identifications')
      .select('unreleased_track_id, identified_in_set_id');

    const existingSet = new Set(
      (existingIds || []).map(r => `${r.unreleased_track_id}::${r.identified_in_set_id}`)
    );

    // 4. Match and insert
    const toInsert = [];

    for (const setTrack of (setTracks || [])) {
      if (!setTrack.title || setTrack.title.toLowerCase() === 'id') continue;

      for (const unreleased of (unreleasedTracks || [])) {
        const titleMatch = isFuzzyMatch(setTrack.title, unreleased.title);
        const artistMatch = isFuzzyMatch(setTrack.artist, unreleased.artist);

        if (titleMatch && artistMatch) {
          const key = `${unreleased.id}::${setTrack.set_id}`;
          if (!existingSet.has(key)) {
            toInsert.push({
              unreleased_track_id: unreleased.id,
              identified_in_set_id: setTrack.set_id,
              confidence: 0.7, // fuzzy match confidence
            });
            existingSet.add(key); // prevent duplicates within batch
            console.log(`[Link Unreleased] Matched: "${setTrack.title}" → unreleased track "${unreleased.title}"`);
            break; // one match per set_track is enough
          }
        }
      }
    }

    // 5. Bulk insert
    let inserted = 0;
    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('unreleased_identifications')
        .insert(toInsert);

      if (insertError) {
        console.error('[Link Unreleased] Insert error:', insertError);
        return res.status(500).json({ error: insertError.message });
      }
      inserted = toInsert.length;
    }

    console.log(`[Link Unreleased] Done. Inserted ${inserted} new links.`);

    return res.status(200).json({
      success: true,
      tracksChecked: setTracks?.length || 0,
      unreleasedPool: unreleasedTracks?.length || 0,
      linked: inserted,
    });
  } catch (err) {
    console.error('[Link Unreleased] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
