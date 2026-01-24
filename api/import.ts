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
  isUnreleased?: boolean;
  remixInfo?: string;
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

async function fetchVideoComments(videoId: string, apiKey: string, maxResults: number = 500): Promise<YouTubeComment[]> {
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
    if (!nextPageToken) break;
  }

  return comments;
}

// Clean text from HTML entities and tags
function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function extractTimestamps(text: string): { timestamp: number; formatted: string; position: number }[] {
  const results: { timestamp: number; formatted: string; position: number }[] = [];
  const cleaned = cleanText(text);

  // Match H:MM:SS or HH:MM:SS
  const longPattern = /\b(\d{1,2}):(\d{2}):(\d{2})\b/g;
  let match;
  while ((match = longPattern.exec(cleaned)) !== null) {
    const seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
    results.push({ timestamp: seconds, formatted: match[0], position: match.index });
  }

  // Match M:SS or MM:SS (but not if part of longer timestamp)
  const shortPattern = /\b(\d{1,2}):(\d{2})\b/g;
  while ((match = shortPattern.exec(cleaned)) !== null) {
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

// Extract extras like (unreleased), [Remix], feat. info
function extractExtras(text: string): { cleanTitle: string; extras: string[] } {
  const extras: string[] = [];
  let cleanTitle = text;

  // Extract parenthetical info like (unreleased), (edit), (VIP)
  const parenMatches = text.match(/\(([^)]+)\)/g);
  if (parenMatches) {
    for (const match of parenMatches) {
      const content = match.slice(1, -1).toLowerCase();
      if (['unreleased', 'edit', 'vip', 'dub', 'remix', 'bootleg', 'rework', 'mashup'].some(k => content.includes(k))) {
        extras.push(match);
        cleanTitle = cleanTitle.replace(match, '').trim();
      }
    }
  }

  // Extract bracket info like [Chris Stussy Remix]
  const bracketMatches = text.match(/\[([^\]]+)\]/g);
  if (bracketMatches) {
    for (const match of bracketMatches) {
      extras.push(match);
      // Don't remove bracket info from title - it's often the remix name
    }
  }

  return { cleanTitle: cleanTitle.trim(), extras };
}

function parseTrackInfo(text: string): { title: string; artist: string; extras?: string[] } | null {
  let cleaned = cleanText(text);

  // Remove leading separators like | or - at the start
  cleaned = cleaned.replace(/^[\s|:\-–—.]+/, '').trim();
  // Remove trailing separators
  cleaned = cleaned.replace(/[\s|:\-–—.]+$/, '').trim();
  // Remove leading numbers like "1." or "01."
  cleaned = cleaned.replace(/^\d{1,2}[.)]\s*/, '').trim();

  // Skip noise terms and garbage
  const noiseTerms = [
    /^\s*tracklist\s*:?\s*$/i,
    /^\s*\d+\.\s*$/,
    /^intro$/i,
    /^outro$/i,
    /^id\s*[-–—]\s*id\s*$/i,  // ID - ID means unknown track
    /^unknown$/i,
    /^tba$/i,
    /^tbc$/i,
    /^\s*$/,
    /^id\?*$/i,                // Just "ID" or "ID?"
    /^track\s*id\?*$/i,        // "track id" or "track id?"
    /^what.*tune/i,            // "what a tune", "what an unreal tune"
    /^tune\?*$/i,              // Just "tune" or "tune?"
    /^crazy/i,                 // Reactions like "crazy, ID"
    /^sheee+z/i,               // "sheeeez"
    /^oo+i+/i,                 // "oooiii"
    /^heate+r+/i,              // "HEATERRRR"
    /^fire$/i,
    /^banger$/i,
    /^absolute/i,
    /^unreal$/i,
    /^insane$/i,
    /^anyone know/i,           // Questions
    /^does anyone/i,
    /^what is this/i,
    /^who knows/i,
    /^need.*id/i,              // "need the ID"
    /^i need/i,
    /^please\s*(id|identify)/i,
    /gotta.*bribe/i,           // Reactions
    /^is\s+unreal/i,
    /^sounds like/i,
    /^whatever he/i,
    /^music is/i,
    /^bumpin/i,
  ];
  for (const noise of noiseTerms) {
    if (noise.test(cleaned)) return null;
  }

  // Skip if mostly emojis (more than 50% emoji characters)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu;
  const emojis = cleaned.match(emojiRegex) || [];
  const nonEmojiLength = cleaned.replace(emojiRegex, '').trim().length;
  if (emojis.length > 0 && nonEmojiLength < 5) return null;
  if (emojis.length > nonEmojiLength / 2) return null;

  // Skip if it looks like a timestamp reference without track info
  if (/^\d+:\d+\s*$/.test(cleaned)) return null;

  // Skip if it ends with just a question mark (likely asking for ID)
  if (/\?\s*$/.test(cleaned) && !cleaned.includes(' - ')) return null;

  // Skip if too short or too long
  if (cleaned.length < 3 || cleaned.length > 200) return null;

  // Extract extras first
  const { cleanTitle, extras } = extractExtras(cleaned);

  // Try different formats:

  // Format: "Title - Artist" (most common in tracklists)
  // Format: "Artist - Title"
  // We'll try to detect which by checking for common patterns
  const dashMatch = cleanTitle.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    let [, part1, part2] = dashMatch;
    part1 = part1.trim();
    part2 = part2.trim();

    // Heuristics to determine which is artist vs title:
    // - If part2 contains (feat.) or (ft.), part1 is likely title
    // - If part1 is shorter and looks like a name, it might be artist
    // - Most tracklist comments use "Title - Artist" format

    // For DJ tracklists, "Title - Artist" is more common
    // So we'll default to that unless part1 looks like it has remix info
    const part1HasRemix = /remix|edit|vip|dub|bootleg/i.test(part1);
    const part2HasRemix = /remix|edit|vip|dub|bootleg/i.test(part2);

    if (part2HasRemix && !part1HasRemix) {
      // Part2 has remix info, so it's likely the title
      return { artist: part1, title: part2, extras };
    } else {
      // Default: assume "Title - Artist" format
      return { title: part1, artist: part2, extras };
    }
  }

  // Format: "Title by Artist"
  const byMatch = cleanTitle.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return { title: byMatch[1].trim(), artist: byMatch[2].trim(), extras };
  }

  // Format: "Artist 'Title'" or 'Artist "Title"'
  const quotedMatch = cleanTitle.match(/^(.+?)\s+["'](.+?)["']$/);
  if (quotedMatch) {
    return { artist: quotedMatch[1].trim(), title: quotedMatch[2].trim(), extras };
  }

  // Format: "'Title' by/- Artist"
  const quotedTitleMatch = cleanTitle.match(/^["'](.+?)["']\s*(?:by|[-–—])\s*(.+)$/i);
  if (quotedTitleMatch) {
    return { title: quotedTitleMatch[1].trim(), artist: quotedTitleMatch[2].trim(), extras };
  }

  // Only return tracks that have a proper separator (Artist - Title or Title by Artist)
  // Don't treat random comment text as tracks
  return null;
}

function parseComments(comments: YouTubeComment[]): ParsedTrack[] {
  const tracks: ParsedTrack[] = [];
  const seenTracks = new Set<string>();

  // Sort comments by likes (higher = more reliable) then by timestamp count (more = likely tracklist)
  const sortedComments = [...comments].sort((a, b) => {
    const aTimestamps = extractTimestamps(a.text).length;
    const bTimestamps = extractTimestamps(b.text).length;
    // Prioritize comments with many timestamps (tracklists)
    if (aTimestamps >= 5 && bTimestamps < 5) return -1;
    if (bTimestamps >= 5 && aTimestamps < 5) return 1;
    // Then by likes
    return b.likeCount - a.likeCount;
  });

  for (const comment of sortedComments) {
    const text = cleanText(comment.text);
    const timestamps = extractTimestamps(text);

    if (timestamps.length === 0) {
      // Try to find track mentions without timestamps
      const trackMention = findTrackMention(text);
      if (trackMention && trackMention.artist !== 'Unknown') {
        const key = `0-${trackMention.artist.toLowerCase()}-${trackMention.title.toLowerCase()}`;
        if (!seenTracks.has(key)) {
          seenTracks.add(key);
          tracks.push({
            timestamp: 0,
            timestampFormatted: '0:00',
            title: trackMention.title,
            artist: trackMention.artist,
            confidence: calculateConfidence(comment, false),
            sourceComment: comment.text,
            sourceAuthor: comment.authorName,
            likes: comment.likeCount,
          });
        }
      }
      continue;
    }

    // For comments with timestamps, try line-by-line parsing first (better for tracklists)
    const lines = text.split(/[\n\r]+/);
    let parsedFromLines = false;

    if (lines.length >= 3) {
      // Likely a tracklist with one track per line
      for (const line of lines) {
        const lineTimestamps = extractTimestamps(line);
        if (lineTimestamps.length === 0) continue;

        const ts = lineTimestamps[0];
        // Get everything after the timestamp on this line
        let afterText = line.slice(ts.position + ts.formatted.length).trim();
        // Remove leading separators (|, -, :, .)
        afterText = afterText.replace(/^[\s|:\-–—.]+/, '').trim();

        const trackInfo = parseTrackInfo(afterText);
        if (trackInfo) {
          parsedFromLines = true;
          const key = `${ts.timestamp}-${trackInfo.artist.toLowerCase()}-${trackInfo.title.toLowerCase()}`;
          if (!seenTracks.has(key)) {
            seenTracks.add(key);
            tracks.push({
              timestamp: ts.timestamp,
              timestampFormatted: ts.formatted,
              title: trackInfo.title,
              artist: trackInfo.artist,
              confidence: calculateConfidence(comment, true, timestamps.length >= 5),
              sourceComment: comment.text,
              sourceAuthor: comment.authorName,
              likes: comment.likeCount,
            });
          }
        }
      }
    }

    // Fallback: parse based on timestamp positions if line-by-line didn't work
    if (!parsedFromLines) {
      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        const nextTs = timestamps[i + 1];
        const startPos = ts.position + ts.formatted.length;
        const endPos = nextTs ? nextTs.position : text.length;
        let afterText = text.slice(startPos, endPos).trim();

        // Handle newlines - only take until the newline
        const newlinePos = afterText.search(/[\n\r]/);
        if (newlinePos > 0) {
          afterText = afterText.slice(0, newlinePos).trim();
        }

        // Remove leading separators
        afterText = afterText.replace(/^[\s|:\-–—.]+/, '').trim();
        // Remove trailing separators
        afterText = afterText.replace(/[\s|:\-–—.]+$/, '').trim();

        const trackInfo = parseTrackInfo(afterText);
        if (trackInfo) {
          const key = `${ts.timestamp}-${trackInfo.artist.toLowerCase()}-${trackInfo.title.toLowerCase()}`;
          if (!seenTracks.has(key)) {
            seenTracks.add(key);
            tracks.push({
              timestamp: ts.timestamp,
              timestampFormatted: ts.formatted,
              title: trackInfo.title,
              artist: trackInfo.artist,
              confidence: calculateConfidence(comment, true, timestamps.length >= 5),
              sourceComment: comment.text,
              sourceAuthor: comment.authorName,
              likes: comment.likeCount,
            });
          }
        }
      }
    }
  }

  return tracks.sort((a, b) => a.timestamp - b.timestamp);
}

// Find track mentions in comments without timestamps
function findTrackMention(text: string): { title: string; artist: string } | null {
  // Look for patterns like "track ID is X - Y" or "this is X by Y"
  const patterns = [
    /(?:track\s*(?:id)?|song|this\s+is|that's|it's)\s*(?:is\s+)?["']?(.+?[-–—].+?)["']?(?:\s*[!.]|$)/i,
    /(?:playing|track|song)\s*[:=]\s*["']?(.+?[-–—].+?)["']?(?:\s*[!.]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseTrackInfo(match[1]);
    }
  }

  return null;
}

// Calculate confidence score for a parsed track
function calculateConfidence(comment: YouTubeComment, hasTimestamp: boolean, isFromTracklist: boolean = false): number {
  let confidence = 0.3;

  if (hasTimestamp) confidence += 0.2;
  if (isFromTracklist) confidence += 0.2;
  if (comment.likeCount > 100) confidence += 0.15;
  else if (comment.likeCount > 50) confidence += 0.1;
  else if (comment.likeCount > 10) confidence += 0.05;

  // Check for credibility indicators in author name
  const author = comment.authorName.toLowerCase();
  if (author.includes('tracklist') || author.includes('trackid')) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1);
}

function parseDescription(description: string): ParsedTrack[] {
  const cleaned = cleanText(description);
  const lines = cleaned.split(/[\n\r]+/);
  const tracks: ParsedTrack[] = [];
  const seenTracks = new Set<string>();

  for (const line of lines) {
    const timestamps = extractTimestamps(line);
    if (timestamps.length > 0) {
      const ts = timestamps[0];
      let afterText = line.slice(ts.position + ts.formatted.length).trim();
      // Remove leading separators
      afterText = afterText.replace(/^[\s|:\-–—.]+/, '').trim();

      const trackInfo = parseTrackInfo(afterText);
      if (trackInfo) {
        const key = `${ts.timestamp}-${trackInfo.artist.toLowerCase()}-${trackInfo.title.toLowerCase()}`;
        if (!seenTracks.has(key)) {
          seenTracks.add(key);

          // Check for unreleased indicator
          const isUnreleased = /unreleased|forthcoming|upcoming/i.test(afterText);
          // Check for remix info
          const remixMatch = afterText.match(/\[([^\]]*remix[^\]]*)\]/i);

          tracks.push({
            timestamp: ts.timestamp,
            timestampFormatted: ts.formatted,
            title: trackInfo.title,
            artist: trackInfo.artist,
            confidence: 0.95, // High confidence for description
            sourceComment: 'Video description',
            sourceAuthor: 'Uploader',
            likes: 0,
            isUnreleased,
            remixInfo: remixMatch ? remixMatch[1] : undefined,
          });
        }
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
      fetchVideoComments(videoId, apiKey, 500),
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
