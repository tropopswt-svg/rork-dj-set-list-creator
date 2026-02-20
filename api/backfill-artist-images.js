// Bulk backfill artist images from multiple free sources
// POST /api/backfill-artist-images
// Body: { limit?: number, dryRun?: boolean }
//
// Sources tried in order:
//   1. Spotify (best quality, needs SPOTIFY_CLIENT_ID/SECRET)
//   2. Discogs  (free, no key needed, great for electronic/DJ artists)
//   3. MusicBrainz (free, no key needed)
//
// Call this endpoint repeatedly until all artists are populated.
// Each call processes up to `limit` artists (default 100).

import { getSupabaseClient, getSpotifyToken, searchArtistOnSpotify, normalize } from './_lib/spotify-core.js';

const DISCOGS_USER_AGENT = 'TRACKD-App/1.0 +https://trackd.app';
const MB_USER_AGENT = 'TRACKD-App/1.0 (https://trackd.app)';

// ─── Discogs (free, 60 req/min without auth) ────────────────────────────────

async function searchDiscogs(artistName) {
  const ua = { 'User-Agent': DISCOGS_USER_AGENT };
  try {
    // Step 1: Search for the artist to get their Discogs ID
    const query = encodeURIComponent(artistName);
    const resp = await fetch(
      `https://api.discogs.com/database/search?q=${query}&type=artist&per_page=5`,
      { headers: ua }
    );
    if (resp.status === 429 || !resp.ok) return null;

    let matchId = null;
    const data = await resp.json();
    for (const artist of data.results || []) {
      if (
        normalize(artist.title) === normalize(artistName) ||
        normalize(artist.title).includes(normalize(artistName)) ||
        normalize(artistName).includes(normalize(artist.title))
      ) {
        matchId = artist.id;
        break;
      }
    }
    if (!matchId) return null;

    // Step 2: Fetch artist detail to get images
    await sleep(1100);
    const detailResp = await fetch(
      `https://api.discogs.com/artists/${matchId}`,
      { headers: ua }
    );
    if (detailResp.status === 429 || !detailResp.ok) return null;

    const detail = await detailResp.json();
    const images = detail.images || [];
    const primary = images.find(i => i.type === 'primary');
    const img = primary || images[0];
    if (img?.uri) return img.uri;

    return null;
  } catch {
    return null;
  }
}

// ─── MusicBrainz (free, 1 req/sec) ──────────────────────────────────────────

async function searchMusicBrainz(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=artist:${query}&fmt=json&limit=5`,
      { headers: { 'User-Agent': MB_USER_AGENT } }
    );

    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.artists?.length) return null;

    // Find best match
    let bestMatch = data.artists[0];
    const normalized = artistName.toLowerCase().trim();
    for (const artist of data.artists) {
      if (artist.name.toLowerCase().trim() === normalized) {
        bestMatch = artist;
        break;
      }
    }

    // Get image from URL relations
    const mbid = bestMatch.id;
    const relResp = await fetch(
      `https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels&fmt=json`,
      { headers: { 'User-Agent': MB_USER_AGENT } }
    );

    if (!relResp.ok) return null;
    const relData = await relResp.json();

    if (relData.relations) {
      for (const rel of relData.relations) {
        if (rel.type === 'image' && rel.url?.resource) {
          return rel.url.resource;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      description: 'Bulk backfill artist images from Spotify, Discogs, and MusicBrainz.',
      usage: 'POST { "limit": 100 }',
      tip: 'Call repeatedly until remaining = 0. Each call processes one batch.',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // With rate-limit delays (~1-2s per artist), aim for ~20-30 per call
  // to stay within Vercel's 60s function timeout.
  // Call this endpoint repeatedly until remaining = 0.
  const { limit = 25, dryRun = false } = req.body || {};
  const batchLimit = Math.min(parseInt(limit) || 25, 100);

  // Get artists without images
  const { data: artists, error } = await supabase
    .from('artists')
    .select('id, name, image_url, spotify_url')
    .or('image_url.is.null,image_url.eq.')
    .order('sets_count', { ascending: false }) // prioritize artists with more sets
    .limit(batchLimit);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!artists || artists.length === 0) {
    // Count total artists for context
    const { count } = await supabase
      .from('artists')
      .select('id', { count: 'exact', head: true });

    return res.status(200).json({
      success: true,
      message: 'All artists already have images!',
      totalArtists: count,
      remaining: 0,
    });
  }

  // Count remaining for progress
  const { count: remainingCount } = await supabase
    .from('artists')
    .select('id', { count: 'exact', head: true })
    .or('image_url.is.null,image_url.eq.');

  if (dryRun) {
    return res.status(200).json({
      success: true,
      dryRun: true,
      artistsToProcess: artists.map(a => a.name),
      batchSize: artists.length,
      remaining: remainingCount,
    });
  }

  // Get Spotify token (optional — will skip Spotify if not configured)
  const spotifyToken = await getSpotifyToken();

  const results = [];
  let spotifyHits = 0;
  let discogsHits = 0;
  let musicbrainzHits = 0;
  let notFound = 0;
  let errors = 0;

  for (const artist of artists) {
    const entry = { name: artist.name, source: null, imageUrl: null };

    try {
      // ── 1. Spotify ──
      if (spotifyToken) {
        await sleep(200); // respect rate limits
        const spotifyData = await searchArtistOnSpotify(spotifyToken, artist.name);

        if (spotifyData && !spotifyData._rateLimited && spotifyData.image_url) {
          entry.source = 'spotify';
          entry.imageUrl = spotifyData.image_url;

          // Save image + extra Spotify data
          const update = { image_url: spotifyData.image_url };
          if (spotifyData.genres?.length) update.genres = spotifyData.genres;
          if (spotifyData.spotify_url) update.spotify_url = spotifyData.spotify_url;
          if (spotifyData.followers_count) update.followers_count = spotifyData.followers_count;

          await supabase.from('artists').update(update).eq('id', artist.id);
          spotifyHits++;
          results.push(entry);
          continue;
        }
      }

      // ── 2. Discogs ──
      await sleep(1100); // Discogs: 60 req/min = 1/sec
      const discogsImage = await searchDiscogs(artist.name);
      if (discogsImage) {
        entry.source = 'discogs';
        entry.imageUrl = discogsImage;
        await supabase.from('artists').update({ image_url: discogsImage }).eq('id', artist.id);
        discogsHits++;
        results.push(entry);
        continue;
      }

      // ── 3. MusicBrainz ──
      await sleep(1100); // MusicBrainz: 1 req/sec
      const mbImage = await searchMusicBrainz(artist.name);
      if (mbImage) {
        entry.source = 'musicbrainz';
        entry.imageUrl = mbImage;
        await supabase.from('artists').update({ image_url: mbImage }).eq('id', artist.id);
        musicbrainzHits++;
        results.push(entry);
        continue;
      }

      // No image found from any source
      entry.source = 'none';
      notFound++;
      results.push(entry);
    } catch (err) {
      entry.source = 'error';
      errors++;
      results.push(entry);
    }
  }

  return res.status(200).json({
    success: true,
    processed: artists.length,
    remaining: Math.max(0, (remainingCount || 0) - artists.length),
    sources: {
      spotify: spotifyHits,
      discogs: discogsHits,
      musicbrainz: musicbrainzHits,
    },
    notFound,
    errors,
    results: results.slice(0, 50),
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
