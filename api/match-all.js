// API endpoint to bulk match all set_tracks against the tracks database
// This links tracks from sets to verified tracks in the database

import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '')     // Remove special chars
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();
}

// Calculate similarity between two strings (0-1)
function similarity(str1, str2) {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);

  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  // Simple word overlap scoring
  const words1 = s1.split(' ').filter(w => w.length > 2);
  const words2 = s2.split(' ').filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  let matches = 0;
  for (const w1 of words1) {
    if (words2.some(w2 => w2.includes(w1) || w1.includes(w2))) {
      matches++;
    }
  }

  return matches / Math.max(words1.length, words2.length);
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

  // GET = dry run, POST = actually update
  const dryRun = req.method === 'GET';

  try {
    const results = {
      dryRun,
      totalSetTracks: 0,
      alreadyLinked: 0,
      matched: 0,
      unmatched: 0,
      updated: 0,
      matches: [],
      unmatched_samples: [],
    };

    // Get all set_tracks
    const { data: setTracks, error: stError } = await supabase
      .from('set_tracks')
      .select('id, set_id, track_id, track_title, artist_name, is_id')
      .order('created_at', { ascending: false });

    if (stError) {
      return res.status(500).json({ error: stError.message });
    }

    results.totalSetTracks = setTracks?.length || 0;

    // Get all tracks from database for matching
    const { data: dbTracks, error: tError } = await supabase
      .from('tracks')
      .select('id, title, title_normalized, artist_name, label, bpm, key');

    if (tError) {
      return res.status(500).json({ error: tError.message });
    }

    console.log(`[Match All] ${setTracks?.length} set tracks, ${dbTracks?.length} db tracks`);

    // Build lookup map for faster matching
    const trackMap = new Map();
    for (const track of dbTracks || []) {
      const key = `${normalizeText(track.title)}|${normalizeText(track.artist_name)}`;
      trackMap.set(key, track);

      // Also add just title for fuzzy matching
      const titleKey = normalizeText(track.title);
      if (!trackMap.has(`title:${titleKey}`)) {
        trackMap.set(`title:${titleKey}`, track);
      }
    }

    // Match each set track
    for (const setTrack of setTracks || []) {
      // Skip if already linked
      if (setTrack.track_id) {
        results.alreadyLinked++;
        continue;
      }

      // Skip if no title
      if (!setTrack.track_title) {
        results.unmatched++;
        continue;
      }

      const titleNorm = normalizeText(setTrack.track_title);
      const artistNorm = normalizeText(setTrack.artist_name);

      // Try exact match first
      const exactKey = `${titleNorm}|${artistNorm}`;
      let matchedTrack = trackMap.get(exactKey);

      // Try title-only match if no exact match
      if (!matchedTrack) {
        matchedTrack = trackMap.get(`title:${titleNorm}`);
      }

      // Try fuzzy match on title
      if (!matchedTrack && titleNorm.length > 3) {
        for (const track of dbTracks || []) {
          const titleSim = similarity(setTrack.track_title, track.title);
          const artistSim = similarity(setTrack.artist_name || '', track.artist_name || '');

          // High title match + some artist match
          if (titleSim > 0.8 && artistSim > 0.5) {
            matchedTrack = track;
            break;
          }
          // Very high title match alone
          if (titleSim > 0.95) {
            matchedTrack = track;
            break;
          }
        }
      }

      if (matchedTrack) {
        results.matched++;

        const matchInfo = {
          setTrackId: setTrack.id,
          setTrackTitle: setTrack.track_title,
          setTrackArtist: setTrack.artist_name,
          matchedTo: {
            id: matchedTrack.id,
            title: matchedTrack.title,
            artist: matchedTrack.artist_name,
            label: matchedTrack.label,
          },
        };

        if (!dryRun) {
          // Update the set_track with the matched track_id
          const { error: updateError } = await supabase
            .from('set_tracks')
            .update({
              track_id: matchedTrack.id,
              is_id: false, // It's now a known/verified track
            })
            .eq('id', setTrack.id);

          if (!updateError) {
            results.updated++;
          }
        }

        // Only store first 50 matches for response
        if (results.matches.length < 50) {
          results.matches.push(matchInfo);
        }
      } else {
        results.unmatched++;

        // Store sample of unmatched for debugging
        if (results.unmatched_samples.length < 20) {
          results.unmatched_samples.push({
            title: setTrack.track_title,
            artist: setTrack.artist_name,
            is_id: setTrack.is_id,
          });
        }
      }
    }

    // Summary
    console.log(`[Match All] Results: ${results.matched} matched, ${results.unmatched} unmatched, ${results.updated} updated`);

    return res.status(200).json({
      success: true,
      ...results,
      summary: {
        total: results.totalSetTracks,
        alreadyLinked: results.alreadyLinked,
        newlyMatched: results.matched,
        stillUnmatched: results.unmatched,
        updated: results.updated,
      },
    });

  } catch (error) {
    console.error('Match all error:', error);
    return res.status(500).json({ error: error.message });
  }
}
