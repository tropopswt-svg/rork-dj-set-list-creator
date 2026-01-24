import type { VercelRequest, VercelResponse } from '@vercel/node';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface YouTubeVideoInfo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: string;
}

interface YouTubeComment {
  id: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  likeCount: number;
  publishedAt: string;
}

interface ParsedTrack {
  timestamp: number;
  timestampFormatted: string;
  title: string;
  artist: string;
  confidence: number;
  sourceComment: string;
  sourceAuthor: string;
  likes: number;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchVideoInfo(videoId: string, apiKey: string): Promise<YouTubeVideoInfo> {
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

async function fetchVideoComments(videoId: string, apiKey: string, maxResults: number = 200): Promise<YouTubeComment[]> {
  const comments: YouTubeComment[] = [];
  let nextPageToken: string | undefined;

  while (comments.length < maxResults) {
    const pageSize = Math.min(100, maxResults - comments.length);
    let url = `${YOUTUBE_API_BASE}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${pageSize}&order=relevance&key=${apiKey}`;

    if (nextPageToken) {
      url += `&pageToken=${nextPageToken}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      if (error.error?.errors?.[0]?.reason === 'commentsDisabled') {
        break;
      }
      throw new Error(`YouTube API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) break;

    for (const item of data.items) {
      const comment = item.snippet.topLevelComment.snippet;
      comments.push({
        id: item.id,
        authorName: comment.authorDisplayName,
        authorAvatar: comment.authorProfileImageUrl,
        text: comment.textDisplay,
        likeCount: comment.likeCount,
        publishedAt: comment.publishedAt,
      });
    }

    nextPageToken = data.nextPageToken;
    if (!nextPageToken) break;
  }

  return comments;
}

function extractTimestamps(text: string): { timestamp: number; formatted: string; position: number }[] {
  const results: { timestamp: number; formatted: string; position: number }[] = [];

  const longPattern = /\b(\d{1,2}):(\d{2}):(\d{2})\b/g;
  let match;
  while ((match = longPattern.exec(text)) !== null) {
    const seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
    results.push({ timestamp: seconds, formatted: match[0], position: match.index });
  }

  const shortPattern = /\b(\d{1,2}):(\d{2})\b/g;
  while ((match = shortPattern.exec(text)) !== null) {
    const isPartOfLonger = results.some(
      r => match!.index >= r.position && match!.index < r.position + r.formatted.length + 3
    );
    if (!isPartOfLonger) {
      const seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
      results.push({ timestamp: seconds, formatted: match[0], position: match.index });
    }
  }

  return results.sort((a, b) => a.position - b.position);
}

function parseTrackInfo(text: string): { title: string; artist: string } | null {
  let cleaned = text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

  const noiseTerms = [/^\s*tracklist\s*$/i, /^\s*\d+\.\s*$/, /^intro$/i, /^outro$/i, /^id\s*$/i, /^unknown$/i];
  for (const noise of noiseTerms) {
    if (noise.test(cleaned)) return null;
  }

  const dashMatch = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    return { artist: dashMatch[1].trim(), title: dashMatch[2].trim() };
  }

  const byMatch = cleaned.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return { title: byMatch[1].trim(), artist: byMatch[2].trim() };
  }

  if (cleaned.length > 3 && cleaned.length < 100) {
    return { artist: 'Unknown', title: cleaned };
  }

  return null;
}

function parseComments(comments: YouTubeComment[]): ParsedTrack[] {
  const tracks: ParsedTrack[] = [];
  const seenTracks = new Set<string>();

  for (const comment of comments) {
    const text = comment.text;
    const timestamps = extractTimestamps(text);

    if (timestamps.length === 0) continue;

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const nextTs = timestamps[i + 1];
      const startPos = ts.position + ts.formatted.length;
      const endPos = nextTs ? nextTs.position : text.length;
      const afterText = text.slice(startPos, endPos).trim();
      const cleanedText = afterText.replace(/^[\s:.\-–—]+/, '').replace(/[\s:.\-–—]+$/, '').trim();

      const trackInfo = parseTrackInfo(cleanedText);
      if (trackInfo) {
        const key = `${ts.timestamp}-${trackInfo.artist.toLowerCase()}-${trackInfo.title.toLowerCase()}`;
        if (!seenTracks.has(key)) {
          seenTracks.add(key);

          let confidence = 0.3;
          if (comment.likeCount > 100) confidence += 0.2;
          else if (comment.likeCount > 10) confidence += 0.1;
          if (trackInfo.artist !== 'Unknown') confidence += 0.15;

          tracks.push({
            timestamp: ts.timestamp,
            timestampFormatted: ts.formatted,
            ...trackInfo,
            confidence: Math.min(confidence + 0.2, 1),
            sourceComment: text,
            sourceAuthor: comment.authorName,
            likes: comment.likeCount,
          });
        }
      }
    }
  }

  return tracks.sort((a, b) => a.timestamp - b.timestamp);
}

function parseDescription(description: string): ParsedTrack[] {
  const lines = description.split('\n');
  const tracks: ParsedTrack[] = [];

  for (const line of lines) {
    const timestamps = extractTimestamps(line);
    if (timestamps.length > 0) {
      const ts = timestamps[0];
      const afterText = line.slice(ts.position + ts.formatted.length).trim();
      const cleanedText = afterText.replace(/^[\s:.\-–—]+/, '').trim();
      const trackInfo = parseTrackInfo(cleanedText);

      if (trackInfo) {
        tracks.push({
          timestamp: ts.timestamp,
          timestampFormatted: ts.formatted,
          ...trackInfo,
          confidence: 0.9,
          sourceComment: 'Video description',
          sourceAuthor: 'Uploader',
          likes: 0,
        });
      }
    }
  }

  return tracks;
}

function parseArtistFromTitle(title: string): { name: string; artist: string } {
  const patterns = [
    /^(.+?)\s*[@|]\s*(.+)$/,
    /^(.+?)\s*[-–—]\s*(.+)$/,
    /^(.+?)\s+(?:live\s+)?(?:at|@)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return { artist: match[1].trim(), name: title };
    }
  }

  return { name: title, artist: 'Unknown Artist' };
}

function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || '0') * 3600 + parseInt(match[2] || '0') * 60 + parseInt(match[3] || '0');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'YouTube API key not configured' });
  }

  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const [video, comments] = await Promise.all([
      fetchVideoInfo(videoId, apiKey),
      fetchVideoComments(videoId, apiKey, 200),
    ]);

    const descriptionTracks = parseDescription(video.description);
    const commentTracks = parseComments(comments);

    // Merge tracks
    const merged = new Map<number, ParsedTrack>();
    for (const track of descriptionTracks) {
      merged.set(track.timestamp, track);
    }
    for (const track of commentTracks) {
      const existingTs = Array.from(merged.keys()).find(ts => Math.abs(ts - track.timestamp) < 30);
      if (!existingTs) {
        merged.set(track.timestamp, track);
      }
    }

    const tracks = Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
    const { name, artist } = parseArtistFromTitle(video.title);

    const setList = {
      id: `yt-${video.id}-${Date.now()}`,
      name,
      artist: artist !== 'Unknown Artist' ? artist : video.channelTitle,
      date: video.publishedAt,
      tracks: tracks.map((pt, index) => ({
        id: `imported-${Date.now()}-${index}`,
        title: pt.title,
        artist: pt.artist,
        duration: 0,
        coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
        addedAt: new Date().toISOString(),
        source: 'ai',
        timestamp: pt.timestamp,
        verified: false,
        contributedBy: pt.sourceAuthor,
      })),
      coverUrl: video.thumbnailUrl,
      sourceLinks: [{ platform: 'youtube', url }],
      totalDuration: parseDuration(video.duration),
      aiProcessed: true,
      commentsScraped: comments.length,
      tracksIdentified: tracks.length,
      plays: 0,
    };

    return res.status(200).json({
      success: true,
      setList,
      videoInfo: video,
      commentsCount: comments.length,
      tracksCount: tracks.length,
    });

  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Import failed',
    });
  }
}
