/**
 * POST /api/bucket/discover
 *
 * Discovers unreleased tracks from SoundCloud DJ profiles and uploads
 * them to the ACRCloud fingerprint bucket.
 *
 * Body: { djs?: string[], limit?: number }
 * - djs: override list of DJs to scan (defaults to top DJs from DB)
 * - limit: max tracks to upload per run (default 20)
 */

import { createClient } from '@supabase/supabase-js';
import { fetchSoundCloudClientId } from '../_lib/soundcloud-core.js';

export const config = { maxDuration: 300 }; // 5 min max

const SOUNDCLOUD_API_V2 = 'https://api-v2.soundcloud.com';

// Keywords that suggest a track is unreleased
const UNRELEASED_KEYWORDS = [
  'unreleased', 'forthcoming', 'dubplate', 'dub plate',
  'white label', '(vip)', ' vip)', 'promo only', 'id -', '- id',
  'bootleg', 'free download', 'dub)', '(dub', 'exclusive',
];

// Curator accounts known for hosting unreleased DJ tracks
const CURATOR_ACCOUNTS = [
  'hidden-cuts',
  'unreleased-music-vault',
  'djpromos',
  'housemusic-id',
  'techno-ids',
];

// Top DJs in our DB whose SoundCloud we should check
const DEFAULT_DJS = [
  'Prospa', 'Max Dean', 'ANOTR', 'East End Dubs', 'Jamback',
  'Sidney Charles', 'Obskür', 'Wheats', 'Gaskin', 'Prunk',
  'Dennis Quin', 'Chris Stussy', 'Dom Dolla', 'Fisher', 'John Summit',
  'Robbie Doherty', 'Mau P', 'Patrick Topping', 'Sammy Virji', 'Michael Bibi',
  'Franky Rizardo', 'Chris Lake', 'Vintage Culture', 'Kettama', 'Luke Alessi',
  'PAWSA', 'Seb Zito', 'Josh Baker', 'Denis Sulta', 'Dimmish',
];

function getSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getBucketConfig() {
  const clean = (v) => (v || '').replace(/\\n|\n/g, '').trim();
  // ACRCLOUD_BUCKET_ID is the numeric ID (e.g. 29490); ACRCLOUD_BUCKET_NAME is display name only
  const bucketId = clean(process.env.ACRCLOUD_BUCKET_ID) || clean(process.env.ACRCLOUD_BUCKET_NAME);
  return {
    bucketId,
    bearerToken: clean(process.env.ACRCLOUD_BEARER_TOKEN),
  };
}

function isUnreleasedTitle(title) {
  const lower = (title || '').toLowerCase();
  return UNRELEASED_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Resolve a SoundCloud user_id from a permalink/username.
 */
async function resolveUserId(clientId, permalink) {
  try {
    const res = await fetch(
      `${SOUNDCLOUD_API_V2}/resolve?url=https://soundcloud.com/${permalink}&client_id=${clientId}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.id || null;
  } catch { return null; }
}

/**
 * Search for a SoundCloud user by name, return their permalink.
 */
async function findUserPermalink(clientId, artistName) {
  try {
    const res = await fetch(
      `${SOUNDCLOUD_API_V2}/search/users?q=${encodeURIComponent(artistName)}&client_id=${clientId}&limit=5`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const users = data.collection || [];

    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = norm(artistName);

    // Exact match first
    for (const u of users) {
      if (norm(u.username) === target || norm(u.permalink) === target) {
        return u.permalink;
      }
    }
    // Partial match fallback
    for (const u of users) {
      if (norm(u.username).includes(target) || target.includes(norm(u.username))) {
        return u.permalink;
      }
    }
    return null;
  } catch { return null; }
}

/**
 * Search SoundCloud for tracks matching a query (e.g. "prospa unreleased").
 */
async function searchSoundCloudTracks(clientId, query, limit = 20) {
  try {
    const res = await fetch(
      `${SOUNDCLOUD_API_V2}/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=${limit}&access=playable`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.collection || [])
      .filter(t => t.streamable && t.duration > 30000)
      .map(t => ({
        id: t.id,
        title: t.title,
        artist: t.user?.username || '',
        permalink_url: t.permalink_url,
        duration: Math.floor(t.duration / 1000),
      }));
  } catch { return []; }
}

/**
 * Get all public tracks from a user's profile.
 */
async function getUserTracks(clientId, userId, maxTracks = 50) {
  try {
    const res = await fetch(
      `${SOUNDCLOUD_API_V2}/users/${userId}/tracks?client_id=${clientId}&limit=${maxTracks}&access=playable`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.collection || [])
      .filter(t => t.streamable && t.duration > 30000)
      .map(t => ({
        id: t.id,
        title: t.title,
        artist: t.user?.username || '',
        permalink_url: t.permalink_url,
        duration: Math.floor(t.duration / 1000),
      }));
  } catch { return []; }
}

/**
 * Get tracks from a curator account (reposts + own).
 */
async function getCuratorTracks(clientId, permalink, maxTracks = 50) {
  try {
    const userId = await resolveUserId(clientId, permalink);
    if (!userId) return [];

    const res = await fetch(
      `${SOUNDCLOUD_API_V2}/users/${userId}/tracks?client_id=${clientId}&limit=${maxTracks}&access=playable`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const tracks = data.collection || [];

    return tracks
      .filter(t => t.streamable && t.duration > 30000)
      .map(t => ({
        id: t.id,
        title: t.title,
        artist: t.user?.username || '',
        permalink_url: t.permalink_url,
        duration: Math.floor(t.duration / 1000),
      }));
  } catch { return []; }
}

/**
 * Get streaming URL for a SoundCloud track.
 * Tries full stream first, falls back to 30-second preview (enough for fingerprinting).
 */
async function getStreamUrl(clientId, trackId) {
  try {
    const res = await fetch(
      `${SOUNDCLOUD_API_V2}/tracks/${trackId}/streams?client_id=${clientId}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.http_mp3_128_url) return { url: data.http_mp3_128_url, isPreview: false };
      if (data.preview_mp3_128_url) return { url: data.preview_mp3_128_url, isPreview: true };
    }

    // Fallback: try the media transcodings via track detail endpoint
    const trackRes = await fetch(
      `${SOUNDCLOUD_API_V2}/tracks/${trackId}?client_id=${clientId}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
    );
    if (!trackRes.ok) return null;
    const track = await trackRes.json();

    // Look for progressive MP3 transcoding
    const transcodings = track.media?.transcodings || [];
    const progressive = transcodings.find(
      t => t.format?.protocol === 'progressive' && t.format?.mime_type?.includes('mpeg')
    );
    if (progressive?.url) {
      const streamRes = await fetch(
        `${progressive.url}?client_id=${clientId}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
      );
      if (streamRes.ok) {
        const streamData = await streamRes.json();
        if (streamData.url) return { url: streamData.url, isPreview: false };
      }
    }

    return null;
  } catch { return null; }
}

/**
 * Download ~45 seconds of audio from a stream URL (≈720 KB at 128kbps).
 * Returns a Buffer or null.
 */
async function downloadAudioClip(streamUrl) {
  try {
    // ~45s at 128kbps = ~720,000 bytes
    const CLIP_BYTES = 720_000;
    const res = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Range': `bytes=0-${CLIP_BYTES}`,
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok && res.status !== 206) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch { return null; }
}

/**
 * Upload audio buffer to ACRCloud bucket.
 */
async function uploadToACRCloud(audioBuffer, metadata) {
  const { bucketId, bearerToken } = getBucketConfig();
  if (!bucketId || !bearerToken) throw new Error('ACRCloud bucket not configured');

  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  const parts = [];
  const addField = (name, value) => {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  };

  addField('title', metadata.title);
  addField('data_type', 'audio');
  addField('user_defined', JSON.stringify({ artist: metadata.artist, source: metadata.sourceUrl }));

  const header = Buffer.from(parts.join(''));
  const fileHeader = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="audio_file"; filename="track.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileHeader, audioBuffer, footer]);

  const res = await fetch(
    `https://api-v2.acrcloud.com/api/buckets/${bucketId}/files`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
      },
      body,
      signal: AbortSignal.timeout(30000),
    }
  );

  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.message || result.error || `ACRCloud error ${res.status}`);
  // acr_id is assigned after async processing; file id is returned immediately
  const fileId = result.data?.id || result.id || null;
  const acrId = result.data?.acr_id || result.acr_id || null;
  console.log('[ACRCloud] upload response:', JSON.stringify(result).substring(0, 200));
  return { acrId, fileId };
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { djs = DEFAULT_DJS, limit = 20, curatorsOnly = false } = req.body || {};

  const clientId = await fetchSoundCloudClientId();
  const debugInfo = { clientId: clientId ? clientId.substring(0, 8) + '...' : null };
  if (!clientId) return res.status(500).json({ error: 'SoundCloud client ID unavailable', debugInfo });

  // Fetch existing source URLs to avoid duplicates
  const { data: existing } = await supabase
    .from('unreleased_tracks')
    .select('source_url');
  const existingUrls = new Set((existing || []).map(r => r.source_url));

  const results = { uploaded: [], skipped: [], failed: [] };
  let uploadCount = 0;

  // Helper: process a track candidate
  async function processTrack(track, confidenceScore = 0.7) {
    if (uploadCount >= limit) return;
    if (existingUrls.has(track.permalink_url)) {
      results.skipped.push({ title: track.title, artist: track.artist, reason: 'duplicate' });
      return;
    }
    try {
      const stream = await getStreamUrl(clientId, track.id);
      if (!stream) { results.failed.push({ title: track.title, reason: 'no_stream' }); return; }

      const audioBuffer = await downloadAudioClip(stream.url);
      if (!audioBuffer || audioBuffer.length < 50_000) {
        results.failed.push({ title: track.title, reason: 'download_failed' }); return;
      }

      const { acrId, fileId } = await uploadToACRCloud(audioBuffer, {
        title: track.title, artist: track.artist, sourceUrl: track.permalink_url,
      });

      await supabase.from('unreleased_tracks').insert({
        title: track.title,
        artist: track.artist,
        source_platform: 'soundcloud',
        source_url: track.permalink_url,
        acrcloud_acr_id: acrId,
        acrcloud_status: 'uploaded', // uploaded successfully; acr_id assigned after processing
        audio_duration_seconds: track.duration,
        audio_quality: 'medium',
        confidence_score: confidenceScore,
        is_active: true,
      });

      existingUrls.add(track.permalink_url);
      uploadCount++;
      results.uploaded.push({ title: track.title, artist: track.artist, acrId, fileId });
      console.log(`[Discover] ✅ Uploaded: ${track.artist} - ${track.title} (fileId=${fileId})`);
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      results.failed.push({ title: track.title, reason: err.message });
    }
  }

  // ── 1. Search SoundCloud for "[DJ] unreleased/dub/VIP" ───────────────────
  if (!curatorsOnly) {
    const searchTerms = ['unreleased', 'dub', 'VIP', 'forthcoming', 'ID'];

    for (const djName of djs) {
      if (uploadCount >= limit) break;
      for (const term of searchTerms) {
        if (uploadCount >= limit) break;
        const query = `${djName} ${term}`;
        console.log(`[Discover] Searching: "${query}"`);
        const tracks = await searchSoundCloudTracks(clientId, query, 10);
        debugInfo[`${djName}:${term}`] = `${tracks.length} results`;
        for (const track of tracks) {
          await processTrack(track, 0.75);
        }
      }
    }
  }

  // ── 2. Mine set_tracks DB for tracks marked unreleased/id without a bucket entry ─
  if (uploadCount < limit) {
    const { data: idTracks } = await supabase
      .from('set_tracks')
      .select('title, artist, is_unreleased')
      .or('is_unreleased.eq.true,public_status.eq.id')
      .not('title', 'ilike', '%ID%')
      .not('title', 'ilike', '%unknown%')
      .limit(50);

    for (const t of (idTracks || [])) {
      if (uploadCount >= limit) break;
      if (!t.title || !t.artist) continue;

      // Search SoundCloud for this specific track
      const query = `${t.artist} ${t.title}`;
      const tracks = await searchSoundCloudTracks(clientId, query, 5);
      if (tracks.length === 0) continue;

      // Take the best match (first result)
      const best = tracks[0];
      debugInfo[`set_track:${t.title}`] = `found: ${best.title} by ${best.artist}`;
      await processTrack(best, 0.65);
    }
  }

  // ── 2. Scan curator accounts ──────────────────────────────────────────────
  for (const curatorPermalink of CURATOR_ACCOUNTS) {
    if (uploadCount >= limit) break;

    console.log(`[Discover] Scanning curator: ${curatorPermalink}`);
    const tracks = await getCuratorTracks(clientId, curatorPermalink);

    for (const track of tracks) {
      if (uploadCount >= limit) break;
      if (!isUnreleasedTitle(track.title)) continue;
      if (existingUrls.has(track.permalink_url)) continue;

      try {
        const stream = await getStreamUrl(clientId, track.id);
        if (!stream) continue;

        const audioBuffer = await downloadAudioClip(stream.url);
        if (!audioBuffer || audioBuffer.length < 50_000) continue;

        const { acrId, fileId } = await uploadToACRCloud(audioBuffer, {
          title: track.title,
          artist: track.artist,
          sourceUrl: track.permalink_url,
        });

        await supabase.from('unreleased_tracks').insert({
          title: track.title,
          artist: track.artist,
          source_platform: 'soundcloud',
          source_url: track.permalink_url,
          acrcloud_acr_id: acrId,
          acrcloud_status: 'uploaded',
          audio_duration_seconds: track.duration,
          audio_quality: 'medium',
          confidence_score: 0.6,
          is_active: true,
        });

        existingUrls.add(track.permalink_url);
        uploadCount++;
        results.uploaded.push({ title: track.title, artist: track.artist, acrId, fileId });
        console.log(`[Discover] ✅ Curator upload: ${track.artist} - ${track.title} (fileId=${fileId})`);

        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        results.failed.push({ title: track.title, reason: err.message });
      }
    }
  }

  return res.status(200).json({
    success: true,
    uploaded: results.uploaded.length,
    skipped: results.skipped.length,
    failed: results.failed.length,
    details: results,
    debug: debugInfo,
  });
}
