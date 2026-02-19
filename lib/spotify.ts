/**
 * Shared Spotify Service
 *
 * Provides Spotify track/artist matching, release-checking, and data enrichment.
 * Uses client credentials flow (no user login needed).
 */

// Spotify config
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
let spotifyToken: string | null = null;
let spotifyTokenExpiry = 0;

// ============================================
// Types
// ============================================

export interface SpotifyTrackData {
  found: boolean;
  spotifyId?: string;
  title?: string;
  artist?: string;
  artists?: string[];
  album?: string;
  albumArt?: string;        // High-res album artwork URL
  albumArtSmall?: string;   // 64px thumbnail
  previewUrl?: string;      // 30-second preview MP3
  spotifyUrl?: string;      // Open in Spotify link
  isrc?: string;            // International Standard Recording Code
  durationMs?: number;
  releaseDate?: string;     // YYYY-MM-DD or YYYY
  popularity?: number;      // 0-100
  label?: string;
}

export interface SpotifyArtistData {
  found: boolean;
  spotifyId?: string;
  name?: string;
  imageUrl?: string;        // Artist profile image
  imageUrlSmall?: string;
  genres?: string[];
  popularity?: number;      // 0-100
  followers?: number;
  spotifyUrl?: string;
}

// ============================================
// Helpers
// ============================================

/**
 * Normalize a string for fuzzy comparison.
 * Lowercases, strips special chars, removes common music keywords.
 */
export function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(unreleased|free download|clip|preview|edit|remix|original mix)\b/gi, '')
    .trim();
}

/**
 * Get a Spotify access token via client credentials flow.
 * Returns null when SPOTIFY_CLIENT_ID/SECRET are not set (graceful skip).
 * Caches the token until 60s before expiry.
 */
export async function getSpotifyToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;
  if (spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken;

  try {
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
  } catch {
    return null;
  }
}

// ============================================
// Track Matching & Enrichment
// ============================================

/**
 * Search Spotify for a track and return full metadata.
 * This is the main enrichment function — returns album art, preview URL, ISRC, etc.
 */
export async function searchSpotifyTrack(artist: string, title: string): Promise<SpotifyTrackData> {
  const token = await getSpotifyToken();
  if (!token) return { found: false };

  const cleanTitle = title
    .replace(/\(unreleased\)/gi, '')
    .replace(/\(free download\)/gi, '')
    .replace(/\(clip\)/gi, '')
    .trim();

  const query = encodeURIComponent(`track:${cleanTitle} artist:${artist}`);

  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) return { found: false };

    const data = await response.json();
    const tracks = data.tracks?.items || [];

    for (const track of tracks) {
      const titleSim = normalize(track.name) === normalize(cleanTitle) ||
        normalize(track.name).includes(normalize(cleanTitle)) ||
        normalize(cleanTitle).includes(normalize(track.name));
      const artistMatch = track.artists.some((a: any) =>
        normalize(a.name).includes(normalize(artist)) ||
        normalize(artist).includes(normalize(a.name))
      );

      if (titleSim && artistMatch) {
        // Get the best album art (largest available)
        const images = track.album?.images || [];
        const albumArt = images.find((i: any) => i.width >= 300)?.url || images[0]?.url;
        const albumArtSmall = images.find((i: any) => i.width <= 64)?.url || images[images.length - 1]?.url;

        return {
          found: true,
          spotifyId: track.id,
          title: track.name,
          artist: track.artists[0]?.name,
          artists: track.artists.map((a: any) => a.name),
          album: track.album?.name,
          albumArt,
          albumArtSmall,
          previewUrl: track.preview_url || undefined,
          spotifyUrl: track.external_urls?.spotify,
          isrc: track.external_ids?.isrc,
          durationMs: track.duration_ms,
          releaseDate: track.album?.release_date,
          popularity: track.popularity,
          label: undefined, // Not available in search results, need album endpoint
        };
      }
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}

/**
 * Simple check if a track exists on Spotify.
 * Backwards-compatible wrapper around searchSpotifyTrack.
 */
export async function isOnSpotify(artist: string, title: string): Promise<{ found: boolean; url?: string }> {
  const result = await searchSpotifyTrack(artist, title);
  return { found: result.found, url: result.spotifyUrl };
}

// ============================================
// Artist Matching & Enrichment
// ============================================

/**
 * Search Spotify for an artist and return full metadata.
 * Returns image, genres, popularity, followers.
 */
export async function searchSpotifyArtist(artistName: string): Promise<SpotifyArtistData> {
  const token = await getSpotifyToken();
  if (!token) return { found: false };

  const query = encodeURIComponent(artistName);

  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=artist&limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) return { found: false };

    const data = await response.json();
    const artists = data.artists?.items || [];

    for (const artist of artists) {
      if (normalize(artist.name) === normalize(artistName) ||
          normalize(artist.name).includes(normalize(artistName)) ||
          normalize(artistName).includes(normalize(artist.name))) {

        const images = artist.images || [];
        const imageUrl = images.find((i: any) => i.width >= 300)?.url || images[0]?.url;
        const imageUrlSmall = images.find((i: any) => i.width <= 64)?.url || images[images.length - 1]?.url;

        return {
          found: true,
          spotifyId: artist.id,
          name: artist.name,
          imageUrl,
          imageUrlSmall,
          genres: artist.genres || [],
          popularity: artist.popularity,
          followers: artist.followers?.total,
          spotifyUrl: artist.external_urls?.spotify,
        };
      }
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}

/**
 * Check for a similar track already in the unreleased_tracks bucket (fuzzy match).
 * Matches on normalized artist + title + duration within 30 seconds.
 */
export async function isDuplicateInBucket(
  artist: string,
  title: string,
  duration: number,
  supabase: any
): Promise<{ isDuplicate: boolean; existingId?: string }> {
  // Get existing unreleased tracks
  const { data: existing } = await supabase
    .from('unreleased_tracks')
    .select('id, artist, title, audio_duration_seconds')
    .eq('is_active', true)
    .limit(500);

  if (!existing) return { isDuplicate: false };

  const normalizedArtist = normalize(artist);
  const normalizedTitle = normalize(title);

  for (const track of existing) {
    const existingArtist = normalize(track.artist || '');
    const existingTitle = normalize(track.title || '');

    // Check for similar title/artist
    const titleMatch = existingTitle === normalizedTitle ||
      existingTitle.includes(normalizedTitle) ||
      normalizedTitle.includes(existingTitle);

    const artistMatch = existingArtist === normalizedArtist ||
      existingArtist.includes(normalizedArtist) ||
      normalizedArtist.includes(existingArtist);

    // Duration within 30 seconds
    const durationMatch = Math.abs((track.audio_duration_seconds || 0) - duration) < 30;

    if (titleMatch && artistMatch && durationMatch) {
      return { isDuplicate: true, existingId: track.id };
    }
  }

  return { isDuplicate: false };
}
