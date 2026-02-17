/**
 * Apify REST API Client
 *
 * Handles running TikTok and Instagram scrapers via Apify actors.
 * Apify handles anti-detection, rate limits, and proxy rotation.
 *
 * Actors used:
 * - TikTok: clockworks/free-tiktok-scraper (or apify/tiktok-scraper)
 * - Instagram: apify/instagram-scraper (or apify/instagram-profile-scraper)
 */

// Configuration
const getApifyConfig = () => {
  const token = process.env.APIFY_API_TOKEN;
  return {
    token,
    baseUrl: 'https://api.apify.com/v2',
  };
};

// Types
export interface ApifyActorRun {
  id: string;
  actId: string;
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT';
  startedAt: string;
  finishedAt?: string;
  defaultDatasetId: string;
}

export interface TikTokVideo {
  id: string;
  desc: string;
  createTime: number;
  video: {
    duration: number;
    playAddr?: string;
    downloadAddr?: string;
  };
  author: {
    uniqueId: string;
    nickname: string;
  };
  stats: {
    playCount: number;
    commentCount: number;
    shareCount: number;
  };
  comments?: TikTokComment[];
  webVideoUrl?: string;
}

export interface TikTokComment {
  cid: string;
  text: string;
  createTime: number;
  user: {
    uniqueId: string;
    nickname: string;
  };
  replyCommentTotal?: number;
  replies?: TikTokComment[];
}

export interface InstagramPost {
  id: string;
  shortCode: string;
  type: 'Image' | 'Video' | 'Sidecar';
  caption?: string;
  timestamp: string;
  videoUrl?: string;
  displayUrl?: string;
  videoDuration?: number;
  ownerUsername: string;
  ownerFullName?: string;
  likesCount?: number;
  commentsCount?: number;
  comments?: InstagramComment[];
  url: string;
}

export interface InstagramComment {
  id: string;
  text: string;
  timestamp: string;
  ownerUsername: string;
  replies?: InstagramComment[];
}

export interface TikTokScraperOptions {
  maxVideos?: number;
  maxComments?: number;
  includeComments?: boolean;
  oldestVideoDate?: string; // ISO date string
}

export interface InstagramScraperOptions {
  maxPosts?: number;
  maxComments?: number;
  includeComments?: boolean;
  resultsType?: 'posts' | 'reels' | 'stories';
  oldestPostDate?: string;
}

export interface TikTokHashtagSearchOptions {
  maxVideos?: number;
  includeComments?: boolean;
  maxComments?: number;
}

export interface InstagramHashtagSearchOptions {
  maxPosts?: number;
  includeComments?: boolean;
  maxComments?: number;
}

/**
 * Check if Apify is configured
 */
export function isApifyConfigured(): boolean {
  const config = getApifyConfig();
  return Boolean(config.token);
}

/**
 * Make authenticated request to Apify API
 */
async function apifyRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const config = getApifyConfig();

  if (!config.token) {
    throw new Error('APIFY_API_TOKEN not configured');
  }

  const url = `${config.baseUrl}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apify API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Run TikTok profile scraper
 *
 * Uses clockworks/free-tiktok-scraper or apify/tiktok-scraper
 */
export async function runTikTokProfileScraper(
  username: string,
  options: TikTokScraperOptions = {}
): Promise<ApifyActorRun> {
  // Clean username (remove @ if present)
  const cleanUsername = username.replace(/^@/, '');

  // Actor input configuration - enable comments by default
  const includeComments = options.includeComments !== false;
  const input = {
    profiles: [`https://www.tiktok.com/@${cleanUsername}`],
    resultsPerPage: options.maxVideos || 30,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    // Comment settings - try multiple param names for compatibility
    fetchComments: includeComments,
    commentsPerPost: includeComments ? (options.maxComments || 100) : 0,
    maxComments: includeComments ? (options.maxComments || 100) : 0,
    includeComments: includeComments,
  };

  console.log(`[Apify] Starting TikTok scraper for @${cleanUsername}`);

  // Run the actor
  // Try free scraper first, fall back to official if needed
  const actorId = 'clockworks~free-tiktok-scraper';

  const result = await apifyRequest<{ data: ApifyActorRun }>(
    `/acts/${actorId}/runs`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );

  console.log(`[Apify] TikTok scraper started: ${result.data.id}`);
  return result.data;
}

/**
 * Run Instagram profile scraper
 *
 * Uses apify/instagram-scraper or apify/instagram-profile-scraper
 */
export async function runInstagramProfileScraper(
  username: string,
  options: InstagramScraperOptions = {}
): Promise<ApifyActorRun> {
  // Clean username (remove @ if present)
  const cleanUsername = username.replace(/^@/, '');

  // Actor input configuration
  const input = {
    directUrls: [`https://www.instagram.com/${cleanUsername}/`],
    resultsType: options.resultsType || 'posts',
    resultsLimit: options.maxPosts || 30,
    addParentData: true,
    ...(options.includeComments && {
      scrapeComments: true,
      maxComments: options.maxComments || 50,
    }),
  };

  console.log(`[Apify] Starting Instagram scraper for @${cleanUsername}`);

  // Run the actor
  const actorId = 'apify~instagram-scraper';

  const result = await apifyRequest<{ data: ApifyActorRun }>(
    `/acts/${actorId}/runs`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );

  console.log(`[Apify] Instagram scraper started: ${result.data.id}`);
  return result.data;
}

/**
 * Get actor run status
 */
export async function getActorRunStatus(runId: string): Promise<ApifyActorRun> {
  const result = await apifyRequest<{ data: ApifyActorRun }>(
    `/actor-runs/${runId}`
  );
  return result.data;
}

/**
 * Wait for actor run to complete
 */
export async function waitForActorCompletion(
  runId: string,
  options: {
    pollIntervalMs?: number;
    timeoutMs?: number;
    onProgress?: (status: string) => void;
  } = {}
): Promise<ApifyActorRun> {
  const pollInterval = options.pollIntervalMs || 5000;
  const timeout = options.timeoutMs || 600000; // 10 minutes default
  const startTime = Date.now();

  while (true) {
    const run = await getActorRunStatus(runId);

    if (options.onProgress) {
      options.onProgress(run.status);
    }

    if (run.status === 'SUCCEEDED') {
      console.log(`[Apify] Run ${runId} completed successfully`);
      return run;
    }

    if (run.status === 'FAILED' || run.status === 'ABORTED' || run.status === 'TIMED-OUT') {
      throw new Error(`Actor run failed with status: ${run.status}`);
    }

    if (Date.now() - startTime > timeout) {
      throw new Error(`Actor run timed out after ${timeout}ms`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
}

/**
 * Get results from completed actor run
 */
export async function getActorRunResults<T>(
  runId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<T[]> {
  const run = await getActorRunStatus(runId);

  if (run.status !== 'SUCCEEDED') {
    throw new Error(`Cannot get results: run status is ${run.status}`);
  }

  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const result = await apifyRequest<T[]>(
    `/datasets/${run.defaultDatasetId}/items${queryString}`
  );

  return result;
}

/**
 * Convenience: Run TikTok scraper and wait for results
 */
export async function scrapeTikTokProfile(
  username: string,
  options: TikTokScraperOptions = {}
): Promise<TikTokVideo[]> {
  const run = await runTikTokProfileScraper(username, options);
  await waitForActorCompletion(run.id, {
    onProgress: (status) => console.log(`[Apify] TikTok scraper status: ${status}`),
  });
  return getActorRunResults<TikTokVideo>(run.id);
}

/**
 * Convenience: Run Instagram scraper and wait for results
 */
export async function scrapeInstagramProfile(
  username: string,
  options: InstagramScraperOptions = {}
): Promise<InstagramPost[]> {
  const run = await runInstagramProfileScraper(username, options);
  await waitForActorCompletion(run.id, {
    onProgress: (status) => console.log(`[Apify] Instagram scraper status: ${status}`),
  });
  return getActorRunResults<InstagramPost>(run.id);
}

/**
 * Test Apify connection
 */
export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  accountInfo?: {
    username: string;
    email: string;
    plan: string;
    usageUsd: number;
  };
}> {
  if (!isApifyConfigured()) {
    return {
      success: false,
      message: 'APIFY_API_TOKEN not configured in environment',
    };
  }

  try {
    const result = await apifyRequest<{
      data: {
        username: string;
        email: string;
        plan: { id: string };
        currentBillingPeriod?: { usageTotalUsd?: number };
      };
    }>('/users/me');

    return {
      success: true,
      message: 'Connected to Apify successfully',
      accountInfo: {
        username: result.data.username,
        email: result.data.email,
        plan: result.data.plan?.id || 'unknown',
        usageUsd: result.data.currentBillingPeriod?.usageTotalUsd || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Hashtag Search — TikTok
// ============================================

/**
 * Run TikTok hashtag search
 *
 * Uses the same clockworks/free-tiktok-scraper actor with hashtag URLs
 */
export async function runTikTokHashtagSearch(
  hashtag: string,
  options: TikTokHashtagSearchOptions = {}
): Promise<ApifyActorRun> {
  // Clean hashtag (remove # if present)
  const cleanHashtag = hashtag.replace(/^#/, '');

  const includeComments = options.includeComments ?? false;
  const input = {
    hashtags: [`https://www.tiktok.com/tag/${cleanHashtag}`],
    resultsPerPage: options.maxVideos || 50,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    fetchComments: includeComments,
    commentsPerPost: includeComments ? (options.maxComments || 50) : 0,
    maxComments: includeComments ? (options.maxComments || 50) : 0,
    includeComments: includeComments,
  };

  console.log(`[Apify] Starting TikTok hashtag search for #${cleanHashtag}`);

  const actorId = 'clockworks~free-tiktok-scraper';

  const result = await apifyRequest<{ data: ApifyActorRun }>(
    `/acts/${actorId}/runs`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );

  console.log(`[Apify] TikTok hashtag search started: ${result.data.id}`);
  return result.data;
}

/**
 * Convenience: Search TikTok hashtag and wait for results
 */
export async function searchTikTokHashtag(
  hashtag: string,
  options: TikTokHashtagSearchOptions = {}
): Promise<TikTokVideo[]> {
  const run = await runTikTokHashtagSearch(hashtag, options);
  await waitForActorCompletion(run.id, {
    onProgress: (status) => console.log(`[Apify] TikTok hashtag search status: ${status}`),
  });
  return getActorRunResults<TikTokVideo>(run.id);
}

// ============================================
// Hashtag Search — Instagram
// ============================================

/**
 * Run Instagram hashtag search
 *
 * Uses apify/instagram-scraper with explore/tags URL
 */
export async function runInstagramHashtagSearch(
  hashtag: string,
  options: InstagramHashtagSearchOptions = {}
): Promise<ApifyActorRun> {
  // Clean hashtag (remove # if present)
  const cleanHashtag = hashtag.replace(/^#/, '');

  const input = {
    directUrls: [`https://www.instagram.com/explore/tags/${cleanHashtag}/`],
    resultsType: 'posts',
    resultsLimit: options.maxPosts || 50,
    addParentData: true,
    ...(options.includeComments && {
      scrapeComments: true,
      maxComments: options.maxComments || 50,
    }),
  };

  console.log(`[Apify] Starting Instagram hashtag search for #${cleanHashtag}`);

  const actorId = 'apify~instagram-scraper';

  const result = await apifyRequest<{ data: ApifyActorRun }>(
    `/acts/${actorId}/runs`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );

  console.log(`[Apify] Instagram hashtag search started: ${result.data.id}`);
  return result.data;
}

/**
 * Convenience: Search Instagram hashtag and wait for results
 */
export async function searchInstagramHashtag(
  hashtag: string,
  options: InstagramHashtagSearchOptions = {}
): Promise<InstagramPost[]> {
  const run = await runInstagramHashtagSearch(hashtag, options);
  await waitForActorCompletion(run.id, {
    onProgress: (status) => console.log(`[Apify] Instagram hashtag search status: ${status}`),
  });
  return getActorRunResults<InstagramPost>(run.id);
}

export default {
  isApifyConfigured,
  testConnection,
  runTikTokProfileScraper,
  runInstagramProfileScraper,
  runTikTokHashtagSearch,
  runInstagramHashtagSearch,
  getActorRunStatus,
  waitForActorCompletion,
  getActorRunResults,
  scrapeTikTokProfile,
  scrapeInstagramProfile,
  searchTikTokHashtag,
  searchInstagramHashtag,
};
