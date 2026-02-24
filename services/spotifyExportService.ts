/**
 * Spotify Playlist Export Service
 *
 * Resolves tracks to Spotify URIs, creates a playlist on the user's
 * account, and adds matched tracks in batches.
 */
import { Track } from '@/types';
import { normalize } from '@/lib/spotify';
import { getPublicTrackStatus } from '@/lib/trackStatus';
import {
  authenticateWithSpotify,
  getValidAccessToken,
  getSpotifyUserId,
  isSpotifyConnected,
} from './spotifyAuth';

// ============================================
// Types
// ============================================

export type ExportPhase =
  | 'authenticating'
  | 'resolving'
  | 'creating'
  | 'adding'
  | 'done'
  | 'error';

export interface ExportProgress {
  phase: ExportPhase;
  current: number;
  total: number;
  message: string;
}

export interface ExportResult {
  success: boolean;
  playlistUrl?: string;
  tracksAdded: number;
  tracksNotFound: { title: string; artist: string; reason: 'unreleased' | 'id' | 'not_found' }[];
  totalTracks: number;
  error?: string;
}

// ============================================
// Main Export Function
// ============================================

export async function exportSetToSpotify(
  setName: string,
  artist: string,
  tracks: Track[],
  onProgress: (progress: ExportProgress) => void,
): Promise<ExportResult> {
  const notFound: ExportResult['tracksNotFound'] = [];
  const totalTracks = tracks.length;

  try {
    // --- Phase 1: Authenticate ---
    onProgress({ phase: 'authenticating', current: 0, total: totalTracks, message: 'Connecting to Spotify...' });

    let accessToken = await getValidAccessToken();

    if (!accessToken) {
      const connected = await isSpotifyConnected();
      if (!connected) {
        const ok = await authenticateWithSpotify();
        if (!ok) {
          return { success: false, tracksAdded: 0, tracksNotFound: [], totalTracks, error: 'Spotify login was cancelled.' };
        }
      }
      accessToken = await getValidAccessToken();
      if (!accessToken) {
        return { success: false, tracksAdded: 0, tracksNotFound: [], totalTracks, error: 'Could not get Spotify access token.' };
      }
    }

    const userId = await getSpotifyUserId();
    if (!userId) {
      // Fetch user ID with the token we have
      const meResp = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meResp.ok) {
        return { success: false, tracksAdded: 0, tracksNotFound: [], totalTracks, error: 'Could not fetch Spotify user profile.' };
      }
    }
    const finalUserId = userId || (await fetchUserId(accessToken));
    if (!finalUserId) {
      return { success: false, tracksAdded: 0, tracksNotFound: [], totalTracks, error: 'Could not determine Spotify user ID.' };
    }

    // --- Phase 2: Resolve tracks ---
    onProgress({ phase: 'resolving', current: 0, total: totalTracks, message: 'Matching tracks...' });

    const spotifyUris: string[] = [];

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];

      // Keep public status model strict: released | unreleased | id
      const status = getPublicTrackStatus(track);
      if (status === 'unreleased') {
        notFound.push({ title: track.title, artist: track.artist, reason: 'unreleased' });
        onProgress({
          phase: 'resolving',
          current: i + 1,
          total: totalTracks,
          message: `Skipping unreleased: ${track.artist} - ${track.title}`,
        });
        continue;
      }

      if (status === 'id') {
        notFound.push({ title: track.title, artist: track.artist, reason: 'id' });
        onProgress({
          phase: 'resolving',
          current: i + 1,
          total: totalTracks,
          message: `Skipping ID: ${track.artist} - ${track.title}`,
        });
        continue;
      }

      onProgress({
        phase: 'resolving',
        current: i + 1,
        total: totalTracks,
        message: `Matching ${i + 1}/${totalTracks}: ${track.artist} - ${track.title}`,
      });

      // Priority 1: Existing Spotify link from enrichment
      const spotifyLink = track.trackLinks?.find((l) => l.platform === 'spotify');
      if (spotifyLink?.url) {
        const trackId = extractSpotifyTrackId(spotifyLink.url);
        if (trackId) {
          spotifyUris.push(`spotify:track:${trackId}`);
          continue;
        }
      }

      // Priority 2: Search Spotify
      const searchResult = await searchSpotifyForTrack(accessToken, track.artist, track.title);
      if (searchResult) {
        spotifyUris.push(`spotify:track:${searchResult}`);
      } else {
        notFound.push({ title: track.title, artist: track.artist, reason: 'not_found' });
      }
    }

    if (spotifyUris.length === 0) {
      return {
        success: false,
        tracksAdded: 0,
        tracksNotFound: notFound,
        totalTracks,
        error: 'No tracks could be matched on Spotify.',
      };
    }

    // --- Phase 3: Create playlist ---
    onProgress({ phase: 'creating', current: 0, total: 1, message: 'Creating playlist...' });

    const playlistName = `${artist} — ${setName}`;
    const playlistDesc = `Exported from trakd • ${spotifyUris.length} tracks`;

    const createResp = await fetch(`https://api.spotify.com/v1/users/${encodeURIComponent(finalUserId)}/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: playlistName,
        description: playlistDesc,
        public: false,
      }),
    });

    if (!createResp.ok) {
      const err = await createResp.text();
      return { success: false, tracksAdded: 0, tracksNotFound: notFound, totalTracks, error: `Failed to create playlist: ${err}` };
    }

    const playlist = await createResp.json();
    const playlistId = playlist.id;
    const playlistUrl = playlist.external_urls?.spotify;

    // --- Phase 4: Add tracks in batches of 100 ---
    onProgress({ phase: 'adding', current: 0, total: spotifyUris.length, message: 'Adding tracks to playlist...' });

    let tracksAdded = 0;
    for (let i = 0; i < spotifyUris.length; i += 100) {
      const batch = spotifyUris.slice(i, i + 100);

      const addResp = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: batch }),
      });

      if (addResp.ok) {
        tracksAdded += batch.length;
      }

      onProgress({
        phase: 'adding',
        current: Math.min(i + 100, spotifyUris.length),
        total: spotifyUris.length,
        message: `Added ${tracksAdded} tracks...`,
      });
    }

    // --- Done ---
    onProgress({ phase: 'done', current: tracksAdded, total: totalTracks, message: 'Export complete!' });

    return {
      success: true,
      playlistUrl,
      tracksAdded,
      tracksNotFound: notFound,
      totalTracks,
    };
  } catch (error: any) {
    return {
      success: false,
      tracksAdded: 0,
      tracksNotFound: notFound,
      totalTracks,
      error: error?.message || 'An unexpected error occurred.',
    };
  }
}

// ============================================
// Helpers
// ============================================

function extractSpotifyTrackId(url: string): string | null {
  // https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh?si=...
  const match = url.match(/track\/([a-zA-Z0-9]+)/);
  return match?.[1] || null;
}

async function fetchUserId(accessToken: string): Promise<string | null> {
  try {
    const resp = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.id || null;
  } catch {
    return null;
  }
}

/**
 * Search Spotify for a track using the user's OAuth token.
 * Reuses the normalize() function from lib/spotify.ts for fuzzy matching.
 * Returns the Spotify track ID or null.
 */
async function searchSpotifyForTrack(
  accessToken: string,
  artist: string,
  title: string,
): Promise<string | null> {
  const cleanTitle = title
    .replace(/\(unreleased\)/gi, '')
    .replace(/\(free download\)/gi, '')
    .replace(/\(clip\)/gi, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '')
    .trim();

  let query: string;
  try {
    query = encodeURIComponent(`track:${cleanTitle} artist:${artist}`);
  } catch {
    const safeTitle = cleanTitle.replace(/[^\w\s-]/g, '').trim();
    const safeArtist = artist.replace(/[^\w\s-]/g, '').trim();
    if (!safeTitle && !safeArtist) return null;
    query = encodeURIComponent(`track:${safeTitle} artist:${safeArtist}`);
  }

  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;

    const data = await response.json();
    const tracks = data.tracks?.items || [];

    for (const track of tracks) {
      const titleSim =
        normalize(track.name) === normalize(cleanTitle) ||
        normalize(track.name).includes(normalize(cleanTitle)) ||
        normalize(cleanTitle).includes(normalize(track.name));
      const artistMatch = track.artists.some(
        (a: any) =>
          normalize(a.name).includes(normalize(artist)) ||
          normalize(artist).includes(normalize(a.name)),
      );

      if (titleSim && artistMatch) {
        return track.id;
      }
    }
    return null;
  } catch {
    return null;
  }
}
