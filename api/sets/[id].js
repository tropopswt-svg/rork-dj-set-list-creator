// API endpoint to get a single set with its tracklist
import { createClient } from '@supabase/supabase-js';
import { batchCheckCache, generateLookupKey } from '../_lib/spotify-cache.js';
import { fetchSoundCloudArtwork } from '../_lib/soundcloud-core.js';

// Format seconds to timestamp string (e.g., 3661 -> "1:01:01")
function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Generate YouTube thumbnail URL from video ID
function getYouTubeThumbnail(videoId) {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Set ID is required' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // Get the set, joining artists table for the artist image fallback
    const { data: set, error: setError } = await supabase
      .from('sets')
      .select('*, artist:dj_id(image_url)')
      .eq('id', id)
      .single();

    if (setError) {
      if (setError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Set not found' });
      }
      console.error('Set query error:', setError);
      return res.status(500).json({ error: setError.message });
    }

    // Get the tracklist — join with tracks table for Spotify enrichment fallback
    const { data: setTracks, error: tracksError } = await supabase
      .from('set_tracks')
      .select('*, track:track_id(spotify_preview_url, artwork_url, spotify_url)')
      .eq('set_id', id)
      .order('position', { ascending: true });

    if (tracksError) {
      console.error('Tracks query error:', tracksError);
      return res.status(500).json({ error: tracksError.message });
    }

    // ========== Cache-first Spotify enrichment (zero API calls) ==========
    let needsEnrichment = false;
    const unEnrichedTracks = (setTracks || []).filter(t =>
      !t.is_id && !t.spotify_data?.spotify_id && t.artist_name && t.track_title
    );

    if (unEnrichedTracks.length > 0) {
      try {
        // Use service role client for cache access
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const cacheClient = serviceKey
          ? createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, serviceKey)
          : supabase;

        const { hits, misses } = await batchCheckCache(cacheClient, unEnrichedTracks);

        // Apply cache hits to set_tracks (fire-and-forget DB updates)
        const updates = [];
        for (const track of unEnrichedTracks) {
          const key = generateLookupKey(track.artist_name, track.track_title);
          const spotifyData = hits.get(key);
          if (spotifyData && spotifyData.spotify_id) {
            // Update the in-memory track for this response
            track.spotify_data = spotifyData;
            // Fire-and-forget DB update
            updates.push(
              cacheClient
                .from('set_tracks')
                .update({ spotify_data: spotifyData })
                .eq('id', track.id)
            );
          }
        }

        // Don't await all — fire-and-forget so response isn't delayed
        if (updates.length > 0) {
          Promise.all(updates).catch(err => console.error('Cache apply error:', err));
        }

        // If there are still cache misses, the client should trigger enrichment
        needsEnrichment = misses.length > 0;
      } catch (cacheErr) {
        console.error('Cache enrichment error:', cacheErr);
        needsEnrichment = unEnrichedTracks.length > 0;
      }
    }

    // Fetch artist genres if set is linked to an artist
    let artistGenres = [];
    if (set.dj_id) {
      const { data: artistData } = await supabase
        .from('artists')
        .select('genres')
        .eq('id', set.dj_id)
        .single();
      if (artistData?.genres?.length) {
        artistGenres = artistData.genres;
      }
    }

    // ========== Unreleased cross-reference lookup ==========
    // For tracks without Spotify data, check if they exist in the unreleased catalog
    const unreleasedLookup = new Map();
    const unreleasedCandidates = (setTracks || []).filter(t =>
      !t.spotify_data?.spotify_id && t.artist_name && t.track_title &&
      !/^(id|unknown|unknown track|tba|tbc)$/i.test(t.track_title)
    );
    if (unreleasedCandidates.length > 0) {
      try {
        // Batch lookup: find unreleased_tracks matching any of these artist+title combos
        for (const t of unreleasedCandidates) {
          const { data: match } = await supabase
            .from('unreleased_tracks')
            .select('id, title, artist, times_identified, source_platform')
            .ilike('title', t.track_title.toLowerCase().trim())
            .ilike('artist', t.artist_name.toLowerCase().trim())
            .eq('is_active', true)
            .limit(1)
            .single();
          if (match) {
            // Get how many other sets this unreleased track appeared in
            const { count: setCount } = await supabase
              .from('unreleased_identifications')
              .select('*', { count: 'exact', head: true })
              .eq('unreleased_track_id', match.id);
            unreleasedLookup.set(t.id, {
              unreleasedTrackId: match.id,
              timesIdentified: match.times_identified || 0,
              otherSetsCount: (setCount || 0),
              sourcePlatform: match.source_platform,
            });
          }
        }
      } catch (err) {
        console.error('Unreleased cross-reference error:', err);
      }
    }

    // Count gaps (ID tracks)
    const gapCount = setTracks?.filter(t => t.is_id)?.length || 0;
    const hasGaps = gapCount > 0;

    // Check if tracks have real timestamps or are just ordered
    const totalDuration = set.duration_seconds || 0;
    const tracksWithRealTimestamps = setTracks?.filter(t =>
      t.is_timed && t.timestamp_seconds && t.timestamp_seconds > 0
    ).length || 0;
    const hasRealTimestamps = tracksWithRealTimestamps > 1;

    // For sets without real timestamps, distribute tracks evenly across the set duration
    const distributeTimestamps = !hasRealTimestamps && setTracks?.length > 0 && totalDuration > 0;

    // Transform tracks to match app's Track type
    const tracks = setTracks?.map((track, index, arr) => {
      let timestamp = track.timestamp_seconds || 0;
      let timestampStr = track.timestamp_str || '0:00';

      // For sets without real timestamps, evenly space tracks across the duration
      if (distributeTimestamps) {
        timestamp = Math.floor((index / arr.length) * totalDuration);
        timestampStr = formatTimestamp(timestamp);
      }

      // Spotify enrichment data: try denormalized spotify_data first, then joined tracks table
      const spotify = track.spotify_data || {};
      const linkedTrack = track.track || {};
      // Only mark as Spotify-verified when we have a real Spotify match
      // (spotify_id from enrichment API, or spotify_url on the enrichment data itself).
      // linkedTrack.spotify_url alone is not proof — it can be stale or from other sources.
      const hasSpotify = !!spotify.spotify_id || !!spotify.spotify_url;
      // Build direct Spotify URL: prefer stored URL, construct from ID as fallback
      const spotifyDirectUrl = spotify.spotify_url
        || (spotify.spotify_id ? `https://open.spotify.com/track/${spotify.spotify_id}` : null)
        || linkedTrack.spotify_url
        || null;

      return {
        id: track.id,
        title: track.track_title || 'Unknown',
        artist: track.artist_name || 'Unknown',
        position: track.position,
        timestamp,
        timestampStr,
        // If a track has a real title and artist, it's not an ID — even if is_id flag is stale
        isId: (track.is_id && (!track.track_title || /^(id|unknown|unknown track|tba|tbc)$/i.test(track.track_title))) || false,
        // Only treat as unreleased if explicitly tagged (comment hint, scraper detection)
        // OR if is_unreleased is set and the track name itself contains unreleased indicators.
        isUnreleased: (track.is_unreleased && (
          track.unreleased_source !== 'spotify_not_found' ||
          /unreleased|forthcoming|dubplate/i.test(track.track_title || '') ||
          /unreleased/i.test(track.artist_name || '')
        )) || false,
        isTimed: track.is_timed !== false || distributeTimestamps,
        trackId: track.track_id,
        addedAt: track.created_at,
        source: track.source || '1001tracklists',
        verified: !track.is_id,
        confidence: track.is_id ? 0 : 1,
        // Spotify data — cascade: spotify_data JSONB → joined tracks table
        coverUrl: spotify.album_art_url || linkedTrack.artwork_url || undefined,
        album: spotify.album || undefined,
        previewUrl: spotify.preview_url || spotify.deezer_preview_url || linkedTrack.spotify_preview_url || undefined,
        isrc: spotify.isrc || undefined,
        releaseDate: spotify.release_date || undefined,
        popularity: spotify.popularity || undefined,
        isReleased: hasSpotify,
        trackLinks: [
          spotifyDirectUrl && {
            platform: 'spotify',
            url: spotifyDirectUrl,
          },
        ].filter(Boolean),
        // Unreleased catalog cross-reference
        ...(unreleasedLookup.has(track.id) ? { unreleased: unreleasedLookup.get(track.id) } : {}),
      };
    }) || [];

    // Set cover fallback: stored cover > YouTube thumbnail > SoundCloud artwork > null (never stock)
    let setCoverUrl = set.cover_url || getYouTubeThumbnail(extractYouTubeVideoId(set.youtube_url));
    if (!setCoverUrl && set.soundcloud_url) {
      setCoverUrl = await fetchSoundCloudArtwork(set.soundcloud_url);
    }

    // Transform set to match app's SetList type
    const artistImageUrl = set.artist?.image_url || null;
    const transformedSet = {
      id: set.id,
      name: set.title,
      artist: set.dj_name || 'Unknown Artist',
      venue: set.venue || null,
      eventName: set.event_name || null,
      date: set.event_date || set.created_at,
      totalDuration: set.duration_seconds || 0,
      trackCount: set.track_count || tracks.length,
      coverUrl: setCoverUrl,
      artistImageUrl,
      sourceLinks: [
        set.tracklist_url && { platform: '1001tracklists', url: set.tracklist_url },
        set.youtube_url && { platform: 'youtube', url: set.youtube_url },
        set.soundcloud_url && { platform: 'soundcloud', url: set.soundcloud_url },
        set.mixcloud_url && { platform: 'mixcloud', url: set.mixcloud_url },
        set.spotify_url && { platform: 'spotify', url: set.spotify_url },
        set.apple_music_url && { platform: 'apple', url: set.apple_music_url },
      ].filter(Boolean),
      source: set.source,
      tracks,
      hasGaps,
      gapCount,
      description: set.description,
      genre: set.genre,
      artistGenres,
      // Analysis flags
      youtubeAnalyzed: set.youtube_analyzed || false,
      soundcloudAnalyzed: set.soundcloud_analyzed || false,
    };

    return res.status(200).json({
      success: true,
      set: transformedSet,
      needsEnrichment,
    });

  } catch (error) {
    console.error('Set detail API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
