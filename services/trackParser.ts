// Track Parser - Extracts track IDs and timestamps from comments

import { YouTubeComment } from './youtube';
import { Track } from '@/types';

export interface ParsedTrack {
  timestamp: number; // in seconds
  timestampFormatted: string;
  title: string;
  artist: string;
  confidence: number; // 0-1 score
  sourceComment: string;
  sourceAuthor: string;
  likes: number;
  isUnreleased?: boolean;
  remixInfo?: string;
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

function parseTrackInfo(text: string): { title: string; artist: string; isUnreleased?: boolean } | null {
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

  // Extract unreleased status from the text
  const isUnreleased = /unreleased|forthcoming|upcoming/i.test(cleaned);
  
  // Clean up extra descriptors from the text for parsing
  let cleanedForParsing = cleaned
    .replace(/\s*\(unreleased\)\s*/gi, ' ')
    .replace(/\s*unreleased\s*/gi, ' ')
    .replace(/\s*TRACK OF THE SET\s*/gi, ' ')
    .replace(/\s*🤯+\s*/g, ' ')
    .replace(/\s*🔥+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Try different formats:

  // Format: "Part1 - Part2" (dash separated)
  const dashMatch = cleanedForParsing.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    let [, part1, part2] = dashMatch;
    part1 = part1.trim();
    part2 = part2.trim();

    // Check if part1 looks like remix/production info (not an artist name)
    // Patterns: "Name Remix", "Name Edit", "Name VIP", "Name Bootleg", "Name Dub"
    const remixPattern = /^(.+?)\s+(remix|edit|vip|dub|bootleg|rework|flip|version)$/i;
    const part1RemixMatch = part1.match(remixPattern);
    const part2RemixMatch = part2.match(remixPattern);
    
    // Check if part1 ends with remix-type words
    const part1IsRemixInfo = remixPattern.test(part1);
    // Check if part2 ends with remix-type words  
    const part2IsRemixInfo = remixPattern.test(part2);
    
    // Check if part contains "(Something Remix)" in parentheses
    const part1HasParenRemix = /\([^)]*remix[^)]*\)/i.test(part1);
    const part2HasParenRemix = /\([^)]*remix[^)]*\)/i.test(part2);

    if (part1IsRemixInfo && !part2IsRemixInfo) {
      // Part1 is "Someone Remix" - this is remix info, part2 is the track title
      // Format: "Franky Rizardo Remix - A Little Conversation"
      // Result: title = "A Little Conversation (Franky Rizardo Remix)", artist from remix
      const remixerName = part1RemixMatch ? part1RemixMatch[1].trim() : part1;
      const remixType = part1RemixMatch ? part1RemixMatch[2] : 'Remix';
      return { 
        title: `${part2} (${remixerName} ${remixType})`, 
        artist: remixerName,
        isUnreleased,
      };
    } else if (part2IsRemixInfo && !part1IsRemixInfo) {
      // Part2 is "Someone Remix" - Format: "Track Title - Artist Remix"
      // This is "Artist - Title (Remix)" format
      const remixerName = part2RemixMatch ? part2RemixMatch[1].trim() : part2;
      const remixType = part2RemixMatch ? part2RemixMatch[2] : 'Remix';
      return { 
        title: `${part1} (${remixerName} ${remixType})`, 
        artist: remixerName,
        isUnreleased,
      };
    } else if (part2HasParenRemix) {
      // Part2 has "(Someone Remix)" - Format: "Artist - Title (Remix)"
      return { artist: part1, title: part2, isUnreleased };
    } else if (part1HasParenRemix) {
      // Part1 has "(Someone Remix)" - Less common, treat as title
      return { title: part1, artist: part2, isUnreleased };
    } else {
      // Standard format: Most DJ set tracklists use "Artist - Title"
      // Check for common artist name patterns vs track title patterns
      
      // Heuristics to detect which part is more likely the artist:
      // - Shorter part is often artist
      // - Part with "feat." or "ft." is usually the title side
      // - Part with "&" between words could be artists collaborating
      
      const part1HasFeat = /\b(feat\.?|ft\.?|featuring)\b/i.test(part1);
      const part2HasFeat = /\b(feat\.?|ft\.?|featuring)\b/i.test(part2);
      
      if (part2HasFeat && !part1HasFeat) {
        // "Artist - Title (feat. Someone)" format
        return { artist: part1, title: part2, isUnreleased };
      } else if (part1HasFeat && !part2HasFeat) {
        // "Title (feat. Someone) - Artist" format (rare)
        return { title: part1, artist: part2, isUnreleased };
      }
      
      // Default to "Artist - Title" format (most common in DJ tracklists)
      return { artist: part1, title: part2, isUnreleased };
    }
  }

  // Format: "Title by Artist"
  const byMatch = cleanedForParsing.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return { title: byMatch[1].trim(), artist: byMatch[2].trim(), isUnreleased };
  }

  // Format: "Artist 'Title'" or 'Artist "Title"'
  const quotedMatch = cleanedForParsing.match(/^(.+?)\s+["'](.+?)["']$/);
  if (quotedMatch) {
    return { artist: quotedMatch[1].trim(), title: quotedMatch[2].trim(), isUnreleased };
  }

  // Format: "'Title' by/- Artist"
  const quotedTitleMatch = cleanedForParsing.match(/^["'](.+?)["']\s*(?:by|[-–—])\s*(.+)$/i);
  if (quotedTitleMatch) {
    return { title: quotedTitleMatch[1].trim(), artist: quotedTitleMatch[2].trim(), isUnreleased };
  }

  // Only return tracks that have a proper separator
  // Don't treat random comment text as tracks
  return null;
}

function calculateConfidence(
  comment: YouTubeComment,
  hasTimestamp: boolean,
  isFromTracklist: boolean = false
): number {
  let confidence = 0.3; // Base confidence

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

export function parseComments(comments: YouTubeComment[]): ParsedTrack[] {
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

    if (timestamps.length === 0) continue;

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

            // Check for unreleased indicator (from parseTrackInfo or text)
            const isUnreleased = trackInfo.isUnreleased || /unreleased|forthcoming|upcoming/i.test(afterText);
            // Check for remix info in brackets
            const remixMatch = afterText.match(/\[([^\]]*remix[^\]]*)\]/i);

            tracks.push({
              timestamp: ts.timestamp,
              timestampFormatted: ts.formatted,
              title: trackInfo.title,
              artist: trackInfo.artist,
              confidence: calculateConfidence(comment, true, timestamps.length >= 5),
              sourceComment: comment.text,
              sourceAuthor: comment.authorName,
              likes: comment.likeCount,
              isUnreleased,
              remixInfo: remixMatch ? remixMatch[1] : undefined,
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

            const isUnreleased = trackInfo.isUnreleased || /unreleased|forthcoming|upcoming/i.test(afterText);
            const remixMatch = afterText.match(/\[([^\]]*remix[^\]]*)\]/i);

            tracks.push({
              timestamp: ts.timestamp,
              timestampFormatted: ts.formatted,
              title: trackInfo.title,
              artist: trackInfo.artist,
              confidence: calculateConfidence(comment, true, timestamps.length >= 5),
              sourceComment: comment.text,
              sourceAuthor: comment.authorName,
              likes: comment.likeCount,
              isUnreleased,
              remixInfo: remixMatch ? remixMatch[1] : undefined,
            });
          }
        }
      }
    }
  }

  // Sort by timestamp
  return tracks.sort((a, b) => a.timestamp - b.timestamp);
}

export function parsedTracksToTracks(parsedTracks: ParsedTrack[]): Track[] {
  return parsedTracks.map((pt, index) => ({
    id: `imported-${Date.now()}-${index}`,
    title: pt.title,
    artist: pt.artist,
    duration: 0, // Unknown
    coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
    addedAt: new Date(),
    source: 'ai' as const,
    timestamp: pt.timestamp,
    verified: false,
    contributedBy: pt.sourceAuthor,
    isUnreleased: pt.isUnreleased,
  }));
}

// Parse description for tracklists (many DJ sets have tracklists in description)
export function parseDescription(description: string): ParsedTrack[] {
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

          const isUnreleased = trackInfo.isUnreleased || /unreleased|forthcoming|upcoming/i.test(afterText);
          const remixMatch = afterText.match(/\[([^\]]*remix[^\]]*)\]/i);

          tracks.push({
            timestamp: ts.timestamp,
            timestampFormatted: ts.formatted,
            title: trackInfo.title,
            artist: trackInfo.artist,
            confidence: 0.95, // High confidence for description tracklists
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
