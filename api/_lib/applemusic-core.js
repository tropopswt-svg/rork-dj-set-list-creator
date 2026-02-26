// Shared Apple Music utilities — mirrors spotify-core.js pattern
// Used by applemusic-enrich.js, applemusic-drip.js, and spotify-enrich.js (cascade)
import { createClient } from '@supabase/supabase-js';
import { createPrivateKey, createSign } from 'crypto';
import { normalize } from './spotify-core.js';

const APPLE_MUSIC_TEAM_ID = process.env.APPLE_MUSIC_TEAM_ID;
const APPLE_MUSIC_KEY_ID = process.env.APPLE_MUSIC_KEY_ID;
const APPLE_MUSIC_PRIVATE_KEY = process.env.APPLE_MUSIC_PRIVATE_KEY; // base64 PEM

let appleMusicToken = null;
let appleMusicTokenExpiry = 0;

/**
 * Generate a self-signed ES256 JWT developer token for Apple Music API.
 * Cached for 30 days (token lifetime is up to 6 months).
 */
export function getAppleMusicToken() {
  if (!APPLE_MUSIC_TEAM_ID || !APPLE_MUSIC_KEY_ID || !APPLE_MUSIC_PRIVATE_KEY) return null;
  if (appleMusicToken && Date.now() < appleMusicTokenExpiry) return appleMusicToken;

  try {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 30 * 24 * 60 * 60; // 30 days

    // JWT header
    const header = {
      alg: 'ES256',
      kid: APPLE_MUSIC_KEY_ID,
    };

    // JWT payload
    const payload = {
      iss: APPLE_MUSIC_TEAM_ID,
      iat: now,
      exp: expiry,
    };

    // Base64url encode
    const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signingInput = `${b64url(header)}.${b64url(payload)}`;

    // Decode PEM from base64 env var
    const pemKey = Buffer.from(APPLE_MUSIC_PRIVATE_KEY, 'base64').toString('utf8');
    const privateKey = createPrivateKey({
      key: pemKey,
      format: 'pem',
    });

    // Sign with ES256
    const sign = createSign('SHA256');
    sign.update(signingInput);
    const derSig = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
    const signature = derSig.toString('base64url');

    appleMusicToken = `${signingInput}.${signature}`;
    appleMusicTokenExpiry = Date.now() + 29 * 24 * 60 * 60 * 1000; // Refresh 1 day early

    return appleMusicToken;
  } catch (err) {
    console.error('[applemusic-core] Token generation error:', err);
    return null;
  }
}

/**
 * Lookup a track by ISRC on Apple Music catalog (exact match).
 * Returns formatted track or null.
 */
export async function lookupByISRC(token, isrc) {
  if (!token || !isrc) return null;

  try {
    const response = await fetch(
      `https://api.music.apple.com/v1/catalog/us/songs?filter[isrc]=${encodeURIComponent(isrc)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      return { _rateLimited: true, _retryAfter: retryAfter };
    }

    if (!response.ok) return null;

    const data = await response.json();
    const songs = data?.data || [];
    if (songs.length === 0) return null;

    return formatAppleMusicTrack(songs[0]);
  } catch (err) {
    console.error('[applemusic-core] ISRC lookup error:', err.message);
    return null;
  }
}

/**
 * Two-pass text search on Apple Music catalog.
 * Pass 1: artist+title query, 0.75 similarity + artist match required
 * Pass 2: title-only, 0.88 threshold (catches wrong/abbreviated artist)
 */
export async function searchTrackOnAppleMusic(token, artist, title) {
  if (!token) return null;

  const cleanTitle = title
    .replace(/\(unreleased\)/gi, '')
    .replace(/\(free download\)/gi, '')
    .replace(/\(clip\)/gi, '')
    .trim();

  const unknownArtist = !artist || /^(unknown|unknown artist|id|n\/a|various)$/i.test(artist.trim());

  // Pass 1: strict query with artist
  if (!unknownArtist) {
    const strictResults = await fetchAppleMusicTracks(token, `${artist} ${cleanTitle}`, 5);
    if (strictResults?._rateLimited) return strictResults;

    for (const song of strictResults) {
      const formatted = formatAppleMusicTrack(song);
      const ts = titleSimilarity(formatted.title, cleanTitle);
      const artistMatch = normalize(formatted.artist).includes(normalize(artist)) ||
        normalize(artist).includes(normalize(formatted.artist));
      if (ts >= 0.75 && artistMatch) return formatted;
    }
  }

  // Pass 2: title-only search
  const titleResults = await fetchAppleMusicTracks(token, cleanTitle, 8);
  if (titleResults?._rateLimited) return titleResults;

  for (const song of titleResults) {
    const formatted = formatAppleMusicTrack(song);
    const ts = titleSimilarity(formatted.title, cleanTitle);
    if (ts < 0.75) continue;

    const artistMatch = !unknownArtist && (
      normalize(formatted.artist).includes(normalize(artist)) ||
      normalize(artist).includes(normalize(formatted.artist))
    );

    if (artistMatch && ts >= 0.75) return formatted;
    if (!artistMatch && ts >= 0.88) return formatted;
  }

  return null;
}

/**
 * Fetch Apple Music search results for a query string.
 */
async function fetchAppleMusicTracks(token, query, limit = 5) {
  try {
    const response = await fetch(
      `https://api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(query)}&types=songs&limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      return { _rateLimited: true, _retryAfter: retryAfter };
    }

    if (!response.ok) return [];

    const data = await response.json();
    return data?.results?.songs?.data || [];
  } catch (err) {
    console.error('[applemusic-core] Search error:', err.message);
    return [];
  }
}

/**
 * Format an Apple Music song resource into a standard track object.
 * Resolves {w}x{h} artwork template to 1400x1400.
 */
export function formatAppleMusicTrack(song) {
  const attr = song.attributes || {};
  const artworkTemplate = attr.artwork?.url || '';
  const artworkUrl = artworkTemplate
    ? artworkTemplate.replace('{w}', '1400').replace('{h}', '1400')
    : null;

  return {
    apple_music_id: song.id,
    title: attr.name || '',
    artist: attr.artistName || '',
    album: attr.albumName || '',
    apple_music_artwork_url: artworkUrl,
    apple_music_url: attr.url || null,
    apple_music_preview_url: attr.previews?.[0]?.url || null,
    isrc: attr.isrc || null,
    duration_ms: attr.durationInMillis || null,
    release_date: attr.releaseDate || null,
    genres: attr.genreNames || [],
  };
}

// Word-overlap similarity (mirrors spotify-core.js logic)
function normalizeTitle(str) {
  return normalize(str)
    .replace(/\b(a|an|the)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const wa = na.split(' ').filter(w => w.length > 1);
  const wb = nb.split(' ').filter(w => w.length > 1);
  if (wa.length === 0 || wb.length === 0) return 0;
  const shared = wa.filter(w => wb.includes(w)).length;
  return shared / Math.max(wa.length, wb.length);
}
