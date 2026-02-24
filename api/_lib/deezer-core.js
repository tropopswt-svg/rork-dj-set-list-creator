// Deezer search utility — free 30-second preview API (no auth required)
// Used by api/deezer-preview.js and api/spotify-enrich.js
import { normalize } from './spotify-core.js';

/**
 * Strip parenthetical suffixes that break Deezer's strict matching
 * e.g., "Track Name (Chris Stussy Edit)" → "Track Name"
 */
export function cleanTitleForDeezer(title) {
  return title.replace(/\s*\([^)]*\)\s*/g, '').trim();
}

/**
 * Search Deezer for a track preview URL.
 * Two-query strategy: structured query first, then simple fallback.
 * Returns { previewUrl, deezerTrackId } or null.
 */
export async function searchDeezerPreview(artist, title) {
  const cleanedTitle = cleanTitleForDeezer(title);
  const cleanedArtist = cleanTitleForDeezer(artist);

  if (!cleanedTitle || !cleanedArtist) return null;

  // Try structured query first, then simple fallback
  const queries = [
    `artist:"${cleanedArtist}" track:"${cleanedTitle}"`,
    `${cleanedArtist} ${cleanedTitle}`,
  ];

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`
      );
      if (!res.ok) continue;

      const json = await res.json();
      const results = json?.data || [];

      // First pass: look for a validated match
      for (const track of results) {
        if (!track.preview) continue;

        const titleMatch =
          normalize(track.title) === normalize(cleanedTitle) ||
          normalize(track.title).includes(normalize(cleanedTitle)) ||
          normalize(cleanedTitle).includes(normalize(track.title));

        const artistMatch =
          normalize(track.artist?.name || '') === normalize(cleanedArtist) ||
          normalize(track.artist?.name || '').includes(normalize(cleanedArtist)) ||
          normalize(cleanedArtist).includes(normalize(track.artist?.name || ''));

        if (titleMatch && artistMatch) {
          return {
            previewUrl: track.preview,
            deezerTrackId: track.id,
          };
        }
      }

      // Second pass: take first result with a preview —
      // the query itself is already scoped to artist+track, so trust it
      const firstWithPreview = results.find(t => t.preview);
      if (firstWithPreview) {
        return {
          previewUrl: firstWithPreview.preview,
          deezerTrackId: firstWithPreview.id,
        };
      }
    } catch {
      // Continue to next query
    }
  }

  return null;
}
