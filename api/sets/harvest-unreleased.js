// API endpoint to harvest unreleased/unidentified tracks from sets into the unreleased_tracks catalog
// POST /api/sets/harvest-unreleased
// Actions: harvest-set (single set), harvest-all (batch all sets)
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();
}

async function findSimilarTrack(supabase, title, artist) {
  const normalizedTitle = title.toLowerCase().trim();
  const normalizedArtist = artist.toLowerCase().trim();

  // Try exact match first
  const { data: exactMatch } = await supabase
    .from('unreleased_tracks')
    .select('*')
    .ilike('title', normalizedTitle)
    .ilike('artist', normalizedArtist)
    .limit(1)
    .single();

  if (exactMatch) return exactMatch;

  // Try partial match on title + artist containment
  const { data: partialMatches } = await supabase
    .from('unreleased_tracks')
    .select('*')
    .or(`title.ilike.%${normalizedTitle.substring(0, 20)}%`)
    .limit(20);

  if (!partialMatches || partialMatches.length === 0) return null;

  for (const track of partialMatches) {
    const trackArtist = (track.artist || '').toLowerCase();
    if (trackArtist.includes(normalizedArtist) || normalizedArtist.includes(trackArtist)) {
      return track;
    }
  }

  return null;
}

async function recordIdentification(supabase, unreleasedTrackId, setId, confidence) {
  // Check for duplicate identification
  const { data: existing } = await supabase
    .from('unreleased_identifications')
    .select('id')
    .eq('unreleased_track_id', unreleasedTrackId)
    .eq('identified_in_set_id', setId)
    .limit(1)
    .single();

  if (existing) return existing;

  const { data: identification, error } = await supabase
    .from('unreleased_identifications')
    .insert({
      unreleased_track_id: unreleasedTrackId,
      identified_in_set_id: setId,
      confidence,
    })
    .select()
    .single();

  if (error) {
    console.error('[harvest] Error recording identification:', error);
    return null;
  }

  // Increment times_identified
  await supabase.rpc('increment_times_identified', { track_id: unreleasedTrackId }).catch(() => {
    // Fallback if RPC doesn't exist: read-then-write
    supabase
      .from('unreleased_tracks')
      .select('times_identified')
      .eq('id', unreleasedTrackId)
      .single()
      .then(({ data }) => {
        if (data) {
          supabase
            .from('unreleased_tracks')
            .update({
              times_identified: (data.times_identified || 0) + 1,
              last_identified_at: new Date().toISOString(),
            })
            .eq('id', unreleasedTrackId)
            .then(() => {});
        }
      });
  });

  return identification;
}

async function harvestSetTracks(supabase, setId) {
  // Get unreleased/unidentified tracks from this set
  const { data: tracks, error } = await supabase
    .from('set_tracks')
    .select('id, track_title, artist_name, is_unreleased, is_id, spotify_data, set_id')
    .eq('set_id', setId)
    .or('is_unreleased.eq.true,and(is_id.eq.true,spotify_data.is.null)')
    .order('position');

  if (error) {
    console.error('[harvest] Error fetching set tracks:', error);
    return { created: 0, matched: 0, skipped: 0, errors: 0 };
  }

  let created = 0;
  let matched = 0;
  let skipped = 0;
  let errors = 0;

  for (const track of tracks || []) {
    const title = track.track_title;
    const artist = track.artist_name;

    // Skip tracks without title/artist
    if (!title || !artist || /^(id|unknown|unknown track|tba|tbc)$/i.test(title)) {
      skipped++;
      continue;
    }

    try {
      // Dedup: check if this track already exists in the unreleased catalog
      const existing = await findSimilarTrack(supabase, title, artist);

      if (existing) {
        // Track exists — record cross-set identification
        await recordIdentification(supabase, existing.id, setId, 0.8);
        matched++;
      } else {
        // Create new unreleased_tracks entry
        const { data: newTrack, error: createError } = await supabase
          .from('unreleased_tracks')
          .insert({
            title,
            artist,
            source_platform: 'manual',
            source_url: `set_import:${setId}:${track.id}`,
            confidence_score: 0.5,
            metadata: {
              harvested_from_set: setId,
              harvested_from_set_track: track.id,
              harvest_source: track.is_unreleased ? 'unreleased_flag' : 'unidentified',
            },
          })
          .select()
          .single();

        if (createError) {
          // May be duplicate source_url — try to find and link
          if (createError.code === '23505') {
            matched++;
          } else {
            console.error('[harvest] Error creating track:', createError);
            errors++;
          }
          continue;
        }

        // Record the initial identification
        if (newTrack) {
          await recordIdentification(supabase, newTrack.id, setId, 0.5);
          created++;
        }
      }
    } catch (err) {
      console.error('[harvest] Error processing track:', title, err);
      errors++;
    }
  }

  return { created, matched, skipped, errors };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      description: 'POST to harvest unreleased tracks from sets into the unreleased catalog.',
      actions: ['harvest-set', 'harvest-all'],
      usage: {
        'harvest-set': '{ "action": "harvest-set", "setId": "uuid" }',
        'harvest-all': '{ "action": "harvest-all", "limit": 100 }',
      },
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const { action = 'harvest-set', setId, limit = 100 } = req.body || {};

    // ========== HARVEST SET — single set ==========
    if (action === 'harvest-set') {
      if (!setId) return res.status(400).json({ error: 'setId is required' });

      const stats = await harvestSetTracks(supabase, setId);

      return res.status(200).json({
        success: true,
        action: 'harvest-set',
        setId,
        ...stats,
      });
    }

    // ========== HARVEST ALL — batch across all sets ==========
    if (action === 'harvest-all') {
      // Find sets that have unreleased or unidentified tracks
      const { data: setIds, error: setsError } = await supabase
        .from('set_tracks')
        .select('set_id')
        .or('is_unreleased.eq.true,and(is_id.eq.true,spotify_data.is.null)')
        .limit(5000);

      if (setsError) throw setsError;

      // Deduplicate set IDs
      const uniqueSetIds = [...new Set((setIds || []).map(r => r.set_id))];
      const setsToProcess = uniqueSetIds.slice(0, parseInt(limit));

      let totalCreated = 0;
      let totalMatched = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      let setsProcessed = 0;

      for (const sid of setsToProcess) {
        const stats = await harvestSetTracks(supabase, sid);
        totalCreated += stats.created;
        totalMatched += stats.matched;
        totalSkipped += stats.skipped;
        totalErrors += stats.errors;
        setsProcessed++;
      }

      return res.status(200).json({
        success: true,
        action: 'harvest-all',
        setsFound: uniqueSetIds.length,
        setsProcessed,
        created: totalCreated,
        matched: totalMatched,
        skipped: totalSkipped,
        errors: totalErrors,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (error) {
    console.error('Harvest unreleased error:', error);
    return res.status(500).json({ error: error.message });
  }
}
