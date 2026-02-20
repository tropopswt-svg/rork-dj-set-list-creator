// Shared Spotify utilities — extracted from spotify-enrich.js
// Used by spotify-enrich.js, spotify-drip.js, and sets/[id].js
import { createClient } from '@supabase/supabase-js';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
let spotifyToken = null;
let spotifyTokenExpiry = 0;

export function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export async function getSpotifyToken() {
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

export function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(unreleased|free download|clip|preview|edit|remix|original mix)\b/gi, '')
    .trim();
}

export async function searchTrackOnSpotify(token, artist, title) {
  const cleanTitle = title
    .replace(/\(unreleased\)/gi, '')
    .replace(/\(free download\)/gi, '')
    .replace(/\(clip\)/gi, '')
    .trim();

  const query = encodeURIComponent(`track:${cleanTitle} artist:${artist}`);

  let response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  // Handle rate limiting — return signal instead of retrying
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    return { _rateLimited: true, _retryAfter: retryAfter };
  }

  if (!response.ok) return null;

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

export async function searchArtistOnSpotify(token, artistName) {
  const query = encodeURIComponent(artistName);

  const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=artist&limit=5`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    return { _rateLimited: true, _retryAfter: retryAfter };
  }

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
