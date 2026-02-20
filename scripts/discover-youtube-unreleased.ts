#!/usr/bin/env bun
/**
 * YouTube Unreleased Track Discovery Script
 *
 * Searches YouTube for unreleased/preview tracks using targeted queries,
 * downloads audio via yt-dlp, checks against ACRCloud commercial DB,
 * and uploads unidentified tracks to the custom bucket.
 *
 * Usage:
 *   bun scripts/discover-youtube-unreleased.ts
 *   bun scripts/discover-youtube-unreleased.ts --dry-run
 *   bun scripts/discover-youtube-unreleased.ts --queries "unreleased techno 2026"
 *   bun scripts/discover-youtube-unreleased.ts --max-results 20
 *   bun scripts/discover-youtube-unreleased.ts --config ./scripts/scraper-config.json
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

import {
  searchVideos,
  fetchVideoDetails,
  parseDuration,
  extractVideoId,
} from '../services/youtube';

// ============================================
// Config
// ============================================

const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOCAL_YTDLP = path.join(PROJECT_ROOT, 'bin', 'yt-dlp');
const LOCAL_FFMPEG = path.join(PROJECT_ROOT, 'bin', 'ffmpeg');
const YTDLP_PATH = fs.existsSync(LOCAL_YTDLP) ? LOCAL_YTDLP : 'yt-dlp';
const FFMPEG_PATH = fs.existsSync(LOCAL_FFMPEG) ? LOCAL_FFMPEG : 'ffmpeg';
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'unreleased-downloads', 'youtube');
const DEFAULT_CONFIG_PATH = path.join(PROJECT_ROOT, 'scripts', 'scraper-config.json');

const FILTERS = {
  maxDuration: 600, // 10 minutes — skip anything longer
  minDuration: 30,  // 30 seconds minimum
  mixKeywords: [
    'dj set', 'dj-set', 'djset', 'live set', 'live @', 'live at',
    'b2b', 'back to back', 'mix', 'podcast', 'radio show',
    'boiler room', 'essential mix', 'recorded live',
    'club set', 'festival set', 'closing set', 'opening set',
    'full set', 'hour mix', 'hr mix', 'minute mix', 'min mix',
  ],
};

// Default search queries if no config
const DEFAULT_QUERIES = [
  '"unreleased" techno 2026',
  '"unreleased" house music 2026',
  '"unreleased" deep house 2026',
  '"ID" dj set tracklist',
  '"forthcoming" house music',
  '"unreleased" UK house 2026',
  '"unreleased" tech house 2026',
  '"preview" unreleased techno',
  '"forthcoming" deep house',
  '"unreleased" drum and bass 2026',
];

interface TrackCandidate {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  durationSeconds: number;
  url: string;
}

// ============================================
// Helpers
// ============================================

function getSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getBucketConfig() {
  return {
    bucketId: process.env.ACRCLOUD_BUCKET_NAME,
    bearerToken: process.env.ACRCLOUD_BEARER_TOKEN,
    consoleHost: 'api-v2.acrcloud.com',
  };
}

function normalize(str: string): string {
  return str.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(unreleased|free download|clip|preview|edit|remix|original mix)\b/gi, '')
    .trim();
}

function looksLikeMix(title: string, description: string, duration: number): boolean {
  const text = `${title} ${description}`.toLowerCase();
  for (const kw of FILTERS.mixKeywords) {
    if (text.includes(kw.toLowerCase())) return true;
  }
  if (duration > 720) return true; // > 12 min
  return false;
}

function parseArtistTitle(title: string, channel: string): { artist: string; title: string } {
  // Try common separators
  const separators = [' - ', ' – ', ' — ', ' | ', ' // '];
  for (const sep of separators) {
    if (title.includes(sep)) {
      const [artist, ...rest] = title.split(sep);
      return { artist: artist.trim(), title: rest.join(sep).trim() };
    }
  }
  return { artist: channel, title };
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ============================================
// Download audio via yt-dlp
// ============================================

async function downloadAudio(videoId: string): Promise<string | null> {
  const outputDir = path.join(OUTPUT_DIR, videoId);
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${videoId}.mp3`);
  if (fs.existsSync(outputPath)) return outputPath;

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const args = [
    url,
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '--output', path.join(outputDir, '%(id)s.%(ext)s'),
    '--ffmpeg-location', path.dirname(FFMPEG_PATH),
    '--no-playlist',
    '--quiet',
  ];

  return new Promise((resolve) => {
    const proc = spawn(YTDLP_PATH, args, { stdio: 'pipe' });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        // Check for other audio formats
        const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
        const audio = files.find(f => f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.opus'));
        resolve(audio ? path.join(outputDir, audio) : null);
      }
    });

    proc.on('error', () => resolve(null));
  });
}

// ============================================
// ACRCloud identification (check if already released)
// ============================================

async function identifyWithACRCloud(audioPath: string): Promise<{ identified: boolean; title?: string; artist?: string }> {
  const host = process.env.ACRCLOUD_HOST;
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
  const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET;

  if (!host || !accessKey || !accessSecret) {
    return { identified: false };
  }

  try {
    const crypto = require('crypto');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const stringToSign = `POST\n/v1/identify\n${accessKey}\naudio\n1\n${timestamp}`;
    const signature = crypto
      .createHmac('sha1', accessSecret)
      .update(stringToSign)
      .digest('base64');

    const audioBuffer = fs.readFileSync(audioPath);

    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
    const formParts: (string | Buffer)[] = [];

    const addField = (name: string, value: string) => {
      formParts.push(`--${boundary}\r\n`);
      formParts.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
      formParts.push(`${value}\r\n`);
    };

    addField('access_key', accessKey);
    addField('data_type', 'audio');
    addField('signature', signature);
    addField('signature_version', '1');
    addField('sample_bytes', audioBuffer.length.toString());
    addField('timestamp', timestamp);

    formParts.push(`--${boundary}\r\n`);
    formParts.push(`Content-Disposition: form-data; name="sample"; filename="audio.mp3"\r\n`);
    formParts.push(`Content-Type: audio/mpeg\r\n\r\n`);
    formParts.push(audioBuffer);
    formParts.push(`\r\n--${boundary}--\r\n`);

    const bodyParts = formParts.map(p => typeof p === 'string' ? Buffer.from(p) : p);
    const bodyBuffer = Buffer.concat(bodyParts);

    const response = await fetch(`https://${host}/v1/identify`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
    });

    const result = await response.json();

    if (result.status?.code === 0 && result.metadata?.music?.length > 0) {
      const match = result.metadata.music[0];
      return {
        identified: true,
        title: match.title,
        artist: match.artists?.[0]?.name,
      };
    }

    return { identified: false };
  } catch {
    return { identified: false };
  }
}

// ============================================
// Upload to ACRCloud custom bucket
// ============================================

async function uploadToBucket(audioPath: string, metadata: {
  title: string;
  artist: string;
  sourceUrl: string;
  videoId: string;
}): Promise<{ success: boolean; acrId?: string }> {
  const config = getBucketConfig();
  if (!config.bucketId || !config.bearerToken) {
    return { success: false };
  }

  const audioBuffer = fs.readFileSync(audioPath);
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  const formParts: (string | Buffer)[] = [];

  const addField = (name: string, value: string) => {
    formParts.push(`--${boundary}\r\n`);
    formParts.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
    formParts.push(`${value}\r\n`);
  };

  addField('title', metadata.title);
  addField('data_type', 'audio');
  addField('user_defined', JSON.stringify({
    artist: metadata.artist,
    source_platform: 'youtube',
    source_url: metadata.sourceUrl,
    source_id: metadata.videoId,
    discovery_source: 'youtube-unreleased-search',
  }));

  formParts.push(`--${boundary}\r\n`);
  formParts.push(`Content-Disposition: form-data; name="file"; filename="track.mp3"\r\n`);
  formParts.push(`Content-Type: audio/mp3\r\n\r\n`);
  formParts.push(audioBuffer);
  formParts.push(`\r\n--${boundary}--\r\n`);

  const bodyParts = formParts.map(p => typeof p === 'string' ? Buffer.from(p) : p);
  const bodyBuffer = Buffer.concat(bodyParts);

  try {
    const response = await fetch(`https://${config.consoleHost}/api/buckets/${config.bucketId}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.bearerToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
    });

    const result = await response.json();
    if (response.ok && result.data?.acr_id) {
      return { success: true, acrId: result.data.acr_id };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}

// ============================================
// Main discovery pipeline
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
YouTube Unreleased Track Discovery

Searches YouTube for unreleased/preview tracks, downloads audio,
checks against ACRCloud commercial DB, and uploads unidentified tracks.

Usage:
  bun scripts/discover-youtube-unreleased.ts
  bun scripts/discover-youtube-unreleased.ts --dry-run
  bun scripts/discover-youtube-unreleased.ts --queries "unreleased techno 2026"
  bun scripts/discover-youtube-unreleased.ts --max-results 20
  bun scripts/discover-youtube-unreleased.ts --config ./scripts/scraper-config.json
`);
    process.exit(0);
  }

  // Check yt-dlp
  try {
    execSync(`${YTDLP_PATH} --version`, { stdio: 'ignore' });
  } catch {
    console.error('Error: yt-dlp not found. Install with: brew install yt-dlp');
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const maxResults = parseInt(args[args.indexOf('--max-results') + 1] || '25', 10);

  // Load search queries from config or CLI
  let queries: string[] = DEFAULT_QUERIES;

  const queriesIdx = args.indexOf('--queries');
  if (queriesIdx !== -1 && args[queriesIdx + 1]) {
    queries = args[queriesIdx + 1].split(',').map(q => q.trim());
  } else {
    const configIdx = args.indexOf('--config');
    const configPath = configIdx !== -1 ? args[configIdx + 1] : DEFAULT_CONFIG_PATH;
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.youtube?.searchQueries) {
          queries = config.youtube.searchQueries;
        }
      } catch {}
    }
  }

  const supabase = getSupabase();

  console.log('='.repeat(60));
  console.log('YouTube Unreleased Track Discovery');
  console.log('='.repeat(60));
  if (dryRun) console.log('** DRY RUN MODE **');
  console.log(`Queries: ${queries.length}`);
  console.log(`Max results per query: ${maxResults}`);
  console.log('');

  // Collect existing source URLs for dedup
  const existingUrls = new Set<string>();
  if (supabase) {
    const { data: existing } = await supabase
      .from('unreleased_tracks')
      .select('source_url')
      .eq('source_platform', 'youtube');
    for (const row of existing || []) {
      existingUrls.add(row.source_url);
    }
  }

  // Phase 1: Search YouTube
  const candidates: TrackCandidate[] = [];
  const seenIds = new Set<string>();

  for (const query of queries) {
    console.log(`\nSearching: "${query}"`);

    try {
      // Use 'short' duration filter to avoid mixes (< 4 min) — or 'medium' for 4-20 min
      const results = await searchVideos(query, {
        maxResults,
        order: 'date',
        publishedAfter: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (results.length === 0) {
        console.log(`  No results`);
        continue;
      }

      // Get full details (duration, stats)
      const videoIds = results.map(r => r.videoId).filter(id => !seenIds.has(id));
      if (videoIds.length === 0) continue;

      const details = await fetchVideoDetails(videoIds);

      for (const video of details) {
        if (seenIds.has(video.id)) continue;
        seenIds.add(video.id);

        const url = `https://www.youtube.com/watch?v=${video.id}`;
        const duration = video.durationSeconds || parseDuration(video.duration);

        // Filter: duration range
        if (duration < FILTERS.minDuration || duration > FILTERS.maxDuration) {
          console.log(`  SKIP (duration ${duration}s): ${video.title.substring(0, 50)}`);
          continue;
        }

        // Filter: looks like a mix
        if (looksLikeMix(video.title, video.description, duration)) {
          console.log(`  SKIP (mix): ${video.title.substring(0, 50)}`);
          continue;
        }

        // Filter: already in database
        if (existingUrls.has(url)) {
          console.log(`  SKIP (exists): ${video.title.substring(0, 50)}`);
          continue;
        }

        candidates.push({
          videoId: video.id,
          title: video.title,
          description: video.description,
          channelTitle: video.channelTitle,
          publishedAt: video.publishedAt,
          durationSeconds: duration,
          url,
        });

        console.log(`  CANDIDATE: ${video.title.substring(0, 60)} (${duration}s)`);
      }

      await sleep(500); // Be nice to YouTube API
    } catch (err) {
      console.error(`  Error searching "${query}":`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Total candidates: ${candidates.length}`);
  console.log('='.repeat(40));

  if (candidates.length === 0 || dryRun) {
    if (dryRun && candidates.length > 0) {
      console.log('\nDry run — would process these candidates:');
      for (const c of candidates) {
        console.log(`  ${c.channelTitle}: ${c.title} (${c.durationSeconds}s)`);
      }
    }
    return;
  }

  // Phase 2: Download, identify, and upload
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const stats = { downloaded: 0, identified: 0, uploaded: 0, failed: 0 };

  for (const candidate of candidates) {
    const { artist, title } = parseArtistTitle(candidate.title, candidate.channelTitle);
    console.log(`\nProcessing: ${artist} - ${title}`);

    // Download audio
    const audioPath = await downloadAudio(candidate.videoId);
    if (!audioPath) {
      console.log(`  FAIL: Download failed`);
      stats.failed++;
      continue;
    }
    stats.downloaded++;

    // Check if already released via ACRCloud
    console.log(`  Identifying...`);
    const identification = await identifyWithACRCloud(audioPath);

    if (identification.identified) {
      console.log(`  IDENTIFIED: "${identification.artist} - ${identification.title}" (already released)`);
      stats.identified++;
      // Clean up
      try { fs.rmSync(path.dirname(audioPath), { recursive: true, force: true }); } catch {}
      continue;
    }

    // Not identified — upload to custom bucket as unreleased
    console.log(`  Not in commercial DB — uploading to bucket...`);

    const uploadResult = await uploadToBucket(audioPath, {
      title,
      artist,
      sourceUrl: candidate.url,
      videoId: candidate.videoId,
    });

    if (uploadResult.success) {
      console.log(`  UPLOADED: ${uploadResult.acrId}`);

      // Save to database
      if (supabase) {
        await supabase.from('unreleased_tracks').insert({
          title,
          artist,
          source_platform: 'youtube',
          source_url: candidate.url,
          source_user: candidate.channelTitle,
          source_post_date: candidate.publishedAt,
          audio_duration_seconds: candidate.durationSeconds,
          audio_quality: candidate.durationSeconds >= 180 ? 'high' : candidate.durationSeconds >= 60 ? 'medium' : 'clip',
          acrcloud_acr_id: uploadResult.acrId,
          acrcloud_status: 'uploaded',
          fingerprint_created_at: new Date().toISOString(),
          metadata: {
            description: candidate.description?.substring(0, 500),
            youtubeVideoId: candidate.videoId,
          },
        });
      }

      stats.uploaded++;
    } else {
      console.log(`  FAIL: Upload failed`);
      stats.failed++;
    }

    // Clean up downloaded file
    try { fs.rmSync(path.dirname(audioPath), { recursive: true, force: true }); } catch {}
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('DISCOVERY SUMMARY');
  console.log('='.repeat(60));
  console.log(`Candidates found:     ${candidates.length}`);
  console.log(`Downloaded:           ${stats.downloaded}`);
  console.log(`Already released:     ${stats.identified}`);
  console.log(`Uploaded as unreleased: ${stats.uploaded}`);
  console.log(`Failed:               ${stats.failed}`);
}

main().catch(console.error);
