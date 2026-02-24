// Deezer search utility — free public API, no auth required
// Used by api/deezer-preview.js, api/deezer-enrich.js, and api/spotify-enrich.js
import { normalize } from './spotify-core.js';

/**
 * Strip parenthetical suffixes that break Deezer's strict matching
 * e.g., "Track Name (Chris Stussy Edit)" → "Track Name"
 */
export function cleanTitleForDeezer(title) {
  return title.replace(/\s*\([^)]*\)\s*/g, '').trim();
}

/**
 * Calculate how well a Deezer result matches our query.
 * Returns: 'exact' | 'strong' | 'loose' | null
 *
 * - exact:  normalized title AND artist are identical
 * - strong: one is a substring of the other (common with remix/edit suffix variations)
 * - loose:  only one field matches (not reliable enough to confirm released)
 */
export function scoreDeezerMatch(track, cleanedArtist, cleanedTitle) {
  const nt = normalize(track.title || '');
  const na = normalize(track.artist?.name || '');
  const qt = normalize(cleanedTitle);
  const qa = normalize(cleanedArtist);

  if (!nt || !na || !qt || !qa) return null;

  const titleExact = nt === qt;
  const titleStrong = nt.includes(qt) || qt.includes(nt);

  const artistExact = na === qa;
  const artistStrong = na.includes(qa) || qa.includes(na);

  if (titleExact && artistExact) return 'exact';
  if (titleStrong && artistStrong) return 'strong';
  if ((titleExact || titleStrong) && (artistExact || artistStrong)) return 'strong';
  return null; // Not a good enough match
}

/**
 * Search Deezer for a track and return full metadata.
 * No auth required — uses the public /search endpoint.
 *
 * Two-query strategy:
 *   1. Structured: artist:"Name" track:"Title"   (most precise)
 *   2. Simple fallback: Name Title               (broader)
 *
 * Returns a match object or null if no confident match found.
 *
 * Match grades:
 *   confidence: 'exact' | 'strong'
 *   (loose matches are filtered out — not confident enough to flip is_unreleased)
 */
export async function searchDeezerTrack(artist, title) {
  const cleanedTitle = cleanTitleForDeezer(title);
  const cleanedArtist = cleanTitleForDeezer(artist);

  if (!cleanedTitle || !cleanedArtist) return null;

  const queries = [
    `artist:"${cleanedArtist}" track:"${cleanedTitle}"`,
    `${cleanedArtist} ${cleanedTitle}`,
  ];

  // Track best candidate across queries
  let bestMatch = null;
  let bestScore = null; // 'exact' > 'strong'

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;

      const json = await res.json();
      const results = json?.data || [];

      for (const track of results) {
        const score = scoreDeezerMatch(track, cleanedArtist, cleanedTitle);
        if (!score) continue;

        // Keep the best match we find
        const isBetter = !bestScore ||
          (score === 'exact' && bestScore !== 'exact') ||
          (score === 'strong' && bestScore === null);

        if (isBetter) {
          bestScore = score;
          bestMatch = track;
        }

        if (bestScore === 'exact') break; // Can't do better
      }
    } catch {
      // Continue to next query
    }

    if (bestScore === 'exact') break; // Found best possible match
  }

  if (!bestMatch) return null;

  // Build rich metadata object from the Deezer track
  const images = {
    big: bestMatch.album?.cover_big || bestMatch.album?.cover_medium || bestMatch.album?.cover,
    small: bestMatch.album?.cover_small || bestMatch.album?.cover,
  };

  return {
    deezerId: bestMatch.id,
    deezerUrl: bestMatch.link,
    title: bestMatch.title,
    titleShort: bestMatch.title_short,
    artist: bestMatch.artist?.name,
    artistId: bestMatch.artist?.id,
    album: bestMatch.album?.title,
    albumArtUrl: images.big,
    albumArtSmall: images.small,
    previewUrl: bestMatch.preview || null,
    releaseDate: bestMatch.release_date || null,
    duration: bestMatch.duration || null, // seconds
    isrc: bestMatch.isrc || null,
    explicit: bestMatch.explicit_lyrics || false,
    confidence: bestScore, // 'exact' | 'strong'
    rank: bestMatch.rank || null,
  };
}

/**
 * Backward-compatible: search for just a preview URL.
 * Now delegates to searchDeezerTrack and extracts the preview.
 */
export async function searchDeezerPreview(artist, title) {
  const result = await searchDeezerTrack(artist, title);
  if (!result) return null;
  return {
    previewUrl: result.previewUrl,
    deezerTrackId: result.deezerId,
  };
}
