/**
 * Shared Spotify Service
 *
 * Provides Spotify release-checking and bucket deduplication logic
 * used by both the SoundCloud scraper and social media scrapers.
 */

// Spotify config
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
let spotifyToken: string | null = null;
let spotifyTokenExpiry = 0;

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

/**
 * Check if a track is already released on Spotify.
 * Searches by artist + title, fuzzy matches on normalized strings.
 * Returns { found: false } when credentials are missing (graceful skip).
 */
export async function isOnSpotify(artist: string, title: string): Promise<{ found: boolean; url?: string }> {
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
        return { found: true, url: track.external_urls?.spotify };
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
