// Vercel cron endpoint — background Apple Music drip enrichment
// Processes 30 set_tracks per invocation
// Phase 1: ISRC-based (tracks with Spotify ISRC but no apple_music_id)
// Phase 2: Text-search for tracks Spotify missed
// Schedule: every 10 minutes (offset from validate-tracks) via vercel.json cron
import { getSupabaseClient } from './_lib/spotify-core.js';
import { getAppleMusicToken, lookupByISRC, searchTrackOnAppleMusic } from './_lib/applemusic-core.js';
import { checkAppleMusicCache, writeAppleMusicCache, canMakeAppleMusicRequest, recordAppleMusicRateLimit } from './_lib/applemusic-cache.js';

const BATCH_SIZE = 30;
const DELAY_MS = 500;

/**
 * Merge Apple Music data into existing spotify_data JSONB (additive).
 */
function mergeAppleMusicData(existingSpotifyData, appleMusicData) {
  const merged = { ...(existingSpotifyData || {}) };

  merged.apple_music_id = appleMusicData.apple_music_id;
  merged.apple_music_url = appleMusicData.apple_music_url;
  merged.apple_music_artwork_url = appleMusicData.apple_music_artwork_url;
  merged.apple_music_preview_url = appleMusicData.apple_music_preview_url;

  if (appleMusicData.isrc) {
    if (merged.isrc && merged.isrc !== appleMusicData.isrc) {
      merged.isrc_conflict = true;
      merged.apple_music_isrc = appleMusicData.isrc;
    } else if (!merged.isrc) {
      merged.isrc = appleMusicData.isrc;
    }
  }

  if (!merged.title && appleMusicData.title) merged.title = appleMusicData.title;
  if (!merged.artist && appleMusicData.artist) merged.artist = appleMusicData.artist;
  if (!merged.album && appleMusicData.album) merged.album = appleMusicData.album;
  if (!merged.duration_ms && appleMusicData.duration_ms) merged.duration_ms = appleMusicData.duration_ms;
  if (!merged.release_date && appleMusicData.release_date) merged.release_date = appleMusicData.release_date;

  if (!merged.preview_url && !merged.deezer_preview_url && appleMusicData.apple_music_preview_url) {
    merged.preview_url = appleMusicData.apple_music_preview_url;
  }

  if (appleMusicData.apple_music_artwork_url && !merged.album_art_url) {
    merged.album_art_url = appleMusicData.apple_music_artwork_url;
  }

  return merged;
}

export default async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const token = getAppleMusicToken();
  if (!token) {
    return res.status(500).json({ error: 'Apple Music credentials not configured' });
  }

  const results = {
    phase1: { enriched: 0, notFound: 0, cacheHits: 0 },
    phase2: { enriched: 0, notFound: 0, cacheHits: 0 },
    rateLimited: false,
    processed: 0,
  };

  try {
    // ========== PHASE 1: ISRC-based enrichment ==========
    // Tracks with Spotify data (have ISRC) but no Apple Music ID yet
    const { data: isrcTracks, error: isrcError } = await supabase
      .from('set_tracks')
      .select('id, artist_name, track_title, spotify_data')
      .eq('is_id', false)
      .not('spotify_data', 'is', null)
      .not('artist_name', 'is', null)
      .not('track_title', 'is', null)
      .limit(BATCH_SIZE * 2); // Fetch more, filter in JS

    if (isrcError) throw isrcError;

    // Filter: has ISRC but no apple_music_id
    const phase1Tracks = (isrcTracks || [])
      .filter(t => t.spotify_data?.isrc && !t.spotify_data?.apple_music_id)
      .slice(0, Math.floor(BATCH_SIZE * 0.6)); // 60% of batch for ISRC lookups

    for (const track of phase1Tracks) {
      if (results.rateLimited) break;

      // Check cache
      const cached = await checkAppleMusicCache(supabase, track.artist_name, track.track_title);
      if (cached) {
        if (cached.found && cached.applemusic_data) {
          const merged = mergeAppleMusicData(track.spotify_data, cached.applemusic_data);
          await supabase
            .from('set_tracks')
            .update({ spotify_data: merged })
            .eq('id', track.id);
          results.phase1.enriched++;
          results.phase1.cacheHits++;
        } else {
          results.phase1.notFound++;
        }
        results.processed++;
        continue;
      }

      const budget = await canMakeAppleMusicRequest(supabase);
      if (!budget.allowed) { results.rateLimited = true; break; }

      await new Promise(r => setTimeout(r, DELAY_MS));

      const amData = await lookupByISRC(token, track.spotify_data.isrc);
      if (amData?._rateLimited) {
        await recordAppleMusicRateLimit(supabase, amData._retryAfter || 60);
        results.rateLimited = true;
        break;
      }

      await writeAppleMusicCache(supabase, track.artist_name, track.track_title, !!amData, amData);

      if (amData) {
        const merged = mergeAppleMusicData(track.spotify_data, amData);
        await supabase
          .from('set_tracks')
          .update({ spotify_data: merged })
          .eq('id', track.id);
        results.phase1.enriched++;
      } else {
        results.phase1.notFound++;
      }
      results.processed++;
    }

    // ========== PHASE 2: Text search for Spotify misses ==========
    if (!results.rateLimited) {
      const remaining = BATCH_SIZE - results.processed;
      if (remaining > 0) {
        // Tracks that Spotify couldn't find (found: false) or have no spotify_data
        const { data: missedTracks, error: missedError } = await supabase
          .from('set_tracks')
          .select('id, artist_name, track_title, spotify_data')
          .eq('is_id', false)
          .not('artist_name', 'is', null)
          .not('track_title', 'is', null)
          .neq('track_title', 'ID')
          .neq('track_title', 'Unknown')
          .limit(remaining * 2);

        if (missedError) throw missedError;

        // Filter: no apple_music_id AND (no spotify_data OR spotify not found)
        const phase2Tracks = (missedTracks || [])
          .filter(t =>
            !t.spotify_data?.apple_music_id && (
              !t.spotify_data?.spotify_id ||
              t.spotify_data?.found === false
            )
          )
          .slice(0, remaining);

        for (const track of phase2Tracks) {
          if (results.rateLimited) break;

          const cached = await checkAppleMusicCache(supabase, track.artist_name, track.track_title);
          if (cached) {
            if (cached.found && cached.applemusic_data) {
              const merged = mergeAppleMusicData(track.spotify_data, cached.applemusic_data);
              await supabase
                .from('set_tracks')
                .update({ spotify_data: merged, is_unreleased: false })
                .eq('id', track.id);
              results.phase2.enriched++;
              results.phase2.cacheHits++;
            } else {
              results.phase2.notFound++;
            }
            results.processed++;
            continue;
          }

          const budget = await canMakeAppleMusicRequest(supabase);
          if (!budget.allowed) { results.rateLimited = true; break; }

          await new Promise(r => setTimeout(r, DELAY_MS));

          const amData = await searchTrackOnAppleMusic(token, track.artist_name, track.track_title);
          if (amData?._rateLimited) {
            await recordAppleMusicRateLimit(supabase, amData._retryAfter || 60);
            results.rateLimited = true;
            break;
          }

          await writeAppleMusicCache(supabase, track.artist_name, track.track_title, !!amData, amData);

          if (amData) {
            const merged = mergeAppleMusicData(track.spotify_data, amData);
            await supabase
              .from('set_tracks')
              .update({ spotify_data: merged, is_unreleased: false })
              .eq('id', track.id);
            results.phase2.enriched++;
          } else {
            results.phase2.notFound++;
          }
          results.processed++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      ...results,
    });

  } catch (error) {
    console.error('Apple Music drip error:', error);
    return res.status(500).json({ error: error.message });
  }
}
