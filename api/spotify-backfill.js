// One-shot backfill endpoint — chew through the enrichment backlog
// POST /api/spotify-backfill
// Processes up to 100 items per call with 1s delays
// Designed to be triggered manually from admin / dashboard
import { getSupabaseClient, getSpotifyToken, searchTrackOnSpotify, searchArtistOnSpotify } from './_lib/spotify-core.js';
import { checkCache, writeCache, canMakeRequest, recordRateLimit } from './_lib/spotify-cache.js';

const DELAY_MS = 1000;
const MAX_BATCH = 100;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    // Return backlog stats
    const [setTracks, tracks, artists] = await Promise.all([
      supabase.from('set_tracks').select('id', { count: 'exact', head: true })
        .eq('is_id', false).is('spotify_data', null)
        .not('artist_name', 'is', null).not('track_title', 'is', null)
        .neq('track_title', 'ID').neq('track_title', 'Unknown'),
      supabase.from('tracks').select('id', { count: 'exact', head: true })
        .is('spotify_url', null).not('is_unreleased', 'eq', true)
        .not('artist_name', 'is', null).is('enriched_at', null),
      supabase.from('artists').select('id', { count: 'exact', head: true })
        .or('spotify_url.is.null,image_url.is.null').is('enriched_at', null),
    ]);

    return res.status(200).json({
      backlog: {
        set_tracks: setTracks.count || 0,
        tracks: tracks.count || 0,
        artists: artists.count || 0,
        total: (setTracks.count || 0) + (tracks.count || 0) + (artists.count || 0),
      },
      usage: 'POST with { "target": "set_tracks"|"tracks"|"artists"|"all", "limit": 100 }',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple auth — require CRON_SECRET or admin key
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && authHeader !== `Bearer ${serviceKey}`) {
    return res.status(401).json({ error: 'Unauthorized. Pass CRON_SECRET or SERVICE_ROLE_KEY as Bearer token.' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const token = await getSpotifyToken();
  if (!token) return res.status(500).json({ error: 'Spotify credentials not configured' });

  const { target = 'all', limit = MAX_BATCH } = req.body || {};
  const batchLimit = Math.min(parseInt(limit) || MAX_BATCH, MAX_BATCH);

  const results = {
    setTracks: { processed: 0, enriched: 0, cacheHits: 0, notFound: 0 },
    tracks: { processed: 0, enriched: 0, notFound: 0 },
    artists: { processed: 0, enriched: 0, notFound: 0 },
    rateLimited: false,
    stoppedEarly: false,
  };

  try {
    // ========== SET TRACKS ==========
    if ((target === 'all' || target === 'set_tracks') && !results.rateLimited) {
      const { data: rows, error } = await supabase
        .from('set_tracks')
        .select('id, artist_name, track_title')
        .eq('is_id', false)
        .is('spotify_data', null)
        .not('artist_name', 'is', null)
        .not('track_title', 'is', null)
        .neq('track_title', 'ID')
        .neq('track_title', 'Unknown')
        .limit(batchLimit);

      if (error) throw error;

      for (const track of rows || []) {
        if (results.rateLimited) break;

        const cached = await checkCache(supabase, track.artist_name, track.track_title);
        if (cached) {
          if (cached.found && cached.spotify_data) {
            await supabase.from('set_tracks')
              .update({ spotify_data: cached.spotify_data })
              .eq('id', track.id);
            results.setTracks.enriched++;
            results.setTracks.cacheHits++;
          } else {
            await supabase.from('set_tracks')
              .update({ spotify_data: { checked: true, found: false } })
              .eq('id', track.id);
            results.setTracks.notFound++;
          }
          results.setTracks.processed++;
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
          await supabase.from('set_tracks')
            .update({ spotify_data: spotifyData })
            .eq('id', track.id);
          results.setTracks.enriched++;
        } else {
          await supabase.from('set_tracks')
            .update({ spotify_data: { checked: true, found: false } })
            .eq('id', track.id);
          results.setTracks.notFound++;
        }
        results.setTracks.processed++;
      }
    }

    // ========== TRACKS ==========
    if ((target === 'all' || target === 'tracks') && !results.rateLimited) {
      const { data: rows, error } = await supabase
        .from('tracks')
        .select('id, title, artist_name')
        .is('spotify_url', null)
        .not('is_unreleased', 'eq', true)
        .not('artist_name', 'is', null)
        .is('enriched_at', null)
        .order('times_played', { ascending: false })
        .limit(batchLimit);

      if (error) throw error;

      for (const track of rows || []) {
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
          await supabase.from('tracks')
            .update({ is_unreleased: true, enriched_at: new Date().toISOString() })
            .eq('id', track.id);
          results.tracks.notFound++;
        }
        results.tracks.processed++;
      }
    }

    // ========== ARTISTS ==========
    if ((target === 'all' || target === 'artists') && !results.rateLimited) {
      const { data: rows, error } = await supabase
        .from('artists')
        .select('id, name, spotify_url, soundcloud_url, image_url, genres')
        .or('spotify_url.is.null,image_url.is.null')
        .is('enriched_at', null)
        .order('tracks_count', { ascending: false })
        .limit(batchLimit);

      if (error) throw error;

      for (const artist of rows || []) {
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
          if (spotifyData.spotify_url && !artist.spotify_url) update.spotify_url = spotifyData.spotify_url;
          if (spotifyData.spotify_id) update.spotify_artist_id = spotifyData.spotify_id;
          if (spotifyData.image_url && !artist.image_url) update.image_url = spotifyData.image_url;
          if (spotifyData.genres?.length) {
            const merged = [...new Set([...(artist.genres || []), ...spotifyData.genres])].slice(0, 15);
            update.genres = merged;
          }
          if (spotifyData.popularity) update.popularity = spotifyData.popularity;
          if (spotifyData.followers_count) update.followers_count = spotifyData.followers_count;

          await supabase.from('artists').update(update).eq('id', artist.id);
          results.artists.enriched++;
        } else {
          await supabase.from('artists')
            .update({ enriched_at: new Date().toISOString() })
            .eq('id', artist.id);
          results.artists.notFound++;
        }
        results.artists.processed++;
      }
    }

    return res.status(200).json({ success: true, ...results });
  } catch (error) {
    console.error('Backfill error:', error);
    return res.status(500).json({ error: error.message, partial: results });
  }
}
