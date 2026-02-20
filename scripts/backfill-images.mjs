#!/usr/bin/env node
// Run: node scripts/backfill-images.mjs
//
// Bulk-fetches artist images from Spotify, Discogs, and MusicBrainz
// and saves them to the Supabase database.
// Processes all artists without images, in batches.

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(str) {
  return str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Spotify ─────────────────────────────────────────────────────────────────

let spotifyToken = null;
let spotifyTokenExpiry = 0;

async function getSpotifyToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;
  if (spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken;

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  spotifyToken = data.access_token;
  spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyToken;
}

async function searchSpotify(token, artistName) {
  const query = encodeURIComponent(artistName);
  const resp = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=artist&limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (resp.status === 429) {
    const retryAfter = parseInt(resp.headers.get('Retry-After') || '30', 10);
    console.log(`  Spotify rate limited, waiting ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return null;
  }
  if (!resp.ok) return null;

  const data = await resp.json();
  for (const artist of data.artists?.items || []) {
    if (
      normalize(artist.name) === normalize(artistName) ||
      normalize(artist.name).includes(normalize(artistName)) ||
      normalize(artistName).includes(normalize(artist.name))
    ) {
      const images = artist.images || [];
      const imageUrl = images.find(i => i.width >= 300)?.url || images[0]?.url;
      return {
        image_url: imageUrl || null,
        genres: artist.genres || [],
        spotify_url: artist.external_urls?.spotify || null,
        followers_count: artist.followers?.total || 0,
      };
    }
  }
  return null;
}

// ─── Discogs (free, 60 req/min) ──────────────────────────────────────────────

async function searchDiscogs(artistName) {
  const ua = { 'User-Agent': 'TRACKD-App/1.0 +https://trackd.app' };
  try {
    // Step 1: Search for the artist to get their Discogs ID
    const query = encodeURIComponent(artistName);
    const resp = await fetch(
      `https://api.discogs.com/database/search?q=${query}&type=artist&per_page=5`,
      { headers: ua }
    );
    if (resp.status === 429 || !resp.ok) return null;

    const data = await resp.json();
    let matchId = null;
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
    // Prefer primary image
    const primary = images.find(i => i.type === 'primary');
    const img = primary || images[0];
    if (img?.uri) return img.uri;

    return null;
  } catch { return null; }
}

// ─── MusicBrainz (free, 1 req/sec) ──────────────────────────────────────────

async function searchMusicBrainz(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=artist:${query}&fmt=json&limit=5`,
      { headers: { 'User-Agent': 'TRACKD-App/1.0 (https://trackd.app)' } }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.artists?.length) return null;

    let best = data.artists[0];
    const norm = artistName.toLowerCase().trim();
    for (const a of data.artists) {
      if (a.name.toLowerCase().trim() === norm) { best = a; break; }
    }

    await sleep(1100);
    const relResp = await fetch(
      `https://musicbrainz.org/ws/2/artist/${best.id}?inc=url-rels&fmt=json`,
      { headers: { 'User-Agent': 'TRACKD-App/1.0 (https://trackd.app)' } }
    );
    if (!relResp.ok) return null;
    const relData = await relResp.json();

    for (const rel of relData.relations || []) {
      if (rel.type === 'image' && rel.url?.resource) return rel.url.resource;
    }
    return null;
  } catch { return null; }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const skipSpotify = process.argv.includes('--skip-spotify');
  const maxArtists = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || Infinity;

  console.log('Fetching artists without images...\n');

  const { data: artists, error, count } = await supabase
    .from('artists')
    .select('id, name, image_url, spotify_url', { count: 'exact' })
    .or('image_url.is.null,image_url.eq.')
    .order('sets_count', { ascending: false });

  if (error) {
    console.error('DB error:', error.message);
    process.exit(1);
  }

  const { count: totalArtists } = await supabase
    .from('artists')
    .select('id', { count: 'exact', head: true });

  const toProcess = artists.slice(0, maxArtists);

  console.log(`Total artists in DB: ${totalArtists}`);
  console.log(`Artists missing images: ${artists.length}`);
  if (maxArtists < Infinity) console.log(`Processing first: ${toProcess.length}`);
  console.log();

  if (toProcess.length === 0) {
    console.log('All artists already have images!');
    return;
  }

  let token = null;
  if (!skipSpotify) {
    token = await getSpotifyToken();
    if (token) {
      console.log('Spotify: authenticated');
    } else {
      console.log('Spotify: skipping (no credentials)');
    }
  } else {
    console.log('Spotify: skipped (--skip-spotify)');
  }
  console.log('Discogs: ready (no auth needed)');
  console.log('MusicBrainz: ready (no auth needed)\n');

  let spotify = 0, discogs = 0, mb = 0, notFound = 0;
  const artistsList = toProcess;

  for (let i = 0; i < artistsList.length; i++) {
    const artist = artistsList[i];
    const progress = `[${i + 1}/${artistsList.length}]`;

    // ── 1. Spotify ──
    if (token) {
      await sleep(200);
      const data = await searchSpotify(token, artist.name);
      if (data?.image_url) {
        const update = { image_url: data.image_url };
        if (data.genres?.length) update.genres = data.genres;
        if (data.spotify_url) update.spotify_url = data.spotify_url;
        if (data.followers_count) update.followers_count = data.followers_count;
        await supabase.from('artists').update(update).eq('id', artist.id);
        spotify++;
        console.log(`${progress} ✓ ${artist.name} → Spotify`);
        continue;
      }
    }

    // ── 2. Discogs ──
    await sleep(1100);
    const discogsImg = await searchDiscogs(artist.name);
    if (discogsImg) {
      await supabase.from('artists').update({ image_url: discogsImg }).eq('id', artist.id);
      discogs++;
      console.log(`${progress} ✓ ${artist.name} → Discogs`);
      continue;
    }

    // ── 3. MusicBrainz ──
    await sleep(1100);
    const mbImg = await searchMusicBrainz(artist.name);
    if (mbImg) {
      await supabase.from('artists').update({ image_url: mbImg }).eq('id', artist.id);
      mb++;
      console.log(`${progress} ✓ ${artist.name} → MusicBrainz`);
      continue;
    }

    notFound++;
    console.log(`${progress} ✗ ${artist.name} → not found`);
  }

  console.log('\n────────────────────────────────────');
  console.log(`Done! Processed ${artistsList.length} artists`);
  console.log(`  Spotify:     ${spotify}`);
  console.log(`  Discogs:     ${discogs}`);
  console.log(`  MusicBrainz: ${mb}`);
  console.log(`  Not found:   ${notFound}`);
  console.log('────────────────────────────────────');
}

main().catch(console.error);
