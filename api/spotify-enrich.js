// API endpoint to enrich tracks and artists with Spotify data
// POST /api/spotify-enrich
// Actions: enrich-set (enrich all tracks in a set), enrich-batch (batch enrich tracks), enrich-artists
import { createClient } from '@supabase/supabase-js';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
let spotifyToken = null;
let spotifyTokenExpiry = 0;

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

async function getSpotifyToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;
  if (spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken;

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) return null;
  const data = await response.json();
  spotifyToken = data.access_token;
  spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyToken;
}

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(unreleased|free download|clip|preview|edit|remix|original mix)\b/gi, '')
    .trim();
}

async function searchTrackOnSpotify(token, artist, title) {
  const cleanTitle = title
    .replace(/\(unreleased\)/gi, '')
    .replace(/\(free download\)/gi, '')
    .replace(/\(clip\)/gi, '')
    .trim();

  const query = encodeURIComponent(`track:${cleanTitle} artist:${artist}`);

  let response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  // Handle rate limiting — wait and retry once
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
    await new Promise(r => setTimeout(r, (retryAfter + 1) * 1000));
    response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
  }

  if (!response.ok) return { _rateLimited: response.status === 429 };

  const data = await response.json();
  const tracks = data.tracks?.items || [];

  for (const track of tracks) {
    const titleSim = normalize(track.name) === normalize(cleanTitle) ||
      normalize(track.name).includes(normalize(cleanTitle)) ||
      normalize(cleanTitle).includes(normalize(track.name));
    const artistMatch = track.artists.some(a =>
      normalize(a.name).includes(normalize(artist)) ||
      normalize(artist).includes(normalize(a.name))
    );

    if (titleSim && artistMatch) {
      const images = track.album?.images || [];
      const albumArt = images.find(i => i.width >= 300)?.url || images[0]?.url;

      return {
        spotify_id: track.id,
        title: track.name,
        artist: track.artists[0]?.name,
        artists: track.artists.map(a => a.name),
        album: track.album?.name,
        album_art_url: albumArt || null,
        preview_url: track.preview_url || null,
        spotify_url: track.external_urls?.spotify || null,
        isrc: track.external_ids?.isrc || null,
        duration_ms: track.duration_ms,
        release_date: track.album?.release_date || null,
        popularity: track.popularity || 0,
      };
    }
  }
  return null;
}

async function searchArtistOnSpotify(token, artistName) {
  const query = encodeURIComponent(artistName);

  const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=artist&limit=5`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) return null;

  const data = await response.json();
  const artists = data.artists?.items || [];

  for (const artist of artists) {
    if (normalize(artist.name) === normalize(artistName) ||
        normalize(artist.name).includes(normalize(artistName)) ||
        normalize(artistName).includes(normalize(artist.name))) {

      const images = artist.images || [];
      const imageUrl = images.find(i => i.width >= 300)?.url || images[0]?.url;

      return {
        spotify_id: artist.id,
        name: artist.name,
        image_url: imageUrl || null,
        genres: artist.genres || [],
        popularity: artist.popularity || 0,
        followers_count: artist.followers?.total || 0,
        spotify_url: artist.external_urls?.spotify || null,
      };
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const hasCredentials = !!(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET);
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
      const results = [];

      for (const track of tracks || []) {
        // Skip if already has Spotify data
        if (track.spotify_data?.spotify_id) { skipped++; continue; }
        if (!track.artist_name || !track.track_title) { skipped++; continue; }

        // Rate limit: ~1 request/sec to stay safely under Spotify limits
        await new Promise(r => setTimeout(r, 1000));

        const spotifyData = await searchTrackOnSpotify(token, track.artist_name, track.track_title);

        if (spotifyData?._rateLimited) {
          // Rate limited — stop, don't mark remaining tracks
          break;
        }

        if (spotifyData && !spotifyData._rateLimited) {
          await supabase
            .from('set_tracks')
            .update({ spotify_data: spotifyData })
            .eq('id', track.id);

          enriched++;
          results.push({
            track: `${track.artist_name} - ${track.track_title}`,
            spotify: `${spotifyData.artist} - ${spotifyData.title}`,
            albumArt: !!spotifyData.album_art_url,
            previewUrl: !!spotifyData.preview_url,
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
      let rateLimited = false;

      for (const track of tracks || []) {
        await new Promise(r => setTimeout(r, 1000));

        const spotifyData = await searchTrackOnSpotify(token, track.artist_name, track.track_title);

        if (spotifyData?._rateLimited) {
          // Rate limited even after retry — stop processing, don't mark as not found
          rateLimited = true;
          break;
        }

        if (spotifyData && !spotifyData._rateLimited) {
          await supabase
            .from('set_tracks')
            .update({ spotify_data: spotifyData })
            .eq('id', track.id);
          enriched++;
        } else {
          // Mark as checked so we don't re-query
          await supabase
            .from('set_tracks')
            .update({ spotify_data: { checked: true, found: false } })
            .eq('id', track.id);
          notFound++;
        }
      }

      return res.status(200).json({
        success: true,
        action: 'enrich-batch',
        total: (tracks || []).length,
        rateLimited,
        enriched,
        notFound,
      });
    }

    // ========== ENRICH ARTISTS — artists without Spotify data ==========
    if (action === 'enrich-artists') {
      // Get unique DJ names from sets
      const { data: sets, error } = await supabase
        .from('sets')
        .select('dj_name, dj_id')
        .not('dj_name', 'is', null)
        .neq('dj_name', '');

      if (error) throw error;

      // Deduplicate by name
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

        // If artist has a dj_id, check if they already have Spotify data
        if (djId) {
          const { data: existingArtist } = await supabase
            .from('artists')
            .select('spotify_url, image_url')
            .eq('id', djId)
            .single();

          if (existingArtist?.spotify_url) { skipped++; count++; continue; }
        }

        await new Promise(r => setTimeout(r, 1000));

        const spotifyData = await searchArtistOnSpotify(token, name);

        if (spotifyData) {
          // Update artist record if dj_id exists
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
          notFound++;
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
