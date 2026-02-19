#!/usr/bin/env bun
/**
 * TikTok & Instagram Social Scraper
 *
 * Scrapes TikTok and Instagram profiles for unreleased/ID tracks using Apify,
 * downloads audio (CDN-first with yt-dlp fallback), and uploads to ACRCloud custom bucket.
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
 *   - ffmpeg installed (brew install ffmpeg)
 *   - yt-dlp optional but recommended as fallback (brew install yt-dlp)
 *   - Supabase and ACRCloud credentials configured
 */

import * as fs from 'fs';
import * as path from 'path';

import apifyClient, {
  TikTokScraperOptions,
  InstagramScraperOptions,
} from '../services/apifyClient';

import {
  ProcessedVideo,
  PlatformFilters,
  ScrapeOptions,
  ScraperConfig,
  PROJECT_ROOT,
  OUTPUT_DIR,
  getSupabaseClient,
  checkYtdlpAvailable,
  checkFfmpegAvailable,
  passesFilters,
  normalizeTikTokVideo,
  normalizeInstagramPost,
  downloadAudioWithFallback,
  downloadAudioYtdlp,
  uploadToACRCloud,
  parseTitle,
  processVideos,
  saveTrackToDatabase,
} from '../lib/scraper-pipeline';

// ============================================
// Paths
// ============================================

const DEFAULT_CONFIG_PATH = path.join(__dirname, 'scraper-config.json');

// ============================================
// Dependency Checks
// ============================================

function checkDependencies(): boolean {
  let allGood = true;

  // Check yt-dlp (optional — warn instead of error)
  if (checkYtdlpAvailable()) {
    console.log('[Dependencies] yt-dlp available (fallback enabled)');
  } else {
    console.warn('[Dependencies] WARNING: yt-dlp not found. CDN downloads still work, but fallback is disabled.');
    console.warn('[Dependencies]   Install with: brew install yt-dlp');
  }

  // Check ffmpeg (required for audio extraction)
  if (checkFfmpegAvailable()) {
    console.log('[Dependencies] ffmpeg available');
  } else {
    console.error('[Dependencies] ERROR: ffmpeg not found. Install with: brew install ffmpeg');
    allGood = false;
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
// TikTok Scraping
// ============================================

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
// Instagram Scraping
// ============================================

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
// Process Pending — Real Retry Logic
// ============================================

const MAX_RETRIES = 3;

async function processPending(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Cannot proceed without Supabase connection');
    return;
  }

  console.log('='.repeat(60));
  console.log('Processing Pending / Failed Uploads');
  console.log('='.repeat(60));

  // Fetch tracks with pending or failed status
  const { data: pendingTracks, error } = await supabase
    .from('unreleased_tracks')
    .select('*')
    .eq('is_active', true)
    .in('source_platform', ['tiktok', 'instagram'])
    .in('acrcloud_status', ['pending', 'failed'])
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

  console.log(`Found ${pendingTracks.length} pending/failed tracks\n`);

  const outputDir = path.join(OUTPUT_DIR, `retry_${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });

  let retried = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const track of pendingTracks) {
    const retryCount = track.metadata?.retryCount || 0;

    console.log(`\n[${retried + skipped + 1}/${pendingTracks.length}] ${track.artist} - ${track.title}`);
    console.log(`  Source: ${track.source_url}`);
    console.log(`  Status: ${track.acrcloud_status}, Retries: ${retryCount}/${MAX_RETRIES}`);

    // Skip if max retries exceeded
    if (retryCount >= MAX_RETRIES) {
      console.log(`  SKIP: Max retries (${MAX_RETRIES}) exceeded`);
      skipped++;
      continue;
    }

    retried++;

    // CDN URLs are expired by retry time, so use yt-dlp
    const tracksDir = path.join(outputDir, 'tracks');
    fs.mkdirSync(tracksDir, { recursive: true });
    const outputPath = path.join(tracksDir, `${track.source_platform}_${track.metadata?.platform_id || track.id}.mp3`);

    const audioPath = await downloadAudioYtdlp(track.source_url, outputPath);
    if (!audioPath) {
      console.log('  FAILED: Could not download audio');
      // Update retry count
      await supabase
        .from('unreleased_tracks')
        .update({
          acrcloud_status: 'failed',
          metadata: {
            ...track.metadata,
            retryCount: retryCount + 1,
            lastRetryAt: new Date().toISOString(),
            lastError: 'Download failed',
          },
        })
        .eq('id', track.id);
      failed++;
      continue;
    }

    // Build a ProcessedVideo-like object for ACRCloud upload
    const video: ProcessedVideo = {
      id: track.metadata?.platform_id || track.id,
      platform: track.source_platform,
      url: track.source_url,
      title: track.title,
      description: track.title,
      duration: track.audio_duration_seconds || 0,
      uploadDate: new Date(track.source_post_date || track.created_at),
      username: track.source_user || '',
    };

    // Upload to ACRCloud
    const uploadResult = await uploadToACRCloud(video, audioPath, track.id);
    if (uploadResult.success) {
      await supabase
        .from('unreleased_tracks')
        .update({
          acrcloud_acr_id: uploadResult.acrId,
          acrcloud_status: 'uploaded',
          fingerprint_created_at: new Date().toISOString(),
          metadata: {
            ...track.metadata,
            retryCount: retryCount + 1,
            lastRetryAt: new Date().toISOString(),
          },
        })
        .eq('id', track.id);

      console.log(`  UPLOADED: ACR ID = ${uploadResult.acrId}`);
      succeeded++;
    } else {
      await supabase
        .from('unreleased_tracks')
        .update({
          acrcloud_status: 'failed',
          metadata: {
            ...track.metadata,
            retryCount: retryCount + 1,
            lastRetryAt: new Date().toISOString(),
            lastError: uploadResult.error,
          },
        })
        .eq('id', track.id);

      console.log(`  UPLOAD FAILED: ${uploadResult.error}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('RETRY SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total found:  ${pendingTracks.length}`);
  console.log(`Retried:      ${retried}`);
  console.log(`Succeeded:    ${succeeded}`);
  console.log(`Failed:       ${failed}`);
  console.log(`Skipped:      ${skipped} (max retries exceeded)`);
}

// ============================================
// CLI Commands
// ============================================

async function runFromConfig(configPath: string, dryRun: boolean, platformFilter?: 'tiktok' | 'instagram'): Promise<void> {
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
  console.log(`Platform: ${platformFilter || 'all'}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  // Scrape TikTok accounts (skip if platform filter is instagram-only)
  if ((!platformFilter || platformFilter === 'tiktok') && config.tiktok && config.tiktok.accounts.length > 0) {
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

  // Scrape Instagram accounts (skip if platform filter is tiktok-only)
  if ((!platformFilter || platformFilter === 'instagram') && config.instagram) {
    // Merge curator accounts + regular accounts, dedup
    const allAccounts = [
      ...((config.instagram as any).curatorAccounts || []),
      ...(config.instagram.accounts || []),
    ];
    const uniqueAccounts = [...new Set(allAccounts)];

    if (uniqueAccounts.length > 0) {
      const curatorCount = ((config.instagram as any).curatorAccounts || []).length;
      console.log(`\n${'='.repeat(40)}`);
      console.log(`Instagram Accounts: ${uniqueAccounts.length} total (${curatorCount} curators + ${uniqueAccounts.length - curatorCount} artists)`);
      console.log('='.repeat(40));

      const igVideos = await scrapeInstagramAccounts(
        uniqueAccounts,
        config.instagram.filters,
        config.instagram.scrapeOptions
      );
      allVideos.push(...igVideos);
    }
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Total videos to process: ${allVideos.length}`);
  console.log('='.repeat(40));

  if (allVideos.length === 0) {
    console.log('No videos found matching filters.');
    return;
  }

  // Process all videos
  const results = await processVideos(allVideos, dryRun, undefined, { checkSpotify: true, checkDuplicates: true });

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

  const results = await processVideos(videos, dryRun, undefined, { checkSpotify: true, checkDuplicates: true });

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
  --platform         Platform to scrape (tiktok or instagram)
  --accounts         Comma-separated list of accounts to scrape
  --config           Path to config JSON file (default: ./scripts/scraper-config.json)
  --dry-run          Don't download or upload, just show what would be processed
  --test-connection  Test Apify API connection
  --process-pending  Retry pending/failed uploads (re-downloads via yt-dlp, re-uploads to ACRCloud)

Examples:
  bun scripts/social-scraper.ts --platform tiktok --accounts @cloonee,@pawsamusic
  bun scripts/social-scraper.ts --platform instagram --accounts sonnyfodera --dry-run
  bun scripts/social-scraper.ts --config ./my-config.json
  bun scripts/social-scraper.ts --test-connection
  bun scripts/social-scraper.ts --process-pending

Prerequisites:
  - APIFY_API_TOKEN environment variable set
  - ffmpeg installed (brew install ffmpeg)
  - yt-dlp optional as fallback (brew install yt-dlp)
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

  // Parse platform filter (can be used with --config or --accounts)
  const platformIdx = args.indexOf('--platform');
  const platform = platformIdx !== -1 ? args[platformIdx + 1] as 'tiktok' | 'instagram' : undefined;
  if (platform && !['tiktok', 'instagram'].includes(platform)) {
    console.error('Invalid platform. Use: tiktok or instagram');
    process.exit(1);
  }

  // Run from config (optionally filtered by platform)
  const configIdx = args.indexOf('--config');
  if (configIdx !== -1) {
    const configPath = args[configIdx + 1] || DEFAULT_CONFIG_PATH;
    await runFromConfig(configPath, dryRun, platform);
    return;
  }

  // Run for specific platform with explicit accounts
  const accountsIdx = args.indexOf('--accounts');
  if (platformIdx !== -1 && accountsIdx !== -1) {
    const accountsStr = args[accountsIdx + 1];

    if (!platform) {
      console.error('No platform specified');
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

  // --platform without --accounts or --config: use config filtered by platform
  if (platformIdx !== -1 && platform) {
    await runFromConfig(DEFAULT_CONFIG_PATH, dryRun, platform);
    return;
  }

  // Default: run from config (all platforms)
  await runFromConfig(DEFAULT_CONFIG_PATH, dryRun);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
