/**
 * Comment Parser
 *
 * Parses social media comments to extract potential track identifications.
 * Looks for patterns like:
 * - "ID?" followed by replies with track info
 * - Direct mentions: "This is [Artist] - [Track]"
 * - Shazam/SoundCloud/Beatport links
 * - Timestamp references: "track at 2:30 is..."
 */

// Types
export interface CommentTrackHint {
  possibleArtist?: string;
  possibleTitle?: string;
  confidence: 'high' | 'medium' | 'low';
  sourceComment: string;
  commenterUsername?: string;
  isReplyToIdRequest: boolean;
  hintType: 'id_response' | 'direct_mention' | 'link' | 'timestamp_ref';
  extractedLinks?: string[];
  timestamp?: string; // e.g., "2:30"
}

export interface ParsedCommentThread {
  hasIdRequest: boolean;
  hints: CommentTrackHint[];
}

// Regex patterns
const PATTERNS = {
  // ID requests: "ID?", "Track ID?", "what's this track?", "song name?", "tune ID?"
  idRequest:
    /\b(id\??|track\s*id\??|song\s*(name|id)\??|what('?s| is)\s*(this|the)\s*(track|song|tune)\??|tune\s*id\??|anyone\s*know\s*(this|the)\s*(track|song))\b/i,

  // Artist - Title format: "Artist - Track Name", "Artist - Track (Edit)"
  artistTitle:
    /^[\s@]*([A-Za-z0-9\s\-&'.]+?)\s*[-–—]\s*([A-Za-z0-9\s\-&'.()\[\]]+?)(?:\s*\((?:edit|remix|bootleg|vip|dub|mix)\))?$/i,

  // "This is [track]" or "It's [track]" patterns
  thisIs:
    /(?:this\s+is|it'?s|that'?s|the\s+track\s+is|the\s+song\s+is)\s+["']?([A-Za-z0-9\s\-&'.]+?)(?:\s*[-–—]\s*([A-Za-z0-9\s\-&'.()\[\]]+?))?["']?(?:\s|$|[.!])/i,

  // Music service links
  links: {
    soundcloud: /soundcloud\.com\/[\w\-]+\/[\w\-]+/gi,
    spotify: /open\.spotify\.com\/track\/[\w]+/gi,
    beatport: /beatport\.com\/track\/[\w\-]+\/\d+/gi,
    youtube: /(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w\-]+/gi,
    shazam: /shazam\.com\/[\w\/]+/gi,
  },

  // Timestamp references: "at 2:30", "2:30 mark", "track @1:45"
  timestamp: /(?:at\s+|@\s*)?(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:mark|is|=)?/gi,

  // "by [Artist]" pattern
  byArtist: /\bby\s+([A-Za-z0-9\s\-&'.]+?)(?:\s|$|[.!,])/i,

  // Quoted track names
  quotedTrack: /["']([A-Za-z0-9\s\-&'.]+?)(?:\s*[-–—]\s*([A-Za-z0-9\s\-&'.]+?))?["']/i,
};

/**
 * Check if a comment is an ID request
 */
export function isIdRequest(text: string): boolean {
  return PATTERNS.idRequest.test(text);
}

/**
 * Extract track hints from a single comment
 */
export function extractHintsFromComment(
  text: string,
  commenterUsername?: string,
  isReplyToIdRequest: boolean = false
): CommentTrackHint[] {
  const hints: CommentTrackHint[] = [];
  const cleanText = text.trim();

  // Skip if it's just an ID request itself
  if (isIdRequest(cleanText) && cleanText.length < 30) {
    return hints;
  }

  // Check for links (high confidence)
  const allLinks: string[] = [];
  for (const [platform, pattern] of Object.entries(PATTERNS.links)) {
    const matches = cleanText.match(pattern);
    if (matches) {
      allLinks.push(...matches);
    }
  }

  if (allLinks.length > 0) {
    hints.push({
      confidence: 'high',
      sourceComment: cleanText,
      commenterUsername,
      isReplyToIdRequest,
      hintType: 'link',
      extractedLinks: allLinks,
    });
  }

  // Check for "Artist - Title" format (medium-high confidence)
  const artistTitleMatch = cleanText.match(PATTERNS.artistTitle);
  if (artistTitleMatch) {
    const [, artist, title] = artistTitleMatch;
    // Avoid matching common phrases
    if (!isCommonPhrase(artist) && !isCommonPhrase(title)) {
      hints.push({
        possibleArtist: cleanArtistName(artist),
        possibleTitle: cleanTrackTitle(title),
        confidence: isReplyToIdRequest ? 'high' : 'medium',
        sourceComment: cleanText,
        commenterUsername,
        isReplyToIdRequest,
        hintType: isReplyToIdRequest ? 'id_response' : 'direct_mention',
      });
    }
  }

  // Check for "This is X" pattern (medium confidence)
  const thisIsMatch = cleanText.match(PATTERNS.thisIs);
  if (thisIsMatch) {
    const [, part1, part2] = thisIsMatch;
    hints.push({
      possibleArtist: part2 ? cleanArtistName(part1) : undefined,
      possibleTitle: part2 ? cleanTrackTitle(part2) : cleanTrackTitle(part1),
      confidence: 'medium',
      sourceComment: cleanText,
      commenterUsername,
      isReplyToIdRequest,
      hintType: isReplyToIdRequest ? 'id_response' : 'direct_mention',
    });
  }

  // Check for quoted track names (medium confidence)
  const quotedMatch = cleanText.match(PATTERNS.quotedTrack);
  if (quotedMatch && !artistTitleMatch) {
    const [, part1, part2] = quotedMatch;
    hints.push({
      possibleArtist: part2 ? cleanArtistName(part1) : undefined,
      possibleTitle: part2 ? cleanTrackTitle(part2) : cleanTrackTitle(part1),
      confidence: 'medium',
      sourceComment: cleanText,
      commenterUsername,
      isReplyToIdRequest,
      hintType: isReplyToIdRequest ? 'id_response' : 'direct_mention',
    });
  }

  // Check for "by [Artist]" pattern (low confidence without title)
  const byArtistMatch = cleanText.match(PATTERNS.byArtist);
  if (byArtistMatch && hints.length === 0) {
    const [, artist] = byArtistMatch;
    if (!isCommonPhrase(artist)) {
      hints.push({
        possibleArtist: cleanArtistName(artist),
        confidence: 'low',
        sourceComment: cleanText,
        commenterUsername,
        isReplyToIdRequest,
        hintType: isReplyToIdRequest ? 'id_response' : 'direct_mention',
      });
    }
  }

  // Extract timestamps (for context, low confidence alone)
  const timestampMatches = Array.from(cleanText.matchAll(PATTERNS.timestamp));
  for (const match of timestampMatches) {
    const existingHint = hints.find((h) => h.hintType !== 'timestamp_ref');
    if (existingHint) {
      existingHint.timestamp = match[1];
    } else if (hints.length === 0) {
      hints.push({
        confidence: 'low',
        sourceComment: cleanText,
        commenterUsername,
        isReplyToIdRequest,
        hintType: 'timestamp_ref',
        timestamp: match[1],
      });
    }
  }

  return hints;
}

/**
 * Parse a comment thread (parent + replies) for track hints
 */
export function parseCommentThread(
  parentComment: { text: string; username?: string },
  replies: Array<{ text: string; username?: string }> = []
): ParsedCommentThread {
  const hasIdRequest = isIdRequest(parentComment.text);
  const hints: CommentTrackHint[] = [];

  // Extract hints from parent comment
  const parentHints = extractHintsFromComment(
    parentComment.text,
    parentComment.username,
    false
  );
  hints.push(...parentHints);

  // Extract hints from replies
  for (const reply of replies) {
    const replyHints = extractHintsFromComment(
      reply.text,
      reply.username,
      hasIdRequest // Replies to ID requests get higher confidence
    );
    hints.push(...replyHints);
  }

  return {
    hasIdRequest,
    hints,
  };
}

/**
 * Parse all comments from a post
 */
export function parsePostComments(
  comments: Array<{
    text: string;
    username?: string;
    replies?: Array<{ text: string; username?: string }>;
  }>
): CommentTrackHint[] {
  const allHints: CommentTrackHint[] = [];

  for (const comment of comments) {
    const { hints } = parseCommentThread(comment, comment.replies || []);
    allHints.push(...hints);
  }

  // Deduplicate and sort by confidence
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  const uniqueHints = deduplicateHints(allHints);
  uniqueHints.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]);

  return uniqueHints;
}

/**
 * Filter to get only ID-related comments (for storage)
 */
export function filterIdRelatedHints(hints: CommentTrackHint[]): CommentTrackHint[] {
  return hints.filter(
    (hint) =>
      hint.isReplyToIdRequest ||
      hint.hintType === 'id_response' ||
      hint.confidence === 'high'
  );
}

// Helper functions

function cleanArtistName(name: string): string {
  return name
    .trim()
    .replace(/^[@#]/, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:]+$/, '');
}

function cleanTrackTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:]+$/, '')
    .replace(/^\(|\)$/g, '');
}

function isCommonPhrase(text: string): boolean {
  const common = [
    'this',
    'that',
    'the',
    'a',
    'an',
    'so',
    'very',
    'really',
    'just',
    'need',
    'want',
    'fire',
    'hard',
    'sick',
    'dope',
    'banger',
    'absolute',
    'pure',
    'big',
    'huge',
    'love',
    'like',
    'wow',
    'omg',
    'lol',
    'please',
    'thanks',
    'thank',
    'you',
    'me',
    'i',
    'we',
    'they',
  ];
  return common.includes(text.toLowerCase().trim());
}

function deduplicateHints(hints: CommentTrackHint[]): CommentTrackHint[] {
  const seen = new Set<string>();
  return hints.filter((hint) => {
    const key = [
      hint.possibleArtist?.toLowerCase(),
      hint.possibleTitle?.toLowerCase(),
      hint.extractedLinks?.join(','),
    ]
      .filter(Boolean)
      .join('|');

    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export default {
  isIdRequest,
  extractHintsFromComment,
  parseCommentThread,
  parsePostComments,
  filterIdRelatedHints,
};
