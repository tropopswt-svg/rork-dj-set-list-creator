#!/usr/bin/env bun
/**
 * TikTok & Instagram Social Scraper
 *
 * Scrapes TikTok and Instagram profiles for unreleased/ID tracks using Apify,
 * downloads audio with yt-dlp, and uploads to ACRCloud custom bucket.
 *
 * Usage:
 *   bun scripts/social-scraper.ts --platform tiktok --accounts @dj1,@dj2
 *   bun scripts/social-scraper.ts --platform instagram --accounts @dj1
 *   bun scripts/social-scraper.ts --config ./scripts/scraper-config.json
 *   bun scripts/social-scraper.ts --process-pending
 *   bun scripts/social-scraper.ts --test-connection
 *
 * Prerequisites:
 *   - Apify account with API token (set APIFY_API_TOKEN)
 *   - yt-dlp installed (brew install yt-dlp)
 *   - ffmpeg installed (brew install ffmpeg)
 *   - Supabase and ACRCloud credentials configured
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import apifyClient, {
  TikTokVideo,
  InstagramPost,
  TikTokScraperOptions,
  InstagramScraperOptions,
} from '../services/apifyClient';
import commentParser, { CommentTrackHint } from '../lib/commentParser';

// ============================================
// Configuration Types
// ============================================

interface PlatformFilters {
  minDuration: number;
  maxAge: number;
  keywords: string[];
  excludeKeywords: string[];
  contentTypes?: string[]; // Instagram only
}

interface ScrapeOptions {
  maxVideos?: number;
  maxPosts?: number;
  maxComments?: number;
  includeComments?: boolean;
  resultsType?: string;
}

interface ScraperConfig {
  tiktok?: {
    accounts: string[];
    filters: PlatformFilters;
    scrapeOptions?: ScrapeOptions;
  };
  instagram?: {
    accounts: string[];
    filters: PlatformFilters;
    scrapeOptions?: ScrapeOptions;
  };
}

interface ProcessedVideo {
  id: string;
  platform: 'tiktok' | 'instagram';
  url: string;
  title: string;
  description: string;
  duration: number;
  uploadDate: Date;
  username: string;
  audioPath?: string;
  comments?: Array<{
    text: string;
    username?: string;
    replies?: Array<{ text: string; username?: string }>;
  }>;
}

// ============================================
// Paths and Constants
// ============================================

const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOCAL_YTDLP = path.join(PROJECT_ROOT, 'bin', 'yt-dlp');
const LOCAL_FFMPEG = path.join(PROJECT_ROOT, 'bin', 'ffmpeg');
const YTDLP_PATH = fs.existsSync(LOCAL_YTDLP) ? LOCAL_YTDLP : 'yt-dlp';
const FFMPEG_PATH = fs.existsSync(LOCAL_FFMPEG) ? LOCAL_FFMPEG : 'ffmpeg';
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'unreleased-downloads');
const DEFAULT_CONFIG_PATH = path.join(__dirname, 'scraper-config.json');

// ============================================
// Supabase Client
// ============================================

type SupabaseClientType = SupabaseClient<any, 'public', any>;

function getSupabaseClient(): SupabaseClientType | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing Supabase credentials');
    return null;
  }
  return createClient(url, key);
}

// ACRCloud bucket config
function getBucketConfig() {
  return {
    bucketId: process.env.ACRCLOUD_BUCKET_NAME,
    bearerToken: process.env.ACRCLOUD_BEARER_TOKEN,
    consoleHost: 'api-v2.acrcloud.com',
  };
}

// ============================================
// Dependency Checks
// ============================================

function checkDependencies(): boolean {
  let allGood = true;

  // Check yt-dlp
  if (fs.existsSync(LOCAL_YTDLP)) {
    console.log(`[Dependencies] Using local yt-dlp: ${LOCAL_YTDLP}`);
  } else {
    try {
      execSync('which yt-dlp', { stdio: 'ignore' });
      console.log('[Dependencies] Using system yt-dlp');
    } catch {
      console.error('[Dependencies] ERROR: yt-dlp not found. Install with: brew install yt-dlp');
      allGood = false;
    }
  }

  // Check ffmpeg
  if (fs.existsSync(LOCAL_FFMPEG)) {
    console.log(`[Dependencies] Using local ffmpeg: ${LOCAL_FFMPEG}`);
  } else {
    try {
      execSync('which ffmpeg', { stdio: 'ignore' });
      console.log('[Dependencies] Using system ffmpeg');
    } catch {
      console.error('[Dependencies] ERROR: ffmpeg not found. Install with: brew install ffmpeg');
      allGood = false;
    }
  }

  // Check Apify
  if (!apifyClient.isApifyConfigured()) {
    console.error('[Dependencies] ERROR: APIFY_API_TOKEN not configured');
    allGood = false;
  } else {
    console.log('[Dependencies] Apify API token configured');
  }

  return allGood;
}

// ============================================
// Video Filtering
// ============================================

function passesFilters(
  video: ProcessedVideo,
  filters: PlatformFilters
): { passes: boolean; reason?: string } {
  // Duration filter
  if (video.duration < filters.minDuration) {
    return { passes: false, reason: `Too short (${video.duration}s < ${filters.minDuration}s)` };
  }

  // Age filter
  const daysSinceUpload = (Date.now() - video.uploadDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpload > filters.maxAge) {
    return { passes: false, reason: `Too old (${Math.floor(daysSinceUpload)} days > ${filters.maxAge} days)` };
  }

  const fullText = `${video.title} ${video.description}`.toLowerCase();

  // Exclude keywords - but handle "unreleased" vs "released" carefully
  for (const keyword of filters.excludeKeywords) {
    const keywordLower = keyword.toLowerCase();
    if (keywordLower === 'released') {
      // "released" should not match "unreleased"
      const releasedPattern = /(?<![un])released/i;
      if (releasedPattern.test(fullText)) {
        return { passes: false, reason: `Contains excluded keyword: "${keyword}"` };
      }
    } else if (fullText.includes(keywordLower)) {
      return { passes: false, reason: `Contains excluded keyword: "${keyword}"` };
    }
  }

  // Include keywords (if specified)
  if (filters.keywords.length > 0) {
    const hasKeyword = filters.keywords.some((kw) => fullText.includes(kw.toLowerCase()));
    if (!hasKeyword) {
      return { passes: false, reason: 'Missing required keyword' };
    }
  }

  return { passes: true };
}

// ============================================
// TikTok Processing
// ============================================

function normalizeTikTokVideo(video: any): ProcessedVideo | null {
  // Handle different data structures from Apify actors
  const authorUsername = video.author?.uniqueId || video.authorMeta?.name || video.authorName || 'unknown';
  const videoId = video.id || video.videoId || '';

  if (!videoId) {
    console.log('  SKIP: Video missing ID');
    return null;
  }

  const webUrl =
    video.webVideoUrl ||
    video.videoUrl ||
    `https://www.tiktok.com/@${authorUsername}/video/${videoId}`;

  // Convert comments to standard format
  const comments = video.comments?.map((c: any) => ({
    text: c.text || c.comment || '',
    username: c.user?.uniqueId || c.uniqueId || c.username,
    replies: c.replies?.map((r: any) => ({
      text: r.text || r.comment || '',
      username: r.user?.uniqueId || r.uniqueId || r.username,
    })),
  }));

  // Duration can be in different places
  const duration = video.video?.duration || video.videoMeta?.duration || video.duration || 0;

  // Timestamp can be seconds or milliseconds
  const createTime = video.createTime || video.createTimeISO || video.createdAt;
  const uploadDate = typeof createTime === 'number'
    ? new Date(createTime * (createTime > 1e12 ? 1 : 1000))
    : new Date(createTime || Date.now());

  return {
    id: videoId,
    platform: 'tiktok',
    url: webUrl,
    title: video.desc || video.text || video.description || '',
    description: video.desc || video.text || video.description || '',
    duration,
    uploadDate,
    username: authorUsername,
    comments,
  };
}

async function scrapeTikTokAccounts(
  accounts: string[],
  filters: PlatformFilters,
  scrapeOptions: ScrapeOptions = {}
): Promise<ProcessedVideo[]> {
  const allVideos: ProcessedVideo[] = [];

  for (const account of accounts) {
    console.log(`\n[TikTok] Scraping account: ${account}`);

    try {
      const options: TikTokScraperOptions = {
        maxVideos: scrapeOptions.maxVideos || 30,
        includeComments: scrapeOptions.includeComments ?? true,
        maxComments: scrapeOptions.maxComments || 100,
      };

      const videos = await apifyClient.scrapeTikTokProfile(account, options);
      console.log(`[TikTok] Found ${videos.length} videos from ${account}`);

      // Fetch comments from separate dataset if available
      for (const video of videos as any[]) {
        if (video.commentsDatasetUrl && video.commentCount > 0) {
          try {
            const commentsResp = await fetch(video.commentsDatasetUrl);
            if (commentsResp.ok) {
              const commentsData = await commentsResp.json();
              video.comments = commentsData;
              console.log(`  Fetched ${commentsData.length} comments for video ${video.id}`);
            }
          } catch (e) {
            // Comments fetch failed, continue without
          }
        }
      }

      for (const video of videos) {
        const normalized = normalizeTikTokVideo(video);
        if (!normalized) continue;

        const filterResult = passesFilters(normalized, filters);

        if (filterResult.passes) {
          allVideos.push(normalized);
          console.log(`  MATCH: ${normalized.title.substring(0, 60)}...`);
        } else {
          console.log(`  SKIP: ${normalized.title.substring(0, 50)}... - ${filterResult.reason}`);
        }
      }
    } catch (error) {
      console.error(`[TikTok] Error scraping ${account}:`, error);
    }
  }

  return allVideos;
}

// ============================================
// Instagram Processing
// ============================================

function normalizeInstagramPost(post: InstagramPost): ProcessedVideo {
  // Convert comments to standard format
  const comments = post.comments?.map((c) => ({
    text: c.text,
    username: c.ownerUsername,
    replies: c.replies?.map((r) => ({
      text: r.text,
      username: r.ownerUsername,
    })),
  }));

  return {
    id: post.id,
    platform: 'instagram',
    url: post.url || `https://www.instagram.com/p/${post.shortCode}/`,
    title: post.caption?.substring(0, 100) || '',
    description: post.caption || '',
    duration: post.videoDuration || 0,
    uploadDate: new Date(post.timestamp),
    username: post.ownerUsername,
    comments,
  };
}

async function scrapeInstagramAccounts(
  accounts: string[],
  filters: PlatformFilters,
  scrapeOptions: ScrapeOptions = {}
): Promise<ProcessedVideo[]> {
  const allVideos: ProcessedVideo[] = [];

  for (const account of accounts) {
    console.log(`\n[Instagram] Scraping account: ${account}`);

    try {
      const options: InstagramScraperOptions = {
        maxPosts: scrapeOptions.maxPosts || 30,
        includeComments: scrapeOptions.includeComments ?? true,
        maxComments: scrapeOptions.maxComments || 100,
        resultsType: (scrapeOptions.resultsType as 'posts' | 'reels' | 'stories') || 'posts',
      };

      const posts = await apifyClient.scrapeInstagramProfile(account, options);
      console.log(`[Instagram] Found ${posts.length} posts from ${account}`);

      // Filter to videos only
      const videoPosts = posts.filter(
        (p) => p.type === 'Video' || p.videoUrl || p.videoDuration
      );
      console.log(`[Instagram] ${videoPosts.length} are videos`);

      for (const post of videoPosts) {
        const normalized = normalizeInstagramPost(post);
        const filterResult = passesFilters(normalized, filters);

        if (filterResult.passes) {
          allVideos.push(normalized);
        } else {
          console.log(`  SKIP: ${normalized.title.substring(0, 50)}... - ${filterResult.reason}`);
        }
      }
    } catch (error) {
      console.error(`[Instagram] Error scraping ${account}:`, error);
    }
  }

  return allVideos;
}

// ============================================
// Audio Download
// ============================================

async function downloadAudio(video: ProcessedVideo, outputDir: string): Promise<string | null> {
  const tracksDir = path.join(outputDir, 'tracks');
  fs.mkdirSync(tracksDir, { recursive: true });

  const outputPath = path.join(tracksDir, `${video.platform}_${video.id}.mp3`);

  // Skip if already downloaded
  if (fs.existsSync(outputPath)) {
    console.log(`  Audio already exists: ${outputPath}`);
    return outputPath;
  }

  console.log(`  Downloading audio from: ${video.url}`);

  return new Promise((resolve) => {
    const ytdlpArgs = [
      video.url,
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0',
      '--output',
      outputPath,
      '--no-playlist',
      '--ffmpeg-location',
      path.dirname(FFMPEG_PATH),
    ];

    const proc = spawn(YTDLP_PATH, ytdlpArgs, { stdio: 'pipe' });

    let stderr = '';
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`  Downloaded: ${outputPath}`);
        resolve(outputPath);
      } else {
        console.error(`  Download failed: ${stderr.substring(0, 200)}`);
        resolve(null);
      }
    });

    proc.on('error', (err) => {
      console.error(`  Download error: ${err.message}`);
      resolve(null);
    });
  });
}

// ============================================
// ACRCloud Upload
// ============================================

async function uploadToACRCloud(
  video: ProcessedVideo,
  audioPath: string,
  dbTrackId: string
): Promise<{ success: boolean; acrId?: string; error?: string }> {
  const config = getBucketConfig();

  if (!config.bucketId || !config.bearerToken) {
    return {
      success: false,
      error: 'ACRCloud bucket credentials not configured',
    };
  }

  if (!fs.existsSync(audioPath)) {
    return { success: false, error: 'Audio file not found' };
  }

  const audioBuffer = fs.readFileSync(audioPath);
  const { artist, title } = parseTitle(video.title, video.username);

  // Build form data for Console API v2
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  const formParts: (string | Buffer)[] = [];

  const addField = (name: string, value: string) => {
    formParts.push(`--${boundary}\r\n`);
    formParts.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
    formParts.push(`${value}\r\n`);
  };

  addField('title', title);
  addField('data_type', 'audio');
  addField(
    'user_defined',
    JSON.stringify({
      artist: artist,
      source_platform: video.platform,
      source_url: video.url,
      source_id: video.id,
      db_track_id: dbTrackId,
    })
  );

  formParts.push(`--${boundary}\r\n`);
  formParts.push(`Content-Disposition: form-data; name="file"; filename="track.mp3"\r\n`);
  formParts.push(`Content-Type: audio/mp3\r\n\r\n`);
  formParts.push(audioBuffer);
  formParts.push(`\r\n--${boundary}--\r\n`);

  const bodyParts = formParts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)) as Uint8Array[];
  const bodyBuffer = Buffer.concat(bodyParts);

  try {
    const url = `https://${config.consoleHost}/api/buckets/${config.bucketId}/files`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.bearerToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer as unknown as BodyInit,
    });

    const result = await response.json();

    if (response.ok && result.data?.acr_id) {
      return { success: true, acrId: result.data.acr_id };
    }

    return {
      success: false,
      error: result.message || result.error || `HTTP ${response.status}`,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================
// Title Parsing
// ============================================

function parseTitle(fullTitle: string, uploader: string): { artist: string; title: string } {
  const separators = [' - ', ' – ', ' — ', ' | '];

  for (const sep of separators) {
    if (fullTitle.includes(sep)) {
      const [artist, ...rest] = fullTitle.split(sep);
      return {
        artist: artist.trim(),
        title: rest.join(sep).trim(),
      };
    }
  }

  // No separator found - use uploader as artist
  return {
    artist: uploader,
    title: fullTitle || 'Untitled',
  };
}

// ============================================
// Database Operations
// ============================================

async function saveTrackToDatabase(
  supabase: SupabaseClientType,
  video: ProcessedVideo,
  acrId?: string
): Promise<string | null> {
  const { artist, title } = parseTitle(video.title, video.username);

  // Check if already exists
  const { data: existing } = await supabase
    .from('unreleased_tracks')
    .select('id')
    .eq('source_url', video.url)
    .single();

  if (existing) {
    console.log(`  Already in database: ${(existing as any).id}`);
    return (existing as any).id;
  }

  // Insert new track
  const { data: newTrack, error } = await supabase
    .from('unreleased_tracks')
    .insert({
      title,
      artist,
      source_platform: video.platform,
      source_url: video.url,
      source_user: video.username,
      source_post_date: video.uploadDate.toISOString(),
      audio_duration_seconds: Math.round(video.duration),
      audio_quality: video.duration >= 180 ? 'high' : video.duration >= 60 ? 'medium' : 'clip',
      acrcloud_status: acrId ? 'uploaded' : 'pending',
      acrcloud_acr_id: acrId || null,
      fingerprint_created_at: acrId ? new Date().toISOString() : null,
      metadata: {
        platform_id: video.id,
      },
    })
    .select()
    .single();

  if (error || !newTrack) {
    console.error(`  Database insert error: ${error?.message || 'No data returned'}`);
    return null;
  }

  return (newTrack as any).id;
}

async function saveCommentsToDatabase(
  supabase: SupabaseClientType,
  trackId: string,
  video: ProcessedVideo,
  hints: CommentTrackHint[]
): Promise<number> {
  if (hints.length === 0) return 0;

  // Only save ID-related hints
  const idHints = commentParser.filterIdRelatedHints(hints);
  if (idHints.length === 0) return 0;

  const records = idHints.map((hint) => ({
    unreleased_track_id: trackId,
    platform: video.platform,
    hint_type: hint.hintType,
    original_comment: hint.sourceComment,
    commenter_username: hint.commenterUsername || null,
    parsed_artist: hint.possibleArtist || null,
    parsed_title: hint.possibleTitle || null,
    extracted_links: hint.extractedLinks || null,
    timestamp_reference: hint.timestamp || null,
    confidence: hint.confidence,
    is_reply_to_id_request: hint.isReplyToIdRequest,
  }));

  const { error } = await supabase.from('track_id_hints').insert(records);

  if (error) {
    console.error(`  Error saving hints: ${error.message}`);
    return 0;
  }

  return idHints.length;
}

// ============================================
// Main Processing Pipeline
// ============================================

async function processVideos(
  videos: ProcessedVideo[],
  dryRun: boolean = false
): Promise<{
  processed: number;
  uploaded: number;
  failed: number;
  hintsFound: number;
}> {
  const supabase = getSupabaseClient();
  if (!supabase && !dryRun) {
    console.error('Cannot proceed without Supabase connection');
    return { processed: 0, uploaded: 0, failed: 0, hintsFound: 0 };
  }

  const outputDir = path.join(OUTPUT_DIR, `scrape_${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });

  let processed = 0;
  let uploaded = 0;
  let failed = 0;
  let hintsFound = 0;

  for (const video of videos) {
    processed++;
    console.log(`\n[${processed}/${videos.length}] ${video.platform}: ${video.title.substring(0, 60)}...`);
    console.log(`  URL: ${video.url}`);
    console.log(`  Duration: ${video.duration}s, Username: @${video.username}`);

    // Parse comments for track hints
    if (video.comments && video.comments.length > 0) {
      const hints = commentParser.parsePostComments(video.comments);
      const idHints = commentParser.filterIdRelatedHints(hints);
      if (idHints.length > 0) {
        console.log(`  Found ${idHints.length} ID hints in comments`);
        hintsFound += idHints.length;

        if (!dryRun && idHints.length > 0) {
          // Will save after creating track
        }
      }
    }

    if (dryRun) {
      console.log('  [DRY RUN] Would download and process');
      continue;
    }

    // Download audio
    const audioPath = await downloadAudio(video, outputDir);
    if (!audioPath) {
      console.log('  FAILED: Could not download audio');
      failed++;
      continue;
    }

    // Save to database first
    const trackId = await saveTrackToDatabase(supabase!, video);
    if (!trackId) {
      console.log('  FAILED: Could not save to database');
      failed++;
      continue;
    }

    // Upload to ACRCloud
    const uploadResult = await uploadToACRCloud(video, audioPath, trackId);
    if (uploadResult.success) {
      // Update track with ACR ID
      await supabase!
        .from('unreleased_tracks')
        .update({
          acrcloud_acr_id: uploadResult.acrId,
          acrcloud_status: 'uploaded',
          fingerprint_created_at: new Date().toISOString(),
        })
        .eq('id', trackId);

      console.log(`  UPLOADED: ACR ID = ${uploadResult.acrId}`);
      uploaded++;
    } else {
      await supabase!
        .from('unreleased_tracks')
        .update({
          acrcloud_status: 'failed',
          metadata: {
            lastError: uploadResult.error,
            lastErrorAt: new Date().toISOString(),
          },
        })
        .eq('id', trackId);

      console.log(`  UPLOAD FAILED: ${uploadResult.error}`);
      failed++;
    }

    // Save comment hints
    if (video.comments && video.comments.length > 0) {
      const hints = commentParser.parsePostComments(video.comments);
      const savedHints = await saveCommentsToDatabase(supabase!, trackId, video, hints);
      if (savedHints > 0) {
        console.log(`  Saved ${savedHints} ID hints to database`);
      }
    }
  }

  return { processed, uploaded, failed, hintsFound };
}

// ============================================
// CLI Commands
// ============================================

async function runFromConfig(configPath: string, dryRun: boolean): Promise<void> {
  const configFile = fs.existsSync(configPath)
    ? configPath
    : DEFAULT_CONFIG_PATH;

  if (!fs.existsSync(configFile)) {
    console.error(`Config file not found: ${configFile}`);
    process.exit(1);
  }

  const config: ScraperConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const allVideos: ProcessedVideo[] = [];

  console.log('='.repeat(60));
  console.log('TikTok & Instagram Social Scraper');
  console.log('='.repeat(60));
  console.log(`Config: ${configFile}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  // Scrape TikTok accounts
  if (config.tiktok && config.tiktok.accounts.length > 0) {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`TikTok Accounts: ${config.tiktok.accounts.join(', ')}`);
    console.log('='.repeat(40));

    const tiktokVideos = await scrapeTikTokAccounts(
      config.tiktok.accounts,
      config.tiktok.filters,
      config.tiktok.scrapeOptions
    );
    allVideos.push(...tiktokVideos);
  }

  // Scrape Instagram accounts
  if (config.instagram && config.instagram.accounts.length > 0) {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`Instagram Accounts: ${config.instagram.accounts.join(', ')}`);
    console.log('='.repeat(40));

    const igVideos = await scrapeInstagramAccounts(
      config.instagram.accounts,
      config.instagram.filters,
      config.instagram.scrapeOptions
    );
    allVideos.push(...igVideos);
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Total videos to process: ${allVideos.length}`);
  console.log('='.repeat(40));

  if (allVideos.length === 0) {
    console.log('No videos found matching filters.');
    return;
  }

  // Process all videos
  const results = await processVideos(allVideos, dryRun);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${results.processed}`);
  console.log(`Uploaded:        ${results.uploaded}`);
  console.log(`Failed:          ${results.failed}`);
  console.log(`ID hints found:  ${results.hintsFound}`);
  console.log('');
}

async function runForPlatform(
  platform: 'tiktok' | 'instagram',
  accounts: string[],
  dryRun: boolean
): Promise<void> {
  console.log('='.repeat(60));
  console.log(`${platform.toUpperCase()} Scraper`);
  console.log('='.repeat(60));
  console.log(`Accounts: ${accounts.join(', ')}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  const defaultFilters: PlatformFilters = {
    minDuration: platform === 'tiktok' ? 15 : 10,
    maxAge: 9999, // No age limit - we'll cross-reference against released tracks DB
    keywords: [], // No keyword filter - rely on comments for ID hints
    excludeKeywords: ['released', 'out now', 'spotify', 'beatport', 'buy', 'available'],
  };

  let videos: ProcessedVideo[];

  if (platform === 'tiktok') {
    videos = await scrapeTikTokAccounts(accounts, defaultFilters);
  } else {
    videos = await scrapeInstagramAccounts(accounts, defaultFilters);
  }

  console.log(`\nFound ${videos.length} videos matching filters`);

  if (videos.length === 0) {
    return;
  }

  const results = await processVideos(videos, dryRun);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${results.processed}`);
  console.log(`Uploaded:        ${results.uploaded}`);
  console.log(`Failed:          ${results.failed}`);
  console.log(`ID hints found:  ${results.hintsFound}`);
}

async function testConnection(): Promise<void> {
  console.log('Testing Apify connection...\n');

  const result = await apifyClient.testConnection();

  if (result.success) {
    console.log('Apify connection successful!');
    console.log(`  Username: ${result.accountInfo?.username}`);
    console.log(`  Email: ${result.accountInfo?.email}`);
    console.log(`  Plan: ${result.accountInfo?.plan}`);
    console.log(`  Usage this period: $${result.accountInfo?.usageUsd.toFixed(2)}`);
  } else {
    console.error('Apify connection failed:', result.message);
    process.exit(1);
  }
}

async function processPending(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Cannot proceed without Supabase connection');
    return;
  }

  console.log('='.repeat(60));
  console.log('Processing Pending Uploads');
  console.log('='.repeat(60));

  const { data: pendingTracks, error } = await supabase
    .from('unreleased_tracks')
    .select('*')
    .eq('acrcloud_status', 'pending')
    .eq('is_active', true)
    .in('source_platform', ['tiktok', 'instagram'])
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('Error fetching pending tracks:', error);
    return;
  }

  if (!pendingTracks || pendingTracks.length === 0) {
    console.log('No pending TikTok/Instagram tracks to process.');
    return;
  }

  console.log(`Found ${pendingTracks.length} pending tracks\n`);

  for (const track of pendingTracks) {
    console.log(`- ${track.artist} - ${track.title}`);
    console.log(`  Source: ${track.source_url}`);
    console.log(`  Platform: ${track.source_platform}`);
    console.log(`  Created: ${track.created_at}`);
  }

  console.log('\nTo re-process these tracks, download audio and upload to ACRCloud.');
  console.log('Run this scraper again with the source URLs to retry.');
}

// ============================================
// CLI Entry Point
// ============================================

function printUsage(): void {
  console.log(`
TikTok & Instagram Social Scraper

Usage:
  bun scripts/social-scraper.ts --platform <tiktok|instagram> --accounts <@user1,@user2>
  bun scripts/social-scraper.ts --config <path-to-config.json>
  bun scripts/social-scraper.ts --test-connection
  bun scripts/social-scraper.ts --process-pending

Options:
  --platform      Platform to scrape (tiktok or instagram)
  --accounts      Comma-separated list of accounts to scrape
  --config        Path to config JSON file (default: ./scripts/scraper-config.json)
  --dry-run       Don't download or upload, just show what would be processed
  --test-connection  Test Apify API connection
  --process-pending  List pending tracks in database

Examples:
  bun scripts/social-scraper.ts --platform tiktok --accounts @djname1,@djname2
  bun scripts/social-scraper.ts --platform instagram --accounts djname1 --dry-run
  bun scripts/social-scraper.ts --config ./my-config.json
  bun scripts/social-scraper.ts --test-connection

Prerequisites:
  - APIFY_API_TOKEN environment variable set
  - yt-dlp installed (brew install yt-dlp)
  - ffmpeg installed (brew install ffmpeg)
  - Supabase and ACRCloud credentials configured
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
  }

  // Check dependencies first
  if (!checkDependencies()) {
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');

  // Test connection
  if (args.includes('--test-connection')) {
    await testConnection();
    return;
  }

  // Process pending
  if (args.includes('--process-pending')) {
    await processPending();
    return;
  }

  // Run from config
  const configIdx = args.indexOf('--config');
  if (configIdx !== -1) {
    const configPath = args[configIdx + 1] || DEFAULT_CONFIG_PATH;
    await runFromConfig(configPath, dryRun);
    return;
  }

  // Run for specific platform
  const platformIdx = args.indexOf('--platform');
  const accountsIdx = args.indexOf('--accounts');

  if (platformIdx !== -1 && accountsIdx !== -1) {
    const platform = args[platformIdx + 1] as 'tiktok' | 'instagram';
    const accountsStr = args[accountsIdx + 1];

    if (!platform || !['tiktok', 'instagram'].includes(platform)) {
      console.error('Invalid platform. Use: tiktok or instagram');
      process.exit(1);
    }

    if (!accountsStr) {
      console.error('No accounts specified');
      process.exit(1);
    }

    const accounts = accountsStr.split(',').map((a) => a.trim());
    await runForPlatform(platform, accounts, dryRun);
    return;
  }

  // Default: run from config
  await runFromConfig(DEFAULT_CONFIG_PATH, dryRun);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
