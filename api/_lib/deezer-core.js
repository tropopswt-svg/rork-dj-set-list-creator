// Deezer search utility — free public API, no auth required
// Used by api/deezer-preview.js, api/deezer-enrich.js, and api/spotify-enrich.js
import { normalize } from './spotify-core.js';

/**
 * Strip ALL parenthetical and bracketed sections from a title.
 * Applied to BOTH the query AND the Deezer result before comparison.
 *
 * Why: Deezer often stores titles like "Track Name (Good Life)" or
 * "Track Name [Extended Mix]" where the part in brackets is a subtitle.
 * Without stripping both sides, "Good Life" would falsely match
 * "A Place You Wanna Go (Good Life)".
 *
 * e.g., "Track Name (Chris Stussy Edit)" → "Track Name"
 *       "A Place You Wanna Go (Good Life)" → "A Place You Wanna Go"
 *       "Wide Awake [Dub] (Mixed)" → "Wide Awake"
 */
export function cleanTitleForDeezer(title) {
  return (title || '')
    .replace(/\s*[\[(][^\])\[()]*[\])]\s*/g, '') // strip (…) and […]
    .trim();
}

/**
 * Word-count ratio check for substring matches.
 * The shorter string must be at least MIN_RATIO of the longer string's
 * word count. Prevents short queries ("Good Life", 2 words) from matching
 * against long unrelated Deezer titles ("A Place You Wanna Go", 5 words).
 *
 * e.g. "good life" (2 words) vs "place you wanna go" (4 words) → 2/4 = 0.5 → FAIL
 *      "wide awake" (2 words) vs "wide awake" (2 words) → exact anyway
 *      "club scene" (2 words) vs "club scene" (2 words) → exact anyway
 */
const SUBSTRING_RATIO = 0.6; // shorter must be ≥60% of longer by word count

/**
 * Returns true if the track title is a DJ edit (e.g. "Jumbo (Chris Stussy Edit)").
 * DJ edits are typically unreleased tools — callers should skip Deezer lookup.
 */
export function isDjEditTitle(title) {
  return /\((?:[^)]*\s)?edit\)/i.test(title || '');
}

/**
 * Extracts a "(X Remix)" / "(X Mix)" / "(X Rework)" version tag from a raw title.
 * Used for version coherence: "(Chris Stussy Remix)" must not match "(Malin Genie Remix)".
 */
function extractRemixTag(title) {
  const m = (title || '').match(/\(([^)]*(?:remix|rework|re-?edit|re-?work)[^)]*)\)/i);
  return m ? m[1].toLowerCase().trim() : null;
}

function hasSubstantialOverlap(a, b) {
  const wa = a.split(' ').filter(Boolean).length;
  const wb = b.split(' ').filter(Boolean).length;
  if (wa === 0 || wb === 0) return false;
  const [shorter, longer] = wa <= wb ? [wa, wb] : [wb, wa];
  return shorter / longer >= SUBSTRING_RATIO;
}

/**
 * Calculate how well a Deezer result matches our query.
 *
 * Critical: BOTH sides are cleaned (parenthetical stripped) before comparison.
 * This prevents subtitle artifacts on Deezer from creating false positives.
 *
 * Returns: 'exact' | 'strong' | null
 *
 * - exact:  cleaned+normalized title AND artist are identical after stripping
 * - strong: one cleaned title is a substring of the other AND word counts are
 *           within 60% ratio (guards against short-word false positives)
 */
export function scoreDeezerMatch(track, cleanedArtist, cleanedTitle, rawQueryTitle) {
  // Clean BOTH the query AND the Deezer result before normalizing
  const nt = normalize(cleanTitleForDeezer(track.title || ''));
  const na = normalize(track.artist?.name || '');
  const qt = normalize(cleanedTitle);   // already cleaned by caller
  const qa = normalize(cleanedArtist); // already cleaned by caller

  if (!nt || !na || !qt || !qa) return null;

  // Version coherence for remix-tagged queries:
  //   "(Chris Stussy Remix)" must NOT match "(Malin Genie Remix)" — different remixes
  //   "(Chris Stussy Remix)" must NOT match base "First Night Out" — can't confirm specific remix
  //   "(MK Dub)" has no remix tag → no check → base track match is fine
  if (rawQueryTitle) {
    const qRemix = extractRemixTag(rawQueryTitle);
    const dRemix = extractRemixTag(track.title || '');
    if (qRemix && (!dRemix || qRemix !== dRemix)) return null;
  }

  const titleExact  = nt === qt;
  // Substring match only counts if the word counts are close enough
  const titleStrong = !titleExact && (nt.includes(qt) || qt.includes(nt)) && hasSubstantialOverlap(nt, qt);

  const artistExact  = na === qa;
  const artistStrong = !artistExact && (na.includes(qa) || qa.includes(na));

  if (titleExact && artistExact)   return 'exact';
  if ((titleExact || titleStrong) && (artistExact || artistStrong)) return 'strong';
  return null;
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
 *   (unmatched or loose are returned as null)
 */
export async function searchDeezerTrack(artist, title) {
  const cleanedTitle  = cleanTitleForDeezer(title);
  const cleanedArtist = cleanTitleForDeezer(artist);

  if (!cleanedTitle || !cleanedArtist) return null;

  const queries = [
    `artist:"${cleanedArtist}" track:"${cleanedTitle}"`,
    `${cleanedArtist} ${cleanedTitle}`,
  ];

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
        const score = scoreDeezerMatch(track, cleanedArtist, cleanedTitle, title);
        if (!score) continue;

        const isBetter = !bestScore ||
          (score === 'exact' && bestScore !== 'exact');

        if (isBetter) {
          bestScore = score;
          bestMatch = track;
        }

        if (bestScore === 'exact') break;
      }
    } catch {
      // Continue to next query
    }

    if (bestScore === 'exact') break;
  }

  if (!bestMatch) return null;

  const images = {
    big:   bestMatch.album?.cover_big || bestMatch.album?.cover_medium || bestMatch.album?.cover,
    small: bestMatch.album?.cover_small || bestMatch.album?.cover,
  };

  return {
    deezerId:      bestMatch.id,
    deezerUrl:     bestMatch.link,
    title:         bestMatch.title,
    titleShort:    bestMatch.title_short,
    artist:        bestMatch.artist?.name,
    artistId:      bestMatch.artist?.id,
    album:         bestMatch.album?.title,
    albumArtUrl:   images.big,
    albumArtSmall: images.small,
    previewUrl:    bestMatch.preview || null,
    releaseDate:   bestMatch.release_date || null,
    duration:      bestMatch.duration || null, // seconds
    isrc:          bestMatch.isrc || null,
    explicit:      bestMatch.explicit_lyrics || false,
    confidence:    bestScore, // 'exact' | 'strong'
    rank:          bestMatch.rank || null,
  };
}

/**
 * Backward-compatible: search for just a preview URL.
 */
export async function searchDeezerPreview(artist, title) {
  const result = await searchDeezerTrack(artist, title);
  if (!result) return null;
  return {
    previewUrl:    result.previewUrl,
    deezerTrackId: result.deezerId,
  };
}
