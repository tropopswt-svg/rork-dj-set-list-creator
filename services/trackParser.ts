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
}

// Common timestamp patterns
const TIMESTAMP_PATTERNS = [
  // HH:MM:SS or H:MM:SS
  /\b(\d{1,2}):(\d{2}):(\d{2})\b/g,
  // MM:SS or M:SS
  /\b(\d{1,2}):(\d{2})\b/g,
];

// Patterns that indicate a track ID
const TRACK_ID_INDICATORS = [
  /(?:track\s*(?:id)?|id|song)[\s:]+/i,
  /(?:this\s+is|that's|it's|playing)\s+/i,
  /^@?\d{1,2}:\d{2}/,
  /[-–—]\s*(?=[A-Z])/,
];

// Common DJ set terms to filter out
const NOISE_TERMS = [
  /^\s*tracklist\s*$/i,
  /^\s*\d+\.\s*$/,
  /^intro$/i,
  /^outro$/i,
  /^(?:un)?released$/i,
  /^id\s*$/i,
  /^unknown$/i,
];

function parseTimestamp(timestampStr: string): number {
  const parts = timestampStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function extractTimestamps(text: string): { timestamp: number; formatted: string; position: number }[] {
  const results: { timestamp: number; formatted: string; position: number }[] = [];

  // Try HH:MM:SS first
  const longPattern = /\b(\d{1,2}):(\d{2}):(\d{2})\b/g;
  let match;
  while ((match = longPattern.exec(text)) !== null) {
    const seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
    results.push({
      timestamp: seconds,
      formatted: match[0],
      position: match.index,
    });
  }

  // Then try MM:SS (but not if it's part of HH:MM:SS)
  const shortPattern = /\b(\d{1,2}):(\d{2})\b/g;
  while ((match = shortPattern.exec(text)) !== null) {
    // Check if this is part of a longer timestamp we already captured
    const isPartOfLonger = results.some(
      r => match!.index >= r.position && match!.index < r.position + r.formatted.length + 3
    );
    if (!isPartOfLonger) {
      const seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
      results.push({
        timestamp: seconds,
        formatted: match[0],
        position: match.index,
      });
    }
  }

  return results.sort((a, b) => a.position - b.position);
}

function parseTrackInfo(text: string, afterTimestamp: boolean = false): { title: string; artist: string } | null {
  // Clean up the text
  let cleaned = text
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

  // Check for noise terms
  for (const noise of NOISE_TERMS) {
    if (noise.test(cleaned)) {
      return null;
    }
  }

  // Try to parse "Artist - Title" format
  const dashMatch = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    const [, part1, part2] = dashMatch;
    // Usually Artist - Title, but could be Title - Artist
    // Heuristic: if part1 is shorter, it's probably the artist
    return {
      artist: part1.trim(),
      title: part2.trim(),
    };
  }

  // Try to parse "Title by Artist" format
  const byMatch = cleaned.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return {
      title: byMatch[1].trim(),
      artist: byMatch[2].trim(),
    };
  }

  // Try "Artist - Title" with quotes
  const quotedMatch = cleaned.match(/["'](.+?)["']\s*(?:by|[-–—])\s*(.+)/i);
  if (quotedMatch) {
    return {
      title: quotedMatch[1].trim(),
      artist: quotedMatch[2].trim(),
    };
  }

  // If we're after a timestamp and have text, treat it as a potential track
  if (afterTimestamp && cleaned.length > 3 && cleaned.length < 100) {
    // Could be just a title or "Artist - Title"
    return {
      artist: 'Unknown',
      title: cleaned,
    };
  }

  return null;
}

function calculateConfidence(
  comment: YouTubeComment,
  hasTimestamp: boolean,
  trackInfo: { title: string; artist: string }
): number {
  let confidence = 0.3; // Base confidence

  // Higher confidence for comments with timestamps
  if (hasTimestamp) {
    confidence += 0.2;
  }

  // Higher confidence for comments with more likes
  if (comment.likeCount > 100) {
    confidence += 0.2;
  } else if (comment.likeCount > 10) {
    confidence += 0.1;
  }

  // Higher confidence if we parsed both artist and title
  if (trackInfo.artist !== 'Unknown') {
    confidence += 0.15;
  }

  // Higher confidence for track ID indicators
  const text = comment.text.toLowerCase();
  if (text.includes('track id') || text.includes('trackid')) {
    confidence += 0.1;
  }
  if (text.includes('playing') || text.includes('this is') || text.includes("that's")) {
    confidence += 0.05;
  }

  return Math.min(confidence, 1);
}

export function parseComments(comments: YouTubeComment[]): ParsedTrack[] {
  const tracks: ParsedTrack[] = [];
  const seenTracks = new Set<string>();

  for (const comment of comments) {
    const text = comment.text;
    const timestamps = extractTimestamps(text);

    if (timestamps.length === 0) {
      // No timestamp, but might still have track info
      const trackInfo = parseTrackInfo(text);
      if (trackInfo && trackInfo.artist !== 'Unknown') {
        const key = `${trackInfo.artist.toLowerCase()}-${trackInfo.title.toLowerCase()}`;
        if (!seenTracks.has(key)) {
          seenTracks.add(key);
          tracks.push({
            timestamp: 0,
            timestampFormatted: '0:00',
            ...trackInfo,
            confidence: calculateConfidence(comment, false, trackInfo),
            sourceComment: text,
            sourceAuthor: comment.authorName,
            likes: comment.likeCount,
          });
        }
      }
      continue;
    }

    // Process each timestamp in the comment
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const nextTs = timestamps[i + 1];

      // Extract text after this timestamp and before next
      const startPos = ts.position + ts.formatted.length;
      const endPos = nextTs ? nextTs.position : text.length;
      const afterText = text.slice(startPos, endPos).trim();

      // Clean up common prefixes
      const cleanedText = afterText
        .replace(/^[\s:.\-–—]+/, '')
        .replace(/[\s:.\-–—]+$/, '')
        .trim();

      const trackInfo = parseTrackInfo(cleanedText, true);
      if (trackInfo) {
        const key = `${ts.timestamp}-${trackInfo.artist.toLowerCase()}-${trackInfo.title.toLowerCase()}`;
        if (!seenTracks.has(key)) {
          seenTracks.add(key);
          tracks.push({
            timestamp: ts.timestamp,
            timestampFormatted: ts.formatted,
            ...trackInfo,
            confidence: calculateConfidence(comment, true, trackInfo),
            sourceComment: text,
            sourceAuthor: comment.authorName,
            likes: comment.likeCount,
          });
        }
      }
    }
  }

  // Sort by timestamp
  tracks.sort((a, b) => a.timestamp - b.timestamp);

  return tracks;
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
  }));
}

// Parse description for tracklists (many DJ sets have tracklists in description)
export function parseDescription(description: string): ParsedTrack[] {
  const lines = description.split('\n');
  const tracks: ParsedTrack[] = [];

  for (const line of lines) {
    const timestamps = extractTimestamps(line);
    if (timestamps.length > 0) {
      const ts = timestamps[0];
      const afterText = line.slice(ts.position + ts.formatted.length).trim();
      const cleanedText = afterText.replace(/^[\s:.\-–—]+/, '').trim();

      const trackInfo = parseTrackInfo(cleanedText, true);
      if (trackInfo) {
        tracks.push({
          timestamp: ts.timestamp,
          timestampFormatted: ts.formatted,
          ...trackInfo,
          confidence: 0.9, // High confidence for description tracklists
          sourceComment: 'Video description',
          sourceAuthor: 'Uploader',
          likes: 0,
        });
      }
    }
  }

  return tracks;
}
