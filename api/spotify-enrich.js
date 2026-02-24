// API endpoint to enrich tracks and artists with Spotify data
// POST /api/spotify-enrich
// Actions: enrich-set (enrich all tracks in a set), enrich-batch (batch enrich tracks), enrich-artists
// Now uses global cache + rate-limit ledger to prevent duplicate API calls and 429 lockouts
import { getSupabaseClient, getSpotifyToken, searchTrackOnSpotify, searchArtistOnSpotify, normalize } from './_lib/spotify-core.js';
import { checkCache, writeCache, canMakeRequest, recordRateLimit, generateLookupKey } from './_lib/spotify-cache.js';
import { fetchSoundCloudClientId, searchTrackOnSoundCloud, searchArtistOnSoundCloud } from './_lib/soundcloud-core.js';
import { searchDeezerPreview } from './_lib/deezer-core.js';

const DELAY_MS = 1200; // 1.2s between Spotify API calls
let soundcloudClientId = null;

// Create or link an unreleased_tracks catalog entry when a track is confirmed not on Spotify
async function ensureUnreleasedCatalogEntry(supabase, artistName, trackTitle, setTrackId) {
  if (!artistName || !trackTitle) return;
  try {
    const normalizedTitle = trackTitle.toLowerCase().trim();
    const normalizedArtist = artistName.toLowerCase().trim();

    // Check if already in catalog
    const { data: existing } = await supabase
      .from('unreleased_tracks')
      .select('id')
      .ilike('title', normalizedTitle)
      .ilike('artist', normalizedArtist)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (existing) return; // Already cataloged

    // Create new entry
    await supabase
      .from('unreleased_tracks')
      .insert({
        title: trackTitle,
        artist: artistName,
        source_platform: 'manual',
        source_url: `spotify_enrich:${setTrackId}`,
        confidence_score: 0.4,
        metadata: {
          source: 'spotify_enrichment',
          reason: 'not_found_on_spotify',
          set_track_id: setTrackId,
        },
      });
  } catch (err) {
    // Non-critical — don't block enrichment
    if (err?.code !== '23505') { // Ignore unique constraint violations
      console.error('[spotify-enrich] Unreleased catalog error:', err);
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const hasCredentials = !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
    return res.status(200).json({
      status: hasCredentials ? 'ready' : 'missing_credentials',
      description: 'POST to enrich tracks/artists with Spotify data.',
      actions: ['enrich-set', 'enrich-batch', 'enrich-artists'],
      usage: {
        'enrich-set': '{ "action": "enrich-set", "setId": "uuid" }',
        'enrich-batch': '{ "action": "enrich-batch", "limit": 50 }',
        'enrich-artists': '{ "action": "enrich-artists", "limit": 50 }',
      },
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = await getSpotifyToken();
  if (!token) {
    return res.status(500).json({ error: 'Spotify credentials not configured' });
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
      let rateLimited = false;
      const results = [];

      for (const track of tracks || []) {
        if (track.spotify_data?.spotify_id) { skipped++; continue; }
        if (!track.artist_name || !track.track_title) { skipped++; continue; }

        // Check global cache first
        const cached = await checkCache(supabase, track.artist_name, track.track_title);
        if (cached) {
          if (cached.found && cached.spotify_data) {
            // Cache hit — apply to set_tracks without API call
            await supabase
              .from('set_tracks')
              .update({ spotify_data: cached.spotify_data, is_unreleased: false })
              .eq('id', track.id);
            enriched++;
            cacheHits++;
            results.push({
              track: `${track.artist_name} - ${track.track_title}`,
              spotify: `${cached.spotify_data.artist} - ${cached.spotify_data.title}`,
              albumArt: !!cached.spotify_data.album_art_url,
              source: 'cache',
            });
          } else {
            // Known not-found in cache — mark as unreleased
            await supabase
              .from('set_tracks')
              .update({ is_unreleased: true, unreleased_source: 'spotify_not_found' })
              .eq('id', track.id);
            ensureUnreleasedCatalogEntry(supabase, track.artist_name, track.track_title, track.id);
            notFound++;
          }
          continue;
        }

        // Check rate limit before API call
        const budget = await canMakeRequest(supabase);
        if (!budget.allowed) {
          rateLimited = true;
          break;
        }

        await new Promise(r => setTimeout(r, DELAY_MS));

        const spotifyData = await searchTrackOnSpotify(token, track.artist_name, track.track_title);

        if (spotifyData?._rateLimited) {
          await recordRateLimit(supabase, spotifyData._retryAfter || 60);
          rateLimited = true;
          break;
        }

        // Write to cache regardless of result
        await writeCache(supabase, track.artist_name, track.track_title, !!spotifyData, spotifyData);

        if (spotifyData) {
          // If Spotify found the track but has no preview, try Deezer
          if (!spotifyData.preview_url) {
            try {
              await new Promise(r => setTimeout(r, DELAY_MS));
              const deezer = await searchDeezerPreview(track.artist_name, track.track_title);
              if (deezer?.previewUrl) {
                spotifyData.deezer_preview_url = deezer.previewUrl;
              }
            } catch {}
          }

          await supabase
            .from('set_tracks')
            .update({ spotify_data: spotifyData, is_unreleased: false })
            .eq('id', track.id);

          enriched++;
          results.push({
            track: `${track.artist_name} - ${track.track_title}`,
            spotify: `${spotifyData.artist} - ${spotifyData.title}`,
            albumArt: !!spotifyData.album_art_url,
            source: 'api',
          });
        } else {
          // Spotify miss — try SoundCloud as fallback for artwork
          let scArtwork = null;
          try {
            if (!soundcloudClientId) soundcloudClientId = await fetchSoundCloudClientId();
            if (soundcloudClientId) {
              scArtwork = await searchTrackOnSoundCloud(soundcloudClientId, track.artist_name, track.track_title);
            }
          } catch (e) {
            // SoundCloud fallback is best-effort
          }

          // Try Deezer for preview URL regardless
          let deezerPreviewUrl = null;
          try {
            await new Promise(r => setTimeout(r, DELAY_MS));
            const deezer = await searchDeezerPreview(track.artist_name, track.track_title);
            if (deezer?.previewUrl) {
              deezerPreviewUrl = deezer.previewUrl;
            }
          } catch {}

          if (scArtwork?.artwork_url) {
            // Store SoundCloud artwork in spotify_data format so coverUrl picks it up
            const scData = {
              album_art_url: scArtwork.artwork_url,
              title: scArtwork.title || track.track_title,
              artist: scArtwork.artist || track.artist_name,
              source: 'soundcloud',
              permalink_url: scArtwork.permalink_url,
              deezer_preview_url: deezerPreviewUrl || undefined,
            };
            await supabase
              .from('set_tracks')
              .update({ spotify_data: scData, is_unreleased: true, unreleased_source: 'spotify_not_found' })
              .eq('id', track.id);
            enriched++;
            results.push({
              track: `${track.artist_name} - ${track.track_title}`,
              spotify: `${scArtwork.artist} - ${scArtwork.title}`,
              albumArt: true,
              source: 'soundcloud_fallback',
            });
          } else if (deezerPreviewUrl) {
            // No Spotify or SoundCloud match, but Deezer has a preview
            const deezerData = {
              title: track.track_title,
              artist: track.artist_name,
              source: 'deezer',
              deezer_preview_url: deezerPreviewUrl,
            };
            await supabase
              .from('set_tracks')
              .update({ spotify_data: deezerData, is_unreleased: true, unreleased_source: 'spotify_not_found' })
              .eq('id', track.id);
            enriched++;
            results.push({
              track: `${track.artist_name} - ${track.track_title}`,
              spotify: `Deezer preview found`,
              albumArt: false,
              source: 'deezer_fallback',
            });
          } else {
            // Not found on Spotify, SoundCloud, or Deezer — mark as unreleased
            await supabase
              .from('set_tracks')
              .update({ is_unreleased: true, unreleased_source: 'spotify_not_found' })
              .eq('id', track.id);
            ensureUnreleasedCatalogEntry(supabase, track.artist_name, track.track_title, track.id);
            notFound++;
          }
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
        rateLimited,
        results: results.slice(0, 20),
      });
    }

    // ========== ENRICH BATCH — tracks without Spotify data ==========
    if (action === 'enrich-batch') {
      const { data: tracks, error } = await supabase
        .from('set_tracks')
        .select('id, artist_name, track_title')
        .eq('is_id', false)
        .is('spotify_data', null)
        .not('artist_name', 'is', null)
        .not('track_title', 'is', null)
        .neq('track_title', 'ID')
        .neq('track_title', 'Unknown')
        .limit(parseInt(limit));

      if (error) throw error;

      let enriched = 0;
      let notFound = 0;
      let cacheHits = 0;
      let rateLimited = false;

      for (const track of tracks || []) {
        // Check global cache first
        const cached = await checkCache(supabase, track.artist_name, track.track_title);
        if (cached) {
          if (cached.found && cached.spotify_data) {
            await supabase
              .from('set_tracks')
              .update({ spotify_data: cached.spotify_data, is_unreleased: false })
              .eq('id', track.id);
            enriched++;
            cacheHits++;
          } else {
            await supabase
              .from('set_tracks')
              .update({ spotify_data: { checked: true, found: false }, is_unreleased: true, unreleased_source: 'spotify_not_found' })
              .eq('id', track.id);
            ensureUnreleasedCatalogEntry(supabase, track.artist_name, track.track_title, track.id);
            notFound++;
          }
          continue;
        }

        // Check rate limit
        const budget = await canMakeRequest(supabase);
        if (!budget.allowed) {
          rateLimited = true;
          break;
        }

        await new Promise(r => setTimeout(r, DELAY_MS));

        const spotifyData = await searchTrackOnSpotify(token, track.artist_name, track.track_title);

        if (spotifyData?._rateLimited) {
          await recordRateLimit(supabase, spotifyData._retryAfter || 60);
          rateLimited = true;
          break;
        }

        // Write to cache
        await writeCache(supabase, track.artist_name, track.track_title, !!spotifyData, spotifyData);

        if (spotifyData) {
          // If Spotify found the track but has no preview, try Deezer
          if (!spotifyData.preview_url) {
            try {
              await new Promise(r => setTimeout(r, DELAY_MS));
              const deezer = await searchDeezerPreview(track.artist_name, track.track_title);
              if (deezer?.previewUrl) {
                spotifyData.deezer_preview_url = deezer.previewUrl;
              }
            } catch {}
          }

          await supabase
            .from('set_tracks')
            .update({ spotify_data: spotifyData, is_unreleased: false })
            .eq('id', track.id);
          enriched++;
        } else {
          // Spotify miss — try SoundCloud fallback for artwork
          let scArtwork = null;
          try {
            if (!soundcloudClientId) soundcloudClientId = await fetchSoundCloudClientId();
            if (soundcloudClientId) {
              scArtwork = await searchTrackOnSoundCloud(soundcloudClientId, track.artist_name, track.track_title);
            }
          } catch (e) {
            // Best-effort
          }

          // Try Deezer for preview URL
          let deezerPreviewUrl = null;
          try {
            await new Promise(r => setTimeout(r, DELAY_MS));
            const deezer = await searchDeezerPreview(track.artist_name, track.track_title);
            if (deezer?.previewUrl) {
              deezerPreviewUrl = deezer.previewUrl;
            }
          } catch {}

          if (scArtwork?.artwork_url) {
            const scData = {
              album_art_url: scArtwork.artwork_url,
              title: scArtwork.title || track.track_title,
              artist: scArtwork.artist || track.artist_name,
              source: 'soundcloud',
              permalink_url: scArtwork.permalink_url,
              deezer_preview_url: deezerPreviewUrl || undefined,
            };
            await supabase
              .from('set_tracks')
              .update({ spotify_data: scData, is_unreleased: true, unreleased_source: 'spotify_not_found' })
              .eq('id', track.id);
            enriched++;
          } else if (deezerPreviewUrl) {
            const deezerData = {
              title: track.track_title,
              artist: track.artist_name,
              source: 'deezer',
              deezer_preview_url: deezerPreviewUrl,
            };
            await supabase
              .from('set_tracks')
              .update({ spotify_data: deezerData, is_unreleased: true, unreleased_source: 'spotify_not_found' })
              .eq('id', track.id);
            enriched++;
          } else {
            await supabase
              .from('set_tracks')
              .update({ spotify_data: { checked: true, found: false }, is_unreleased: true, unreleased_source: 'spotify_not_found' })
              .eq('id', track.id);
            ensureUnreleasedCatalogEntry(supabase, track.artist_name, track.track_title, track.id);
            notFound++;
          }
        }
      }

      return res.status(200).json({
        success: true,
        action: 'enrich-batch',
        total: (tracks || []).length,
        rateLimited,
        enriched,
        notFound,
        cacheHits,
      });
    }

    // ========== ENRICH ARTISTS — artists without Spotify data ==========
    if (action === 'enrich-artists') {
      const { data: sets, error } = await supabase
        .from('sets')
        .select('dj_name, dj_id')
        .not('dj_name', 'is', null)
        .neq('dj_name', '');

      if (error) throw error;

      const uniqueArtists = new Map();
      for (const set of sets || []) {
        const name = set.dj_name.trim();
        if (!uniqueArtists.has(name.toLowerCase())) {
          uniqueArtists.set(name.toLowerCase(), { name, djId: set.dj_id });
        }
      }

      let enriched = 0;
      let notFound = 0;
      let skipped = 0;
      const results = [];
      let count = 0;

      for (const [, { name, djId }] of uniqueArtists) {
        if (count >= parseInt(limit)) break;

        let existingArtist = null;
        if (djId) {
          const { data } = await supabase
            .from('artists')
            .select('spotify_url, soundcloud_url, image_url')
            .eq('id', djId)
            .single();
          existingArtist = data;

          if (existingArtist?.spotify_url) { skipped++; count++; continue; }
        }

        // Check rate limit
        const budget = await canMakeRequest(supabase);
        if (!budget.allowed) break;

        await new Promise(r => setTimeout(r, DELAY_MS));

        const spotifyData = await searchArtistOnSpotify(token, name);

        if (spotifyData?._rateLimited) {
          await recordRateLimit(supabase, spotifyData._retryAfter || 60);
          break;
        }

        if (spotifyData) {
          if (djId) {
            const update = {};
            if (spotifyData.image_url) update.image_url = spotifyData.image_url;
            if (spotifyData.genres?.length) update.genres = spotifyData.genres;
            if (spotifyData.spotify_url) update.spotify_url = spotifyData.spotify_url;
            if (spotifyData.followers_count) update.followers_count = spotifyData.followers_count;

            if (Object.keys(update).length > 0) {
              await supabase
                .from('artists')
                .update(update)
                .eq('id', djId);
            }
          }

          enriched++;
          results.push({
            name,
            spotifyName: spotifyData.name,
            genres: spotifyData.genres,
            followers: spotifyData.followers_count,
            hasImage: !!spotifyData.image_url,
          });
        } else {
          // Spotify miss — try SoundCloud as fallback for artist profile
          let scArtist = null;
          try {
            if (!soundcloudClientId) soundcloudClientId = await fetchSoundCloudClientId();
            if (soundcloudClientId) {
              scArtist = await searchArtistOnSoundCloud(soundcloudClientId, name);
            }
          } catch (e) {
            // SoundCloud fallback is best-effort
          }

          if (scArtist && djId) {
            const update = {};
            if (scArtist.permalink_url && !existingArtist?.soundcloud_url) update.soundcloud_url = scArtist.permalink_url;
            if (scArtist.avatar_url && !existingArtist?.image_url) update.image_url = scArtist.avatar_url;

            if (Object.keys(update).length > 0) {
              await supabase
                .from('artists')
                .update(update)
                .eq('id', djId);
            }

            enriched++;
            results.push({
              name,
              soundcloudName: scArtist.username,
              soundcloudUrl: scArtist.permalink_url,
              hasImage: !!scArtist.avatar_url,
              source: 'soundcloud',
            });
          } else {
            notFound++;
          }
        }
        count++;
      }

      return res.status(200).json({
        success: true,
        action: 'enrich-artists',
        uniqueArtists: uniqueArtists.size,
        processed: count,
        enriched,
        notFound,
        skipped,
        results: results.slice(0, 30),
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (error) {
    console.error('Spotify enrich error:', error);
    return res.status(500).json({ error: error.message });
  }
}
