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

// Validate that a string looks like a valid track title or artist name
function isValidTrackPart(str: string): boolean {
  if (!str || str.length < 3) return false;
  if (str.length > 100) return false;

  // Reject if it's mostly numbers or special characters
  const alphaCount = (str.match(/[a-zA-Z]/g) || []).length;
  if (alphaCount < 2) return false;

  // Reject common non-track patterns
  const invalidPatterns = [
    /^https?:/i,
    /^www\./i,
    /^listen\s+to/i,
    /^check\s+(out|it)/i,
    /^i\s+(remember|love|need|think)/i,
    /^(this|that|it)\s+(is|was)/i,
    /^not\s+sure/i,
    /^anyone/i,
    /^what\s+(is|was)/i,
    /^(so|very|really|fucking)\s+(good|fire|sick)/i,
    /^(amazing|incredible|insane|crazy|unreal)$/i,
    /starting\s+at/i,
    /\d{4}$/,  // Ends with a year (likely a comment about an event)
    /^\w*\s*\d{1,2}[/\-]\d{1,2}\s*$/,  // Date patterns like "Stussy 11/10", "EDC 01-20" (event refs)
    /^(set|mix|live|vibes?|tune|song|track)$/i,  // Single generic music words
    /^(man|bro|mate|dude|lol|omg|wow)$/i,        // Reactions/filler
    /^(yes|no|yeah|nah|yep|nope)$/i,             // Affirmatives
    /^(here|there|now|then|just|only)$/i,         // Adverbs alone
    /^\d+$/,                                       // Pure numbers
    // Sentence-like text (comment garbage, not track names)
    /\.\s+[A-Z]/,                                  // Period followed by capital letter (mid-sentence)
    /^(and it|but it|there have|there are|there is)\s/i, // Starts with sentence openers
    /\b(plenty of|hundreds of|time for|from many)\b/i,   // Multi-word sentence fragments
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(str)) return false;
  }

  return true;
}

function parseTrackInfo(text: string): { title: string; artist: string; isUnreleased?: boolean } | null {
  let cleaned = cleanText(text);

  // Remove leading separators like | or - at the start
  cleaned = cleaned.replace(/^[\s|:\-–—.\[\]()]+/, '').trim();
  // Remove trailing separators
  cleaned = cleaned.replace(/[\s|:\-–—.\[\]()]+$/, '').trim();
  // Remove leading numbers like "1." or "01."
  cleaned = cleaned.replace(/^\d{1,2}[.)]\s*/, '').trim();

  // STRICT FILTERING - Reject obvious garbage

  // Reject URLs
  if (/https?:\/\/|www\.|\.com|\.org|soundcloud\.com|youtube\.com|youtu\.be|spotify\.com|music\.apple/i.test(cleaned)) {
    return null;
  }

  // Reject URL fragments (video IDs, query params)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(cleaned) || /[?&=]/.test(cleaned) || /watch\?v=/i.test(cleaned)) {
    return null;
  }

  // Reject user reactions and comments (not track names)
  const reactionPatterns = [
    /^love\s*(it|this|that)?!*$/i,
    /^fuck(ing)?\s*(love|loved|amazing)/i,
    /^(this|that)\s*(is|was)\s*(so|the|a|an)?\s*(good|great|amazing|fire|sick|insane)/i,
    /^i\s+remember/i,
    /^i\s+(love|loved|like|liked|need)/i,
    /^(so|very|really)\s+(good|fire|sick)/i,
    /^not\s+sure\s+what/i,
    /^anyone\s+(know|got|have)/i,
    /^what\s+(is|was)\s+(this|that)/i,
    /^can\s+(someone|anyone)/i,
    /^(absolute|total)\s+(banger|fire|heater)/i,
    /^(banger|fire|heater|sick|insane|crazy|unreal|amazing|incredible)!*$/i,
    /^ooph/i,
    /^grimy/i,
    /^dark$/i,
    /^(the|this|that)\s+\w+\s+is\s+(the|a)/i,  // "the X is the Y" pattern
    /^listen\s+to/i,
    /starting\s+at\s+\w+\s+\d+/i,  // "starting at edco 2024"
    /^(man|dude|bro|mate),?\s/i,
    /^no\s+(doubt|way|cap)/i,
    /^(big|huge|massive)\s+(tune|track|banger|one)/i,
    /^(such|what)\s+a\s+(tune|set|mix|banger|track)/i,
    /^(need|want|give)\s+(this|that|the)\s/i,
    /^(my|the)\s+(favourite|favorite|fav)\s/i,
    /^(played|playing|plays)\s+(this|that|it)\s/i,
  ];

  for (const pattern of reactionPatterns) {
    if (pattern.test(cleaned)) return null;
  }

  // Reject short text with date patterns (event references like "Stussy 11/10", "EDC 01-20")
  if (/\b\d{1,2}[/\-]\d{1,2}\b/.test(cleaned) && cleaned.split(/\s+/).length <= 3) {
    return null;
  }

  // Reject ID/unknown tracks
  const idPatterns = [
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
    /\(id\)$/i,  // Ends with (ID)
    /\bid\b.*\bid\b/i,  // Contains "ID" multiple times
    /^id\s*$/i,
  ];

  for (const noise of idPatterns) {
    if (noise.test(cleaned)) return null;
  }

  // Reject text with unbalanced parentheses (broken parsing)
  const openParens = (cleaned.match(/\(/g) || []).length;
  const closeParens = (cleaned.match(/\)/g) || []).length;
  if (Math.abs(openParens - closeParens) > 1) return null;

  // Reject if it starts or ends with a broken parenthesis pattern
  if (/^\)/.test(cleaned) || /\($/.test(cleaned)) return null;

  // Skip if mostly emojis (more than 50% emoji characters)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu;
  const emojis = cleaned.match(emojiRegex) || [];
  const nonEmojiLength = cleaned.replace(emojiRegex, '').trim().length;
  if (emojis.length > 0 && nonEmojiLength < 5) return null;

  // Skip if it looks like a timestamp reference without track info
  if (/^\d+:\d+\s*$/.test(cleaned)) return null;

  // Skip if it ends with just a question mark (likely asking for ID)
  if (/\?\s*$/.test(cleaned) && !cleaned.includes(' - ')) return null;

  // Skip if too short or too long
  if (cleaned.length < 3 || cleaned.length > 200) return null;

  // Remove any stray timestamps that might be embedded in the text
  cleaned = cleaned.replace(/\d{1,2}:\d{2}(:\d{2})?\s*/g, '').trim();

  // Extract unreleased status from the text
  const isUnreleased = /unreleased|forthcoming|upcoming|dubplate|white\s*label/i.test(cleaned);

  // Clean up extra descriptors from the text for parsing
  // Strip ALL unreleased indicator variants so they don't end up in the title
  let cleanedForParsing = cleaned
    .replace(/\s*\(?\s*unreleased\s*\??\s*\)?\s*/gi, ' ')
    .replace(/\s*\(?\s*forthcoming\s*\)?\s*/gi, ' ')
    .replace(/\s*\(\s*dub\s*\??\s*\)\s*/gi, ' ')
    .replace(/\s*\(?\s*dubplate\s*\)?\s*/gi, ' ')
    .replace(/\s*\(?\s*white\s*label\s*\)?\s*/gi, ' ')
    .replace(/\s*\(\s*VIP\s*\)\s*/gi, ' ')
    .replace(/\s*TRACK OF THE SET\s*/gi, ' ')
    .replace(/\s*🤯+\s*/g, ' ')
    .replace(/\s*🔥+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\(\s*$/, '').replace(/^\s*\)/, '').trim();

  // Common single words that are not track titles or artist names
  const commonWords = new Set([
    'the', 'this', 'that', 'what', 'when', 'where', 'which', 'who', 'how',
    'set', 'mix', 'live', 'here', 'best', 'vibes', 'good', 'great', 'nice',
    'tune', 'song', 'track', 'music', 'sound', 'yeah', 'yes', 'wow', 'omg',
  ]);

  // Try different formats:

  // Format: "Part1 - Part2" (dash separated)
  const dashMatch = cleanedForParsing.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    let [, part1, part2] = dashMatch;
    part1 = part1.trim();
    part2 = part2.trim();

    // Validate both parts look like real track/artist info
    if (!isValidTrackPart(part1) || !isValidTrackPart(part2)) return null;

    // Reject if either part is a common English word (not a real artist/title)
    const p1Lower = part1.toLowerCase().trim();
    const p2Lower = part2.toLowerCase().trim();
    if (commonWords.has(p1Lower) || commonWords.has(p2Lower)) return null;

    // Reject if artist and title are the same text (parsing error)
    if (p1Lower === p2Lower) return null;

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
      const remixerName = part1RemixMatch ? part1RemixMatch[1].trim() : part1;
      const remixType = part1RemixMatch ? part1RemixMatch[2] : 'Remix';
      return {
        title: `${part2} (${remixerName} ${remixType})`,
        artist: remixerName,
        isUnreleased,
      };
    } else if (part2IsRemixInfo && !part1IsRemixInfo) {
      const remixerName = part2RemixMatch ? part2RemixMatch[1].trim() : part2;
      const remixType = part2RemixMatch ? part2RemixMatch[2] : 'Remix';
      return {
        title: `${part1} (${remixerName} ${remixType})`,
        artist: remixerName,
        isUnreleased,
      };
    } else if (part2HasParenRemix) {
      return { artist: part1, title: part2, isUnreleased };
    } else if (part1HasParenRemix) {
      return { title: part1, artist: part2, isUnreleased };
    } else {
      // Standard format: Most DJ set tracklists use "Artist - Title"
      const part1HasFeat = /\b(feat\.?|ft\.?|featuring)\b/i.test(part1);
      const part2HasFeat = /\b(feat\.?|ft\.?|featuring)\b/i.test(part2);

      if (part2HasFeat && !part1HasFeat) {
        return { artist: part1, title: part2, isUnreleased };
      } else if (part1HasFeat && !part2HasFeat) {
        return { title: part1, artist: part2, isUnreleased };
      }

      // Check for remix/edit info - if it's in part1, that's likely the title (unusual format)
      const part1HasRemix = /remix|edit|vip|dub|bootleg/i.test(part1);
      const part2HasRemix = /remix|edit|vip|dub|bootleg/i.test(part2);

      if (part1HasRemix && !part2HasRemix) {
        return { title: part1, artist: part2, isUnreleased };
      }

      // Default to "Artist - Title" format (most common in DJ tracklists)
      return { artist: part1, title: part2, isUnreleased };
    }
  }

  // Format: "Title by Artist"
  const byMatch = cleanedForParsing.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    const title = byMatch[1].trim();
    const artist = byMatch[2].trim();
    if (!isValidTrackPart(title) || !isValidTrackPart(artist)) return null;
    return { title, artist, isUnreleased };
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
            const isUnreleased = trackInfo.isUnreleased || /unreleased|forthcoming|upcoming|dubplate|white\s*label/i.test(afterText);
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

            const isUnreleased = trackInfo.isUnreleased || /unreleased|forthcoming|upcoming|dubplate|white\s*label/i.test(afterText);
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
  const sorted = tracks.sort((a, b) => a.timestamp - b.timestamp);

  // Normalize helper for dedup comparison
  const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Dedup: if two tracks are within 60 seconds and have similar titles, keep the higher-confidence one
  const deduped: ParsedTrack[] = [];
  for (const track of sorted) {
    const existing = deduped.find(t =>
      Math.abs(t.timestamp - track.timestamp) < 60 &&
      (normalize(t.title) === normalize(track.title) ||
       normalize(t.artist + t.title).includes(normalize(track.title)) ||
       normalize(track.artist + track.title).includes(normalize(t.title)))
    );
    if (existing) {
      // Keep the one with higher confidence
      if (track.confidence > existing.confidence) {
        const idx = deduped.indexOf(existing);
        deduped[idx] = track;
      }
    } else {
      deduped.push(track);
    }
  }

  return deduped;
}

export function parsedTracksToTracks(parsedTracks: ParsedTrack[]): Track[] {
  return parsedTracks.map((pt, index) => ({
    id: `imported-${Date.now()}-${index}`,
    title: pt.title,
    artist: pt.artist,
    duration: 0, // Unknown
    coverUrl: '',
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

          const isUnreleased = trackInfo.isUnreleased || /unreleased|forthcoming|upcoming|dubplate|white\s*label/i.test(afterText);
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
