// Test the new parsing logic against actual YouTube comments
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyD_MwrdayiDIhEXkdvvhSCIrDUlz5iQZos';
const VIDEO_URL = process.argv[2] || 'https://youtu.be/IvMPAe3oPn0';

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

async function fetchVideoComments(videoId: string, maxResults: number = 500): Promise<YouTubeComment[]> {
  const comments: YouTubeComment[] = [];
  let nextPageToken: string | undefined;

  while (comments.length < maxResults) {
    const pageSize = Math.min(100, maxResults - comments.length);
    let url = `${YOUTUBE_API_BASE}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${pageSize}&order=relevance&key=${API_KEY}`;
    if (nextPageToken) url += `&pageToken=${nextPageToken}`;

    const response = await fetch(url);
    if (!response.ok) break;

    const data = await response.json();
    if (!data.items || data.items.length === 0) break;

    for (const item of data.items) {
      const comment = item.snippet.topLevelComment.snippet;
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

// NEW PARSING LOGIC (with improved filtering)
function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
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

  const longPattern = /\b(\d{1,2}):(\d{2}):(\d{2})\b/g;
  let match;
  while ((match = longPattern.exec(cleaned)) !== null) {
    const seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
    results.push({ timestamp: seconds, formatted: match[0], position: match.index });
  }

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

function parseTrackInfo(text: string): { title: string; artist: string } | null {
  let cleaned = cleanText(text);
  cleaned = cleaned.replace(/^[\s|:\-–—.]+/, '').trim();
  cleaned = cleaned.replace(/[\s|:\-–—.]+$/, '').trim();
  cleaned = cleaned.replace(/^\d{1,2}[.)]\s*/, '').trim();

  // Skip noise terms and garbage
  const noiseTerms = [
    /^\s*tracklist\s*:?\s*$/i,
    /^\s*\d+\.\s*$/,
    /^intro$/i,
    /^outro$/i,
    /^id\s*[-–—]\s*id\s*$/i,
    /^unknown$/i,
    /^tba$/i,
    /^tbc$/i,
    /^\s*$/,
    /^id\?*$/i,
    /^track\s*id\?*$/i,
    /^what.*tune/i,
    /^tune\?*$/i,
    /^crazy/i,
    /^sheee+z/i,
    /^oo+i+/i,
    /^heate+r+/i,
    /^fire$/i,
    /^banger$/i,
    /^absolute/i,
    /^unreal$/i,
    /^insane$/i,
    /^anyone know/i,
    /^does anyone/i,
    /^what is this/i,
    /^who knows/i,
    /^need.*id/i,
    /^i need/i,
    /^please\s*(id|identify)/i,
    /gotta.*bribe/i,
    /^is\s+unreal/i,
    /^sounds like/i,
    /^whatever he/i,
    /^music is/i,
  ];
  for (const noise of noiseTerms) {
    if (noise.test(cleaned)) return null;
  }

  // Skip if mostly emojis
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu;
  const emojis = cleaned.match(emojiRegex) || [];
  const nonEmojiLength = cleaned.replace(emojiRegex, '').trim().length;
  if (emojis.length > 0 && nonEmojiLength < 5) return null;
  if (emojis.length > nonEmojiLength / 2) return null;

  // Skip if it looks like a timestamp reference without track info
  if (/^\d+:\d+\s*$/.test(cleaned)) return null;

  // Skip if it ends with just a question mark (likely asking for ID)
  if (/\?\s*$/.test(cleaned) && !cleaned.includes(' - ')) return null;

  if (cleaned.length < 3 || cleaned.length > 200) return null;

  const dashMatch = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    let [, part1, part2] = dashMatch;
    part1 = part1.trim();
    part2 = part2.trim();
    const part1HasRemix = /remix|edit|vip|dub|bootleg/i.test(part1);
    const part2HasRemix = /remix|edit|vip|dub|bootleg/i.test(part2);
    if (part2HasRemix && !part1HasRemix) {
      return { artist: part1, title: part2 };
    } else {
      return { title: part1, artist: part2 };
    }
  }

  const byMatch = cleaned.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return { title: byMatch[1].trim(), artist: byMatch[2].trim() };
  }

  // Only return unknown artist if it has a dash separator or looks like a real title
  // Don't return random comment text as tracks
  return null;
}

function calculateConfidence(comment: YouTubeComment, hasTimestamp: boolean, isFromTracklist: boolean = false): number {
  let confidence = 0.3;
  if (hasTimestamp) confidence += 0.2;
  if (isFromTracklist) confidence += 0.2;
  if (comment.likeCount > 100) confidence += 0.15;
  else if (comment.likeCount > 50) confidence += 0.1;
  else if (comment.likeCount > 10) confidence += 0.05;
  const author = comment.authorName.toLowerCase();
  if (author.includes('tracklist') || author.includes('trackid')) confidence += 0.1;
  return Math.min(confidence, 1);
}

function parseComments(comments: YouTubeComment[]): ParsedTrack[] {
  const tracks: ParsedTrack[] = [];
  const seenTracks = new Set<string>();

  const sortedComments = [...comments].sort((a, b) => {
    const aTimestamps = extractTimestamps(a.text).length;
    const bTimestamps = extractTimestamps(b.text).length;
    if (aTimestamps >= 5 && bTimestamps < 5) return -1;
    if (bTimestamps >= 5 && aTimestamps < 5) return 1;
    return b.likeCount - a.likeCount;
  });

  for (const comment of sortedComments) {
    const text = cleanText(comment.text);
    const timestamps = extractTimestamps(text);

    if (timestamps.length === 0) continue;

    const lines = text.split(/[\n\r]+/);
    let parsedFromLines = false;

    if (lines.length >= 3) {
      for (const line of lines) {
        const lineTimestamps = extractTimestamps(line);
        if (lineTimestamps.length === 0) continue;

        const ts = lineTimestamps[0];
        let afterText = line.slice(ts.position + ts.formatted.length).trim();
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
              sourceAuthor: comment.authorName,
              likes: comment.likeCount,
            });
          }
        }
      }
    }

    if (!parsedFromLines) {
      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        const nextTs = timestamps[i + 1];
        const startPos = ts.position + ts.formatted.length;
        const endPos = nextTs ? nextTs.position : text.length;
        let afterText = text.slice(startPos, endPos).trim();
        const newlinePos = afterText.search(/[\n\r]/);
        if (newlinePos > 0) afterText = afterText.slice(0, newlinePos).trim();
        afterText = afterText.replace(/^[\s|:\-–—.]+/, '').trim();
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

async function main() {
  const videoId = extractVideoId(VIDEO_URL);
  if (!videoId) {
    console.error('Invalid YouTube URL');
    process.exit(1);
  }

  console.log(`\n=== Testing new parser on video: ${videoId} ===\n`);

  const comments = await fetchVideoComments(videoId, 300);
  console.log(`Fetched ${comments.length} comments\n`);

  const tracks = parseComments(comments);

  console.log(`=== PARSED TRACKS (${tracks.length} found) ===\n`);

  for (const track of tracks) {
    const unreleased = track.title.toLowerCase().includes('unreleased') ||
                       track.artist.toLowerCase().includes('unreleased') ? ' [UNRELEASED]' : '';
    console.log(`${track.timestampFormatted.padEnd(8)} | ${track.title} - ${track.artist}${unreleased}`);
    console.log(`         | Confidence: ${(track.confidence * 100).toFixed(0)}% | Source: ${track.sourceAuthor} (${track.likes} likes)`);
    console.log('');
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total comments: ${comments.length}`);
  console.log(`Tracks parsed: ${tracks.length}`);
  console.log(`High confidence (>70%): ${tracks.filter(t => t.confidence > 0.7).length}`);
  console.log(`With known artist: ${tracks.filter(t => t.artist !== 'Unknown').length}`);
}

main().catch(console.error);
