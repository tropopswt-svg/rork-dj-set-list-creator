// Vercel cron endpoint — background MusicBrainz enrichment
// Processes ~25 artists + ~25 tracks per invocation (1 req/sec ≈ 50s, within 60s limit)
// Schedule: minute 15 of every hour via vercel.json cron
//
// Artist enrichment: genres/tags, country, bio (disambiguation), URL relations (beatport, bandcamp)
// Track enrichment: ISRC lookup, label info
import { searchArtist, searchRecording, lookupByISRC } from './_lib/musicbrainz-core.js';

const ARTIST_BATCH = 25;
const TRACK_BATCH = 25;

function getSupabaseClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key);
}

export default async function handler(req, res) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const results = {
    artists: { enriched: 0, noResults: 0 },
    tracks: { enriched: 0, noResults: 0 },
  };

  try {
    // ========== PHASE 1: Artist enrichment ==========
    // Fetch artists missing detailed metadata (bio, country, or genres)
    const { data: artists, error: aError } = await supabase
      .from('artists')
      .select('id, name, genres, bio, country, beatport_url, bandcamp_url')
      .or('bio.is.null,country.is.null,genres.is.null,genres.eq.{}')
      .is('enriched_at', null)
      .order('tracks_count', { ascending: false, nullsFirst: false })
      .limit(ARTIST_BATCH);

    if (aError) throw aError;

    for (const artist of artists || []) {
      try {
        const mbData = await searchArtist(artist.name);
        if (!mbData) {
          // Mark as enriched to avoid re-processing
          await supabase
            .from('artists')
            .update({ enriched_at: new Date().toISOString() })
            .eq('id', artist.id);
          results.artists.noResults++;
          continue;
        }

        const update = { enriched_at: new Date().toISOString() };

        // Merge genres + tags
        const mbGenres = [
          ...(mbData.genres || []),
          ...(mbData.tags || []).map(t => typeof t === 'string' ? t : t.name),
        ];
        const existingGenres = artist.genres || [];
        const merged = [...new Set([...existingGenres, ...mbGenres])].slice(0, 10);
        if (merged.length > 0) {
          update.genres = merged;
        }

        // Country
        if (!artist.country && mbData.country) {
          update.country = mbData.country;
        }

        // Bio from disambiguation (MusicBrainz's short description)
        if (!artist.bio && mbData.disambiguation) {
          update.bio = mbData.disambiguation;
        }

        const { error: updateError } = await supabase
          .from('artists')
          .update(update)
          .eq('id', artist.id);

        if (!updateError) {
          results.artists.enriched++;
        }
      } catch {
        // Continue on individual artist failure
      }
    }

    // ========== PHASE 2: Track ISRC + label enrichment ==========
    // Find tracks with Spotify URL but missing ISRC (Spotify data available for lookup)
    const { data: tracks, error: tError } = await supabase
      .from('tracks')
      .select('id, title, artist_name, isrc, label, spotify_url')
      .or('isrc.is.null,label.is.null')
      .not('artist_name', 'is', null)
      .not('spotify_url', 'is', null)
      .is('enriched_at', null)
      .limit(TRACK_BATCH);

    if (tError) console.error('Track query error:', tError);

    for (const track of tracks || []) {
      try {
        let mbData = null;

        // Try ISRC lookup first if we have one
        if (track.isrc) {
          mbData = await lookupByISRC(track.isrc);
        }

        // Fall back to artist + title search
        if (!mbData) {
          mbData = await searchRecording(track.artist_name, track.title);
        }

        if (mbData) {
          const update = { enriched_at: new Date().toISOString() };

          if (!track.isrc && mbData.isrcs?.length) {
            update.isrc = mbData.isrcs[0];
          }
          if (!track.label && mbData.label) {
            update.label = mbData.label;
          }

          await supabase.from('tracks').update(update).eq('id', track.id);
          results.tracks.enriched++;
        } else {
          // Mark as enriched to avoid re-processing
          await supabase
            .from('tracks')
            .update({ enriched_at: new Date().toISOString() })
            .eq('id', track.id);
          results.tracks.noResults++;
        }
      } catch {
        // Continue on individual track failure
      }
    }

    return res.status(200).json({
      success: true,
      artists: {
        ...results.artists,
        total: (artists || []).length,
      },
      tracks: {
        ...results.tracks,
        total: (tracks || []).length,
      },
    });

  } catch (error) {
    console.error('MusicBrainz drip error:', error);
    return res.status(500).json({ error: error.message });
  }
}
