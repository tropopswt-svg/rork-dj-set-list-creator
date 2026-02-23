// Vercel cron endpoint — background drip enrichment
// Processes 20 un-enriched set_tracks + 15 tracks + 10 artists per invocation
// Schedule: every 5 minutes via vercel.json cron
// Rate: ~5,760 set_tracks/day + 4,320 tracks/day + 2,880 artists/day
import { getSupabaseClient, getSpotifyToken, searchTrackOnSpotify, searchArtistOnSpotify } from './_lib/spotify-core.js';
import { checkCache, writeCache, canMakeRequest, recordRateLimit } from './_lib/spotify-cache.js';
import { fetchSoundCloudClientId, searchArtistOnSoundCloud } from './_lib/soundcloud-core.js';

const SET_TRACKS_BATCH = 20;
const TRACKS_BATCH = 15;
const ARTISTS_BATCH = 10;
const DELAY_MS = 1000;
let soundcloudClientId = null;

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

  const token = await getSpotifyToken();
  if (!token) {
    return res.status(500).json({ error: 'Spotify credentials not configured' });
  }

  const results = {
    setTracks: { enriched: 0, notFound: 0, cacheHits: 0 },
    tracks: { enriched: 0, notFound: 0, markedUnreleased: 0 },
    artists: { enriched: 0, notFound: 0 },
    rateLimited: false,
  };

  try {
    // ========== PHASE 1: Enrich set_tracks (existing behavior) ==========
    const { data: setTracks, error: stError } = await supabase
      .from('set_tracks')
      .select('id, artist_name, track_title')
      .eq('is_id', false)
      .is('spotify_data', null)
      .not('artist_name', 'is', null)
      .not('track_title', 'is', null)
      .neq('track_title', 'ID')
      .neq('track_title', 'Unknown')
      .limit(SET_TRACKS_BATCH);

    if (stError) throw stError;

    for (const track of setTracks || []) {
      if (results.rateLimited) break;

      // Check global cache first
      const cached = await checkCache(supabase, track.artist_name, track.track_title);
      if (cached) {
        if (cached.found && cached.spotify_data) {
          await supabase
            .from('set_tracks')
            .update({ spotify_data: cached.spotify_data })
            .eq('id', track.id);
          results.setTracks.enriched++;
          results.setTracks.cacheHits++;
        } else {
          await supabase
            .from('set_tracks')
            .update({ spotify_data: { checked: true, found: false } })
            .eq('id', track.id);
          results.setTracks.notFound++;
        }
        continue;
      }

      const budget = await canMakeRequest(supabase);
      if (!budget.allowed) { results.rateLimited = true; break; }

      await new Promise(r => setTimeout(r, DELAY_MS));
      const spotifyData = await searchTrackOnSpotify(token, track.artist_name, track.track_title);

      if (spotifyData?._rateLimited) {
        await recordRateLimit(supabase, spotifyData._retryAfter || 60);
        results.rateLimited = true;
        break;
      }

      await writeCache(supabase, track.artist_name, track.track_title, !!spotifyData, spotifyData);

      if (spotifyData) {
        await supabase
          .from('set_tracks')
          .update({ spotify_data: spotifyData })
          .eq('id', track.id);
        results.setTracks.enriched++;
      } else {
        await supabase
          .from('set_tracks')
          .update({ spotify_data: { checked: true, found: false } })
          .eq('id', track.id);
        results.setTracks.notFound++;
      }
    }

    // ========== PHASE 2: Enrich tracks table ==========
    if (!results.rateLimited) {
      const { data: tracks, error: tError } = await supabase
        .from('tracks')
        .select('id, title, artist_name, is_unreleased')
        .is('spotify_url', null)
        .not('is_unreleased', 'eq', true)
        .not('artist_name', 'is', null)
        .is('enriched_at', null)
        .order('times_played', { ascending: false })
        .limit(TRACKS_BATCH);

      if (tError) console.error('Tracks query error:', tError);

      for (const track of tracks || []) {
        if (results.rateLimited) break;

        const budget = await canMakeRequest(supabase);
        if (!budget.allowed) { results.rateLimited = true; break; }

        await new Promise(r => setTimeout(r, DELAY_MS));
        const spotifyData = await searchTrackOnSpotify(token, track.artist_name, track.title);

        if (spotifyData?._rateLimited) {
          await recordRateLimit(supabase, spotifyData._retryAfter || 60);
          results.rateLimited = true;
          break;
        }

        if (spotifyData) {
          // Update track with Spotify metadata
          const update = {
            spotify_url: spotifyData.spotify_url,
            enriched_at: new Date().toISOString(),
          };
          if (spotifyData.isrc) update.isrc = spotifyData.isrc;
          if (spotifyData.duration_ms) update.duration_seconds = Math.round(spotifyData.duration_ms / 1000);
          if (spotifyData.release_date) {
            const year = parseInt(spotifyData.release_date.substring(0, 4), 10);
            if (year > 1900 && year < 2100) update.release_year = year;
          }
          if (spotifyData.album_art_url) update.artwork_url = spotifyData.album_art_url;
          if (spotifyData.preview_url) update.spotify_preview_url = spotifyData.preview_url;
          if (spotifyData.popularity) update.popularity = spotifyData.popularity;
          if (spotifyData.album) update.album_name = spotifyData.album;

          await supabase.from('tracks').update(update).eq('id', track.id);
          results.tracks.enriched++;
        } else {
          // Not on Spotify — likely unreleased
          await supabase
            .from('tracks')
            .update({
              is_unreleased: true,
              enriched_at: new Date().toISOString(),
            })
            .eq('id', track.id);
          results.tracks.markedUnreleased++;
        }
      }
    }

    // ========== PHASE 3: Enrich artists table ==========
    if (!results.rateLimited) {
      const { data: artists, error: aError } = await supabase
        .from('artists')
        .select('id, name, spotify_url, soundcloud_url, image_url, genres')
        .or('spotify_url.is.null,image_url.is.null')
        .is('enriched_at', null)
        .order('tracks_count', { ascending: false })
        .limit(ARTISTS_BATCH);

      if (aError) console.error('Artists query error:', aError);

      for (const artist of artists || []) {
        if (results.rateLimited) break;

        const budget = await canMakeRequest(supabase);
        if (!budget.allowed) { results.rateLimited = true; break; }

        await new Promise(r => setTimeout(r, DELAY_MS));
        const spotifyData = await searchArtistOnSpotify(token, artist.name);

        if (spotifyData?._rateLimited) {
          await recordRateLimit(supabase, spotifyData._retryAfter || 60);
          results.rateLimited = true;
          break;
        }

        if (spotifyData) {
          const update = { enriched_at: new Date().toISOString() };

          if (spotifyData.spotify_url && !artist.spotify_url) {
            update.spotify_url = spotifyData.spotify_url;
          }
          if (spotifyData.spotify_id) {
            update.spotify_artist_id = spotifyData.spotify_id;
          }
          if (spotifyData.image_url && !artist.image_url) {
            update.image_url = spotifyData.image_url;
          }
          if (spotifyData.genres?.length) {
            const existingGenres = artist.genres || [];
            const merged = [...new Set([...existingGenres, ...spotifyData.genres])].slice(0, 15);
            update.genres = merged;
          }
          if (spotifyData.popularity) {
            update.popularity = spotifyData.popularity;
          }
          if (spotifyData.followers_count) {
            update.followers_count = spotifyData.followers_count;
          }

          await supabase.from('artists').update(update).eq('id', artist.id);
          results.artists.enriched++;
        } else {
          // Spotify miss — try SoundCloud as fallback for artist profile
          let scArtist = null;
          try {
            if (!soundcloudClientId) soundcloudClientId = await fetchSoundCloudClientId();
            if (soundcloudClientId) {
              scArtist = await searchArtistOnSoundCloud(soundcloudClientId, artist.name);
            }
          } catch (e) {
            // SoundCloud fallback is best-effort
          }

          const update = { enriched_at: new Date().toISOString() };
          if (scArtist) {
            if (scArtist.permalink_url && !artist.soundcloud_url) {
              update.soundcloud_url = scArtist.permalink_url;
            }
            if (scArtist.avatar_url && !artist.image_url) {
              update.image_url = scArtist.avatar_url;
            }
            results.artists.enriched++;
          } else {
            results.artists.notFound++;
          }

          await supabase
            .from('artists')
            .update(update)
            .eq('id', artist.id);
        }
      }
    }

    return res.status(200).json({
      success: true,
      ...results,
    });

  } catch (error) {
    console.error('Spotify drip error:', error);
    return res.status(500).json({ error: error.message });
  }
}
