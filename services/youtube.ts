// YouTube Data API v3 Service
// Requires YOUTUBE_API_KEY environment variable

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: string;
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
