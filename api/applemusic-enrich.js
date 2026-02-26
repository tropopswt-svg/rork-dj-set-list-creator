// API endpoint to enrich tracks with Apple Music data
// POST /api/applemusic-enrich
// Actions: enrich-set (enrich all tracks in a set), enrich-batch (batch enrich tracks)
// ISRC-first lookup for exact matches, text search as fallback
import { getSupabaseClient } from './_lib/spotify-core.js';
import { getAppleMusicToken, lookupByISRC, searchTrackOnAppleMusic } from './_lib/applemusic-core.js';
import { rateLimit } from './_lib/rate-limit.js';
import { checkAppleMusicCache, writeAppleMusicCache, canMakeAppleMusicRequest, recordAppleMusicRateLimit, generateLookupKey } from './_lib/applemusic-cache.js';

const DELAY_MS = 500; // 500ms between calls — Apple Music has generous limits

/**
 * Merge Apple Music data into existing spotify_data JSONB.
 * ADDITIVE — never overwrites Spotify fields.
 * Flags isrc_conflict: true on ISRC mismatch.
 */
function mergeAppleMusicData(existingSpotifyData, appleMusicData) {
  const merged = { ...(existingSpotifyData || {}) };

  // Core Apple Music fields — always set
  merged.apple_music_id = appleMusicData.apple_music_id;
  merged.apple_music_url = appleMusicData.apple_music_url;
  merged.apple_music_artwork_url = appleMusicData.apple_music_artwork_url;
  merged.apple_music_preview_url = appleMusicData.apple_music_preview_url;

  // ISRC cross-reference
  if (appleMusicData.isrc) {
    if (merged.isrc && merged.isrc !== appleMusicData.isrc) {
      merged.isrc_conflict = true;
      merged.apple_music_isrc = appleMusicData.isrc;
    } else if (!merged.isrc) {
      merged.isrc = appleMusicData.isrc;
    }
  }

  // Fill gaps — only if Spotify/Deezer didn't provide these
  if (!merged.title && appleMusicData.title) merged.title = appleMusicData.title;
  if (!merged.artist && appleMusicData.artist) merged.artist = appleMusicData.artist;
  if (!merged.album && appleMusicData.album) merged.album = appleMusicData.album;
  if (!merged.duration_ms && appleMusicData.duration_ms) merged.duration_ms = appleMusicData.duration_ms;
  if (!merged.release_date && appleMusicData.release_date) merged.release_date = appleMusicData.release_date;

  // Preview URL: prefer Spotify, then Deezer, then Apple Music
  if (!merged.preview_url && !merged.deezer_preview_url && appleMusicData.apple_music_preview_url) {
    merged.preview_url = appleMusicData.apple_music_preview_url;
  }

  // Artwork upgrade: Apple Music 1400px > Spotify 640px
  // Only upgrade if AM artwork is available and current artwork is from Spotify (not from other higher sources)
  if (appleMusicData.apple_music_artwork_url && merged.album_art_url) {
    // Keep AM artwork URL stored separately; the sets/[id].js endpoint handles priority
  } else if (appleMusicData.apple_music_artwork_url && !merged.album_art_url) {
    merged.album_art_url = appleMusicData.apple_music_artwork_url;
  }

  return merged;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const hasCredentials = !!(process.env.APPLE_MUSIC_TEAM_ID && process.env.APPLE_MUSIC_KEY_ID && process.env.APPLE_MUSIC_PRIVATE_KEY);
    return res.status(200).json({
      status: hasCredentials ? 'ready' : 'missing_credentials',
      description: 'POST to enrich tracks with Apple Music data.',
      actions: ['enrich-set', 'enrich-batch'],
      usage: {
        'enrich-set': '{ "action": "enrich-set", "setId": "uuid" }',
        'enrich-batch': '{ "action": "enrich-batch", "limit": 50 }',
      },
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!rateLimit(req, res, { key: 'applemusic-enrich', limit: 100, windowMs: 60_000 })) return;

  const token = getAppleMusicToken();
  if (!token) {
    return res.status(500).json({ error: 'Apple Music credentials not configured' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const { action = 'enrich-batch', setId, limit = 50 } = req.body || {};

    // ========== ENRICH SET — all tracks in a specific set ==========
    if (action === 'enrich-set') {
      if (!setId) return res.status(400).json({ error: 'setId is required' });

      const { data: tracks, error } = await supabase
        .from('set_tracks')
        .select('id, artist_name, track_title, is_id, spotify_data')
        .eq('set_id', setId)
        .eq('is_id', false)
        .order('position');

      if (error) throw error;

      let enriched = 0;
      let skipped = 0;
      let notFound = 0;
      let cacheHits = 0;
      let isrcLookups = 0;
      let rateLimited = false;
      const results = [];

      for (const track of tracks || []) {
        // Skip if already has Apple Music data
        if (track.spotify_data?.apple_music_id) { skipped++; continue; }
        if (!track.artist_name || !track.track_title) { skipped++; continue; }

        // Check Apple Music cache first
        const cached = await checkAppleMusicCache(supabase, track.artist_name, track.track_title);
        if (cached) {
          if (cached.found && cached.applemusic_data) {
            const merged = mergeAppleMusicData(track.spotify_data, cached.applemusic_data);
            await supabase
              .from('set_tracks')
              .update({ spotify_data: merged, is_unreleased: false })
              .eq('id', track.id);
            enriched++;
            cacheHits++;
            results.push({
              track: `${track.artist_name} - ${track.track_title}`,
              apple_music: `${cached.applemusic_data.artist} - ${cached.applemusic_data.title}`,
              source: 'cache',
            });
          } else {
            notFound++;
          }
          continue;
        }

        // Check rate limit
        const budget = await canMakeAppleMusicRequest(supabase);
        if (!budget.allowed) { rateLimited = true; break; }

        await new Promise(r => setTimeout(r, DELAY_MS));

        // Strategy: ISRC-first if available, text search as fallback
        let amData = null;
        const existingIsrc = track.spotify_data?.isrc;

        if (existingIsrc) {
          amData = await lookupByISRC(token, existingIsrc);
          if (amData?._rateLimited) {
            await recordAppleMusicRateLimit(supabase, amData._retryAfter || 60);
            rateLimited = true;
            break;
          }
          if (amData) isrcLookups++;
        }

        if (!amData) {
          amData = await searchTrackOnAppleMusic(token, track.artist_name, track.track_title);
          if (amData?._rateLimited) {
            await recordAppleMusicRateLimit(supabase, amData._retryAfter || 60);
            rateLimited = true;
            break;
          }
        }

        // Write to Apple Music cache
        await writeAppleMusicCache(supabase, track.artist_name, track.track_title, !!amData, amData);

        if (amData) {
          const merged = mergeAppleMusicData(track.spotify_data, amData);
          await supabase
            .from('set_tracks')
            .update({ spotify_data: merged, is_unreleased: false })
            .eq('id', track.id);
          enriched++;
          results.push({
            track: `${track.artist_name} - ${track.track_title}`,
            apple_music: `${amData.artist} - ${amData.title}`,
            source: existingIsrc && isrcLookups > 0 ? 'isrc' : 'search',
          });
        } else {
          notFound++;
        }
      }

      return res.status(200).json({
        success: true,
        action: 'enrich-set',
        setId,
        total: (tracks || []).length,
        enriched,
        skipped,
        notFound,
        cacheHits,
        isrcLookups,
        rateLimited,
        results: results.slice(0, 20),
      });
    }

    // ========== ENRICH BATCH — tracks without Apple Music data ==========
    if (action === 'enrich-batch') {
      // Find tracks that have spotify_data but no apple_music_id
      const { data: tracks, error } = await supabase
        .from('set_tracks')
        .select('id, artist_name, track_title, spotify_data')
        .eq('is_id', false)
        .not('spotify_data', 'is', null)
        .not('artist_name', 'is', null)
        .not('track_title', 'is', null)
        .neq('track_title', 'ID')
        .neq('track_title', 'Unknown')
        .limit(parseInt(limit));

      if (error) throw error;

      // Filter to tracks without apple_music_id in JS (JSONB filtering is limited)
      const candidates = (tracks || []).filter(t =>
        !t.spotify_data?.apple_music_id && t.spotify_data?.spotify_id
      );

      let enriched = 0;
      let notFound = 0;
      let cacheHits = 0;
      let isrcLookups = 0;
      let rateLimited = false;

      for (const track of candidates) {
        const cached = await checkAppleMusicCache(supabase, track.artist_name, track.track_title);
        if (cached) {
          if (cached.found && cached.applemusic_data) {
            const merged = mergeAppleMusicData(track.spotify_data, cached.applemusic_data);
            await supabase
              .from('set_tracks')
              .update({ spotify_data: merged })
              .eq('id', track.id);
            enriched++;
            cacheHits++;
          } else {
            notFound++;
          }
          continue;
        }

        const budget = await canMakeAppleMusicRequest(supabase);
        if (!budget.allowed) { rateLimited = true; break; }

        await new Promise(r => setTimeout(r, DELAY_MS));

        let amData = null;
        const existingIsrc = track.spotify_data?.isrc;

        if (existingIsrc) {
          amData = await lookupByISRC(token, existingIsrc);
          if (amData?._rateLimited) {
            await recordAppleMusicRateLimit(supabase, amData._retryAfter || 60);
            rateLimited = true;
            break;
          }
          if (amData) isrcLookups++;
        }

        if (!amData) {
          amData = await searchTrackOnAppleMusic(token, track.artist_name, track.track_title);
          if (amData?._rateLimited) {
            await recordAppleMusicRateLimit(supabase, amData._retryAfter || 60);
            rateLimited = true;
            break;
          }
        }

        await writeAppleMusicCache(supabase, track.artist_name, track.track_title, !!amData, amData);

        if (amData) {
          const merged = mergeAppleMusicData(track.spotify_data, amData);
          await supabase
            .from('set_tracks')
            .update({ spotify_data: merged })
            .eq('id', track.id);
          enriched++;
        } else {
          notFound++;
        }
      }

      return res.status(200).json({
        success: true,
        action: 'enrich-batch',
        total: candidates.length,
        enriched,
        notFound,
        cacheHits,
        isrcLookups,
        rateLimited,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (error) {
    console.error('Apple Music enrich error:', error);
    return res.status(500).json({ error: error.message });
  }
}
