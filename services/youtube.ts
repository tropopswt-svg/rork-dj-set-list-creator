// YouTube Data API v3 Service
// Requires YOUTUBE_API_KEY environment variable

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId?: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: string;
  durationSeconds?: number;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export interface YouTubeComment {
  id: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  likeCount: number;
  publishedAt: string;
}

export interface YouTubeImportResult {
  video: YouTubeVideoInfo;
  comments: YouTubeComment[];
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY;
  if (!key) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }
  return key;
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

export async function fetchVideoInfo(videoId: string): Promise<YouTubeVideoInfo> {
  const apiKey = getApiKey();
  const url = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`YouTube API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    throw new Error('Video not found');
  }

  const video = data.items[0];
  const snippet = video.snippet;
  const contentDetails = video.contentDetails;

  return {
    id: video.id,
    title: snippet.title,
    description: snippet.description,
    channelTitle: snippet.channelTitle,
    publishedAt: snippet.publishedAt,
    thumbnailUrl: snippet.thumbnails?.maxres?.url ||
                  snippet.thumbnails?.high?.url ||
                  snippet.thumbnails?.medium?.url ||
                  snippet.thumbnails?.default?.url,
    duration: contentDetails.duration,
  };
}

export async function fetchVideoComments(
  videoId: string,
  maxResults: number = 500
): Promise<YouTubeComment[]> {
  const apiKey = getApiKey();
  const comments: YouTubeComment[] = [];
  let nextPageToken: string | undefined;

  // Fetch up to maxResults comments (may require multiple pages)
  while (comments.length < maxResults) {
    const pageSize = Math.min(100, maxResults - comments.length);
    let url = `${YOUTUBE_API_BASE}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${pageSize}&order=relevance&key=${apiKey}`;

    if (nextPageToken) {
      url += `&pageToken=${nextPageToken}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      // Comments might be disabled - don't throw, just return what we have
      if (error.error?.errors?.[0]?.reason === 'commentsDisabled') {
        console.warn('Comments are disabled for this video');
        break;
      }
      throw new Error(`YouTube API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      break;
    }

    for (const item of data.items) {
      const comment = item.snippet.topLevelComment.snippet;
      // Use textOriginal (clean text) instead of textDisplay (HTML formatted)
      comments.push({
        id: item.id,
        authorName: comment.authorDisplayName,
        authorAvatar: comment.authorProfileImageUrl,
        text: comment.textOriginal || comment.textDisplay,
        likeCount: comment.likeCount,
        publishedAt: comment.publishedAt,
      });
    }

    nextPageToken = data.nextPageToken;
    if (!nextPageToken) {
      break;
    }
  }

  return comments;
}

// ============================================
// Duration Parsing
// ============================================

/**
 * Parse ISO 8601 duration (e.g., "PT3M45S") to seconds
 */
export function parseDuration(iso8601: string): number {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// ============================================
// YouTube Search API
// ============================================

export interface SearchOptions {
  maxResults?: number;
  publishedAfter?: string; // ISO date
  order?: 'relevance' | 'date' | 'viewCount';
  videoDuration?: 'short' | 'medium' | 'long'; // short <4min, medium 4-20min, long >20min
}

/**
 * Search YouTube for videos matching a query
 */
export async function searchVideos(
  query: string,
  options: SearchOptions = {}
): Promise<YouTubeSearchResult[]> {
  const apiKey = getApiKey();
  const maxResults = Math.min(options.maxResults || 50, 50);

  let url = `${YOUTUBE_API_BASE}/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${apiKey}`;

  if (options.publishedAfter) {
    url += `&publishedAfter=${options.publishedAfter}`;
  }
  if (options.order) {
    url += `&order=${options.order}`;
  }
  if (options.videoDuration) {
    url += `&videoDuration=${options.videoDuration}`;
  }

  const results: YouTubeSearchResult[] = [];
  let nextPageToken: string | undefined;

  // Paginate if we need more than 50 results (though API caps at 50 per page)
  do {
    let pageUrl = url;
    if (nextPageToken) {
      pageUrl += `&pageToken=${nextPageToken}`;
    }

    const response = await fetch(pageUrl);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`YouTube Search API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) break;

    for (const item of data.items) {
      results.push({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl:
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url,
      });
    }

    nextPageToken = data.nextPageToken;
  } while (nextPageToken && results.length < maxResults);

  return results;
}

// ============================================
// Channel Operations
// ============================================

/**
 * Resolve a @handle or channel name to a channel ID
 */
export async function resolveChannelId(handle: string): Promise<string | null> {
  const apiKey = getApiKey();

  // Strip @ prefix if present
  const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;

  // Try forHandle first (works for @handles)
  let url = `${YOUTUBE_API_BASE}/channels?part=id&forHandle=${encodeURIComponent(cleanHandle)}&key=${apiKey}`;
  let response = await fetch(url);

  if (response.ok) {
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].id;
    }
  }

  // Fallback: search for the channel
  url = `${YOUTUBE_API_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1&key=${apiKey}`;
  response = await fetch(url);

  if (response.ok) {
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].snippet.channelId;
    }
  }

  return null;
}

/**
 * Fetch a channel's recent uploads
 */
export async function fetchChannelUploads(
  channelId: string,
  maxResults: number = 30,
  publishedAfter?: string
): Promise<YouTubeSearchResult[]> {
  const apiKey = getApiKey();

  // Use search API scoped to channel (more reliable than playlist approach)
  let url = `${YOUTUBE_API_BASE}/search?part=snippet&type=video&channelId=${channelId}&order=date&maxResults=${Math.min(maxResults, 50)}&key=${apiKey}`;

  if (publishedAfter) {
    url += `&publishedAfter=${publishedAfter}`;
  }

  const results: YouTubeSearchResult[] = [];
  let nextPageToken: string | undefined;

  do {
    let pageUrl = url;
    if (nextPageToken) {
      pageUrl += `&pageToken=${nextPageToken}`;
    }

    const response = await fetch(pageUrl);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`YouTube API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) break;

    for (const item of data.items) {
      results.push({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl:
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url,
      });
    }

    nextPageToken = data.nextPageToken;
  } while (nextPageToken && results.length < maxResults);

  return results.slice(0, maxResults);
}

// ============================================
// Batch Video Details
// ============================================

/**
 * Fetch full video details (including duration, stats) for a batch of video IDs.
 * YouTube API allows up to 50 IDs per request.
 */
export async function fetchVideoDetails(videoIds: string[]): Promise<YouTubeVideoInfo[]> {
  const apiKey = getApiKey();
  const results: YouTubeVideoInfo[] = [];

  // Process in batches of 50
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails,statistics&id=${batch.join(',')}&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`YouTube API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    if (!data.items) continue;

    for (const video of data.items) {
      const snippet = video.snippet;
      const contentDetails = video.contentDetails;
      const statistics = video.statistics;

      results.push({
        id: video.id,
        title: snippet.title,
        description: snippet.description,
        channelTitle: snippet.channelTitle,
        channelId: snippet.channelId,
        publishedAt: snippet.publishedAt,
        thumbnailUrl:
          snippet.thumbnails?.maxres?.url ||
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url,
        duration: contentDetails.duration,
        durationSeconds: parseDuration(contentDetails.duration),
        viewCount: parseInt(statistics?.viewCount || '0', 10),
        likeCount: parseInt(statistics?.likeCount || '0', 10),
        commentCount: parseInt(statistics?.commentCount || '0', 10),
      });
    }
  }

  return results;
}

export async function importFromYouTube(url: string): Promise<YouTubeImportResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  const [video, comments] = await Promise.all([
    fetchVideoInfo(videoId),
    fetchVideoComments(videoId, 200), // Fetch up to 200 comments
  ]);

  return { video, comments };
}
