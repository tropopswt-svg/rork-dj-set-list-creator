#!/usr/bin/env bun
/**
 * Mass Scrape — Unified Multi-Platform Orchestration
 *
 * Runs all 4 platform scrapers in sequence with shared deduplication:
 *   1. YouTube   (yt-dlp download, no CDN expiry concern)
 *   2. TikTok    (Apify, CDN URLs expire in ~1-2h)
 *   3. Instagram (Apify, CDN URLs expire in ~1-2h)
 *   4. SoundCloud (yt-dlp download)
 *
 * Usage:
 *   bun scripts/mass-scrape.ts
 *   bun scripts/mass-scrape.ts --dry-run
 *   bun scripts/mass-scrape.ts --platforms youtube,tiktok
 *   bun scripts/mass-scrape.ts --platforms youtube --dry-run
 *   bun scripts/mass-scrape.ts --config ./scripts/scraper-config.json
 *
 * Prerequisites:
 *   - Platform-specific API keys (YOUTUBE_API_KEY, APIFY_API_TOKEN)
 *   - ffmpeg installed (brew install ffmpeg)
 *   - yt-dlp installed (brew install yt-dlp)
 *   - Supabase and ACRCloud credentials configured
 */

import * as fs from 'fs';
import * as path from 'path';

import apifyClient, {
  TikTokScraperOptions,
  InstagramScraperOptions,
} from '../services/apifyClient';

import {
  searchVideos,
  resolveChannelId,
  fetchChannelUploads,
  fetchVideoDetails,
  fetchVideoComments,
  SearchOptions,
} from '../services/youtube';

import {
  ProcessedVideo,
  PlatformFilters,
  YouTubeFilters,
  ScrapeOptions,
  ScraperConfig,
  PROJECT_ROOT,
  OUTPUT_DIR,
  getSupabaseClient,
  checkYtdlpAvailable,
  checkFfmpegAvailable,
  passesFilters,
  passesYouTubeFilters,
  normalizeTikTokVideo,
  normalizeInstagramPost,
  normalizeYouTubeVideo,
  normalizeYouTubeSearchResult,
  downloadAudioWithFallback,
  downloadAudioYtdlp,
  processVideos,
} from '../lib/scraper-pipeline';

// ============================================
// Types
// ============================================

type Platform = 'youtube' | 'tiktok' | 'instagram' | 'soundcloud';

interface PlatformResult {
  platform: Platform;
  videosFound: number;
  processed: number;
  uploaded: number;
  failed: number;
  hintsFound: number;
  duration: number; // ms
  error?: string;
}

// ============================================
// Paths
// ============================================

const DEFAULT_CONFIG_PATH = path.join(__dirname, 'scraper-config.json');

// ============================================
// Dependency Checks
// ============================================

function checkPlatformDependencies(platforms: Platform[]): { ready: Platform[]; skipped: Platform[] } {
  const ready: Platform[] = [];
  const skipped: Platform[] = [];

  const hasYtdlp = checkYtdlpAvailable();
  const hasFfmpeg = checkFfmpegAvailable();
  const hasYouTubeKey = !!(process.env.YOUTUBE_API_KEY || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY);
  const hasApify = apifyClient.isApifyConfigured();

  console.log('[Dependencies]');
  console.log(`  yt-dlp:          ${hasYtdlp ? 'available' : 'MISSING'}`);
  console.log(`  ffmpeg:          ${hasFfmpeg ? 'available' : 'MISSING'}`);
  console.log(`  YouTube API key: ${hasYouTubeKey ? 'configured' : 'MISSING'}`);
  console.log(`  Apify API token: ${hasApify ? 'configured' : 'MISSING'}`);
  console.log('');

  if (!hasFfmpeg) {
    console.error('[Dependencies] ERROR: ffmpeg is required. Install with: brew install ffmpeg');
    return { ready: [], skipped: platforms };
  }

  for (const platform of platforms) {
    switch (platform) {
      case 'youtube':
        if (hasYouTubeKey && hasYtdlp) {
          ready.push(platform);
        } else {
          console.warn(`[Dependencies] Skipping YouTube: ${!hasYouTubeKey ? 'no API key' : 'no yt-dlp'}`);
          skipped.push(platform);
        }
        break;

      case 'tiktok':
      case 'instagram':
        if (hasApify) {
          ready.push(platform);
        } else {
          console.warn(`[Dependencies] Skipping ${platform}: no Apify API token`);
          skipped.push(platform);
        }
        break;

      case 'soundcloud':
        if (hasYtdlp) {
          ready.push(platform);
        } else {
          console.warn(`[Dependencies] Skipping SoundCloud: no yt-dlp`);
          skipped.push(platform);
        }
        break;
    }
  }

  return { ready, skipped };
}

// ============================================
// YouTube Scraping (inlined for self-containment)
// ============================================

async function scrapeYouTube(config: ScraperConfig, dryRun: boolean, globalSeenUrls: Set<string>): Promise<PlatformResult> {
  const start = Date.now();
  const ytConfig = config.youtube;

  if (!ytConfig) {
    return { platform: 'youtube', videosFound: 0, processed: 0, uploaded: 0, failed: 0, hintsFound: 0, duration: 0, error: 'No youtube config' };
  }

  const allVideos: ProcessedVideo[] = [];
  const filters = ytConfig.filters;
  const opts = ytConfig.scrapeOptions || {};

  const publishedAfter = filters.maxAge
    ? new Date(Date.now() - filters.maxAge * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  // 1. Channel scraping
  if (ytConfig.channels && ytConfig.channels.length > 0) {
    console.log(`\n[YouTube] Scraping ${ytConfig.channels.length} channels...`);

    for (const channel of ytConfig.channels) {
      try {
        const channelId = await resolveChannelId(channel);
        if (!channelId) {
          console.log(`  Could not resolve: ${channel}`);
          continue;
        }

        const uploads = await fetchChannelUploads(channelId, opts.maxVideos || 30, publishedAfter);
        if (uploads.length === 0) continue;

        const videoIds = uploads.map((u) => u.videoId);
        const details = await fetchVideoDetails(videoIds);
        const detailsMap = new Map(details.map((d) => [d.id, d]));

        for (const upload of uploads) {
          const detail = detailsMap.get(upload.videoId);
          if (!detail) continue;

          const url = `https://www.youtube.com/watch?v=${upload.videoId}`;
          if (globalSeenUrls.has(url)) continue;

          let comments;
          if (opts.includeComments && (detail.commentCount ?? 0) > 0) {
            try { comments = await fetchVideoComments(upload.videoId, opts.maxComments || 200); } catch {}
          }

          const normalized = normalizeYouTubeSearchResult(upload, detail, comments);
          const filterResult = passesYouTubeFilters(normalized, filters);

          if (filterResult.passes) {
            allVideos.push(normalized);
            globalSeenUrls.add(url);
          }
        }

        console.log(`  ${channel}: ${uploads.length} uploads, ${allVideos.length} total matches`);
      } catch (error) {
        console.error(`  Error scraping ${channel}:`, error);
      }
    }
  }

  // 2. Search scraping
  if (ytConfig.searchQueries && ytConfig.searchQueries.length > 0) {
    console.log(`\n[YouTube] Running ${ytConfig.searchQueries.length} search queries...`);

    for (const query of ytConfig.searchQueries) {
      try {
        const searchOpts: SearchOptions = {
          maxResults: opts.maxResultsPerQuery || 25,
          publishedAfter,
          order: 'relevance',
          videoDuration: 'short',
        };

        const results = await searchVideos(query, searchOpts);
        const newResults = results.filter((r) => {
          const url = `https://www.youtube.com/watch?v=${r.videoId}`;
          return !globalSeenUrls.has(url);
        });

        if (newResults.length === 0) continue;

        const videoIds = newResults.map((r) => r.videoId);
        const details = await fetchVideoDetails(videoIds);
        const detailsMap = new Map(details.map((d) => [d.id, d]));

        for (const result of newResults) {
          const detail = detailsMap.get(result.videoId);
          if (!detail) continue;

          const url = `https://www.youtube.com/watch?v=${result.videoId}`;

          let comments;
          if (opts.includeComments && (detail.commentCount ?? 0) > 0) {
            try { comments = await fetchVideoComments(result.videoId, opts.maxComments || 200); } catch {}
          }

          const normalized = normalizeYouTubeSearchResult(result, detail, comments);
          const filterResult = passesYouTubeFilters(normalized, filters);

          if (filterResult.passes) {
            allVideos.push(normalized);
            globalSeenUrls.add(url);
          }
        }

        console.log(`  "${query}": ${results.length} results, ${newResults.length} new`);
      } catch (error) {
        console.error(`  Error searching "${query}":`, error);
      }
    }
  }

  console.log(`\n[YouTube] Total: ${allVideos.length} videos to process`);

  if (allVideos.length === 0) {
    return { platform: 'youtube', videosFound: 0, processed: 0, uploaded: 0, failed: 0, hintsFound: 0, duration: Date.now() - start };
  }

  const results = await processVideos(allVideos, dryRun, { scraper: 'mass-scrape' }, {
    checkSpotify: true,
    checkDuplicates: true,
  });

  return {
    platform: 'youtube',
    videosFound: allVideos.length,
    ...results,
    duration: Date.now() - start,
  };
}

// ============================================
// TikTok Scraping
// ============================================

async function scrapeTikTok(config: ScraperConfig, dryRun: boolean, globalSeenUrls: Set<string>): Promise<PlatformResult> {
  const start = Date.now();
  const ttConfig = config.tiktok;

  if (!ttConfig || ttConfig.accounts.length === 0) {
    return { platform: 'tiktok', videosFound: 0, processed: 0, uploaded: 0, failed: 0, hintsFound: 0, duration: 0, error: 'No tiktok config' };
  }

  const allVideos: ProcessedVideo[] = [];
  const opts = ttConfig.scrapeOptions || {};

  console.log(`\n[TikTok] Scraping ${ttConfig.accounts.length} accounts...`);

  for (const account of ttConfig.accounts) {
    try {
      const options: TikTokScraperOptions = {
        maxVideos: opts.maxVideos || 30,
        includeComments: opts.includeComments ?? true,
        maxComments: opts.maxComments || 100,
      };

      const videos = await apifyClient.scrapeTikTokProfile(account, options);

      // Fetch comments from separate dataset
      for (const video of videos as any[]) {
        if (video.commentsDatasetUrl && video.commentCount > 0) {
          try {
            const commentsResp = await fetch(video.commentsDatasetUrl);
            if (commentsResp.ok) {
              video.comments = await commentsResp.json();
            }
          } catch {}
        }
      }

      for (const video of videos) {
        const normalized = normalizeTikTokVideo(video);
        if (!normalized) continue;

        if (globalSeenUrls.has(normalized.url)) continue;

        const filterResult = passesFilters(normalized, ttConfig.filters);
        if (filterResult.passes) {
          allVideos.push(normalized);
          globalSeenUrls.add(normalized.url);
        }
      }

      console.log(`  ${account}: ${videos.length} videos, ${allVideos.length} total matches`);
    } catch (error) {
      console.error(`  Error scraping ${account}:`, error);
    }
  }

  console.log(`\n[TikTok] Total: ${allVideos.length} videos to process`);

  if (allVideos.length === 0) {
    return { platform: 'tiktok', videosFound: 0, processed: 0, uploaded: 0, failed: 0, hintsFound: 0, duration: Date.now() - start };
  }

  const results = await processVideos(allVideos, dryRun, { scraper: 'mass-scrape' }, {
    checkSpotify: true,
    checkDuplicates: true,
  });

  return {
    platform: 'tiktok',
    videosFound: allVideos.length,
    ...results,
    duration: Date.now() - start,
  };
}

// ============================================
// Instagram Scraping
// ============================================

async function scrapeInstagram(config: ScraperConfig, dryRun: boolean, globalSeenUrls: Set<string>): Promise<PlatformResult> {
  const start = Date.now();
  const igConfig = config.instagram;

  if (!igConfig || igConfig.accounts.length === 0) {
    return { platform: 'instagram', videosFound: 0, processed: 0, uploaded: 0, failed: 0, hintsFound: 0, duration: 0, error: 'No instagram config' };
  }

  const allVideos: ProcessedVideo[] = [];
  const opts = igConfig.scrapeOptions || {};

  console.log(`\n[Instagram] Scraping ${igConfig.accounts.length} accounts...`);

  for (const account of igConfig.accounts) {
    try {
      const options: InstagramScraperOptions = {
        maxPosts: opts.maxPosts || 30,
        includeComments: opts.includeComments ?? true,
        maxComments: opts.maxComments || 100,
        resultsType: (opts.resultsType as 'posts' | 'reels' | 'stories') || 'posts',
      };

      const posts = await apifyClient.scrapeInstagramProfile(account, options);
      const videoPosts = posts.filter((p) => p.type === 'Video' || p.videoUrl || p.videoDuration);

      for (const post of videoPosts) {
        const normalized = normalizeInstagramPost(post);

        if (globalSeenUrls.has(normalized.url)) continue;

        const filterResult = passesFilters(normalized, igConfig.filters);
        if (filterResult.passes) {
          allVideos.push(normalized);
          globalSeenUrls.add(normalized.url);
        }
      }

      console.log(`  ${account}: ${posts.length} posts (${videoPosts.length} video), ${allVideos.length} total matches`);
    } catch (error) {
      console.error(`  Error scraping ${account}:`, error);
    }
  }

  console.log(`\n[Instagram] Total: ${allVideos.length} videos to process`);

  if (allVideos.length === 0) {
    return { platform: 'instagram', videosFound: 0, processed: 0, uploaded: 0, failed: 0, hintsFound: 0, duration: Date.now() - start };
  }

  const results = await processVideos(allVideos, dryRun, { scraper: 'mass-scrape' }, {
    checkSpotify: true,
    checkDuplicates: true,
  });

  return {
    platform: 'instagram',
    videosFound: allVideos.length,
    ...results,
    duration: Date.now() - start,
  };
}

// ============================================
// SoundCloud Scraping
// ============================================

async function scrapeSoundCloud(config: ScraperConfig, dryRun: boolean, globalSeenUrls: Set<string>): Promise<PlatformResult> {
  const start = Date.now();
  const scConfig = config.soundcloud;

  if (!scConfig || scConfig.profiles.length === 0) {
    return { platform: 'soundcloud', videosFound: 0, processed: 0, uploaded: 0, failed: 0, hintsFound: 0, duration: 0, error: 'No soundcloud config' };
  }

  const allVideos: ProcessedVideo[] = [];

  console.log(`\n[SoundCloud] Scraping ${scConfig.profiles.length} profiles...`);
  console.log(`  Note: SoundCloud scraping uses yt-dlp to enumerate and download tracks`);

  // SoundCloud scraping via yt-dlp --flat-playlist to list tracks,
  // then download individually. We create ProcessedVideo objects from the metadata.
  const { execSync } = await import('child_process');
  const { YTDLP_PATH } = await import('../lib/scraper-pipeline');

  for (const profile of scConfig.profiles) {
    try {
      const profileUrl = profile.startsWith('http')
        ? profile
        : `https://soundcloud.com/${profile}`;

      console.log(`  Fetching track list from: ${profileUrl}`);

      // Use yt-dlp to list tracks with metadata
      let output: string;
      try {
        output = execSync(
          `${YTDLP_PATH} --flat-playlist --dump-json "${profileUrl}/tracks"`,
          { timeout: 60000, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' }
        );
      } catch {
        console.log(`    Could not enumerate tracks for ${profile}`);
        continue;
      }

      const lines = output.trim().split('\n').filter(Boolean);
      const maxTracks = scConfig.scrapeOptions?.maxVideos || 30;
      const tracks = lines.slice(0, maxTracks);

      console.log(`    Found ${lines.length} tracks, processing up to ${maxTracks}`);

      for (const line of tracks) {
        try {
          const meta = JSON.parse(line);
          const url = meta.url || meta.webpage_url || `https://soundcloud.com/${profile}/${meta.id}`;

          if (globalSeenUrls.has(url)) continue;

          const normalized: ProcessedVideo = {
            id: String(meta.id || meta.display_id || ''),
            platform: 'soundcloud',
            url,
            title: meta.title || 'Untitled',
            description: meta.description || '',
            duration: meta.duration || 0,
            uploadDate: meta.upload_date
              ? new Date(meta.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
              : new Date(),
            username: meta.uploader || profile,
          };

          if (!normalized.id) continue;

          const filterResult = passesFilters(normalized, scConfig.filters);
          if (filterResult.passes) {
            allVideos.push(normalized);
            globalSeenUrls.add(url);
          }
        } catch {
          // Skip unparseable lines
        }
      }

      console.log(`    ${profile}: ${allVideos.length} total matches`);
    } catch (error) {
      console.error(`  Error scraping ${profile}:`, error);
    }
  }

  console.log(`\n[SoundCloud] Total: ${allVideos.length} tracks to process`);

  if (allVideos.length === 0) {
    return { platform: 'soundcloud', videosFound: 0, processed: 0, uploaded: 0, failed: 0, hintsFound: 0, duration: Date.now() - start };
  }

  const results = await processVideos(allVideos, dryRun, { scraper: 'mass-scrape' }, {
    checkSpotify: true,
    checkDuplicates: true,
  });

  return {
    platform: 'soundcloud',
    videosFound: allVideos.length,
    ...results,
    duration: Date.now() - start,
  };
}

// ============================================
// Orchestrator
// ============================================

const PLATFORM_ORDER: Platform[] = ['youtube', 'tiktok', 'instagram', 'soundcloud'];

async function runMassScrape(
  config: ScraperConfig,
  platforms: Platform[],
  dryRun: boolean
): Promise<void> {
  console.log('='.repeat(60));
  console.log('MASS SCRAPE — Multi-Platform Orchestration');
  console.log('='.repeat(60));
  console.log(`Platforms: ${platforms.join(', ')}`);
  console.log(`Dry run:   ${dryRun}`);
  console.log(`Started:   ${new Date().toISOString()}`);
  console.log('');

  // Shared deduplication set across all platforms
  const globalSeenUrls = new Set<string>();
  const results: PlatformResult[] = [];

  // Sort platforms by the defined order
  const sortedPlatforms = platforms.sort(
    (a, b) => PLATFORM_ORDER.indexOf(a) - PLATFORM_ORDER.indexOf(b)
  );

  for (const platform of sortedPlatforms) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`PLATFORM: ${platform.toUpperCase()}`);
    console.log('='.repeat(60));

    let result: PlatformResult;

    try {
      switch (platform) {
        case 'youtube':
          result = await scrapeYouTube(config, dryRun, globalSeenUrls);
          break;
        case 'tiktok':
          result = await scrapeTikTok(config, dryRun, globalSeenUrls);
          break;
        case 'instagram':
          result = await scrapeInstagram(config, dryRun, globalSeenUrls);
          break;
        case 'soundcloud':
          result = await scrapeSoundCloud(config, dryRun, globalSeenUrls);
          break;
      }
    } catch (error) {
      console.error(`[${platform}] Fatal error:`, error);
      result = {
        platform,
        videosFound: 0,
        processed: 0,
        uploaded: 0,
        failed: 0,
        hintsFound: 0,
        duration: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    results.push(result);

    console.log(`\n[${platform}] Done in ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`  Found: ${result.videosFound}, Processed: ${result.processed}, Uploaded: ${result.uploaded}, Failed: ${result.failed}`);
  }

  // ==========================================
  // Aggregate Summary
  // ==========================================

  console.log('\n' + '='.repeat(60));
  console.log('MASS SCRAPE SUMMARY');
  console.log('='.repeat(60));
  console.log('');

  const totals = {
    videosFound: 0,
    processed: 0,
    uploaded: 0,
    failed: 0,
    hintsFound: 0,
    duration: 0,
  };

  for (const r of results) {
    const status = r.error ? `ERROR: ${r.error}` : 'OK';
    console.log(`  ${r.platform.padEnd(12)} | Found: ${String(r.videosFound).padStart(3)} | Processed: ${String(r.processed).padStart(3)} | Uploaded: ${String(r.uploaded).padStart(3)} | Failed: ${String(r.failed).padStart(3)} | Hints: ${String(r.hintsFound).padStart(3)} | ${(r.duration / 1000).toFixed(1)}s | ${status}`);

    totals.videosFound += r.videosFound;
    totals.processed += r.processed;
    totals.uploaded += r.uploaded;
    totals.failed += r.failed;
    totals.hintsFound += r.hintsFound;
    totals.duration += r.duration;
  }

  console.log('  ' + '-'.repeat(100));
  console.log(`  ${'TOTAL'.padEnd(12)} | Found: ${String(totals.videosFound).padStart(3)} | Processed: ${String(totals.processed).padStart(3)} | Uploaded: ${String(totals.uploaded).padStart(3)} | Failed: ${String(totals.failed).padStart(3)} | Hints: ${String(totals.hintsFound).padStart(3)} | ${(totals.duration / 1000).toFixed(1)}s`);
  console.log('');
  console.log(`Global dedup pool: ${globalSeenUrls.size} unique URLs`);
  console.log(`Finished: ${new Date().toISOString()}`);
  console.log('');
}

// ============================================
// CLI Entry Point
// ============================================

function printUsage(): void {
  console.log(`
Mass Scrape — Multi-Platform Unreleased Track Orchestrator

Usage:
  bun scripts/mass-scrape.ts
  bun scripts/mass-scrape.ts --dry-run
  bun scripts/mass-scrape.ts --platforms youtube,tiktok
  bun scripts/mass-scrape.ts --platforms youtube --dry-run
  bun scripts/mass-scrape.ts --config ./scripts/scraper-config.json

Options:
  --config      Path to config JSON (default: ./scripts/scraper-config.json)
  --platforms   Comma-separated list of platforms to scrape (default: all configured)
                Available: youtube, tiktok, instagram, soundcloud
  --dry-run     Don't download or upload, just show what would be processed

Platform execution order:
  1. YouTube    — yt-dlp download, no CDN expiry concern
  2. TikTok     — Apify scraper, CDN URLs expire in ~1-2h
  3. Instagram  — Apify scraper, CDN URLs expire in ~1-2h
  4. SoundCloud — yt-dlp download

Examples:
  bun scripts/mass-scrape.ts                                    # Scrape all platforms
  bun scripts/mass-scrape.ts --dry-run                          # Dry run all platforms
  bun scripts/mass-scrape.ts --platforms youtube,soundcloud      # YouTube + SoundCloud only
  bun scripts/mass-scrape.ts --platforms youtube --dry-run       # Test just YouTube
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const dryRun = args.includes('--dry-run');

  // Load config
  const configIdx = args.indexOf('--config');
  const configPath = configIdx !== -1 ? args[configIdx + 1] || DEFAULT_CONFIG_PATH : DEFAULT_CONFIG_PATH;

  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  const config: ScraperConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  // Determine which platforms to run
  let requestedPlatforms: Platform[];

  const platformsIdx = args.indexOf('--platforms');
  if (platformsIdx !== -1) {
    const platformStr = args[platformsIdx + 1];
    if (!platformStr) {
      console.error('No platforms specified after --platforms');
      process.exit(1);
    }
    requestedPlatforms = platformStr.split(',').map((p) => p.trim() as Platform);

    // Validate
    const valid: Platform[] = ['youtube', 'tiktok', 'instagram', 'soundcloud'];
    for (const p of requestedPlatforms) {
      if (!valid.includes(p)) {
        console.error(`Invalid platform: ${p}. Valid options: ${valid.join(', ')}`);
        process.exit(1);
      }
    }
  } else {
    // Default: all platforms that have config sections
    requestedPlatforms = [];
    if (config.youtube) requestedPlatforms.push('youtube');
    if (config.tiktok) requestedPlatforms.push('tiktok');
    if (config.instagram) requestedPlatforms.push('instagram');
    if (config.soundcloud) requestedPlatforms.push('soundcloud');
  }

  if (requestedPlatforms.length === 0) {
    console.error('No platforms configured. Add platform sections to your config file.');
    process.exit(1);
  }

  // Check dependencies for requested platforms
  const { ready, skipped } = checkPlatformDependencies(requestedPlatforms);

  if (ready.length === 0) {
    console.error('No platforms have satisfied dependencies. Exiting.');
    process.exit(1);
  }

  if (skipped.length > 0) {
    console.warn(`\nSkipping platforms due to missing dependencies: ${skipped.join(', ')}`);
  }

  await runMassScrape(config, ready, dryRun);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
