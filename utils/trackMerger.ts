import { Track, TrackSource, TrackConflict, ConflictOption, SetList } from '@/types';

// ==========================================
// Track Merging Utility
// ==========================================
// Merges track identifications from multiple sources (YouTube, SoundCloud, etc.)
// Handles duration differences, fuzzy matching, and conflict detection

export interface MergeResult {
  mergedTracks: Track[];
  conflicts: TrackConflict[];
  stats: MergeStats;
}

export interface MergeStats {
  totalPrimary: number;
  totalSecondary: number;
  matched: number;           // Tracks that matched and were boosted
  newFromSecondary: number;  // New tracks added from secondary source
  conflictsCreated: number;  // Tracks that disagreed (need voting)
  durationRatio: number;     // How much timestamps were scaled
}

interface ParsedTrack {
  title: string;
  artist: string;
  timestamp: number;
  confidence: number;
  contributedBy?: string;
  source: 'youtube' | 'soundcloud' | 'mixcloud';
}

// Duration tolerance: allow 5% difference before scaling
const DURATION_TOLERANCE = 0.05;

// Timestamp tolerance: tracks within 30 seconds are considered same position
const TIMESTAMP_TOLERANCE = 30;

// Minimum similarity for fuzzy matching (0-1)
const MIN_SIMILARITY = 0.6;

// Confidence boost when both sources agree
const CONFIDENCE_BOOST = 0.2;

/**
 * Merge tracks from a secondary source into existing tracks
 */
export function mergeTracks(
  primaryTracks: Track[],
  secondaryTracks: ParsedTrack[],
  primaryDuration: number,
  secondaryDuration: number,
  setId: string,
  setName: string
): MergeResult {
  const stats: MergeStats = {
    totalPrimary: primaryTracks.length,
    totalSecondary: secondaryTracks.length,
    matched: 0,
    newFromSecondary: 0,
    conflictsCreated: 0,
    durationRatio: 1,
  };

  // Calculate duration ratio for timestamp scaling
  const durationRatio = calculateDurationRatio(primaryDuration, secondaryDuration);
  stats.durationRatio = durationRatio;

  // Scale secondary timestamps if durations differ
  const scaledSecondary = secondaryTracks.map(track => ({
    ...track,
    timestamp: Math.round(track.timestamp * durationRatio),
  }));

  // Clone primary tracks to avoid mutation
  const mergedTracks = primaryTracks.map(t => ({ ...t }));
  const conflicts: TrackConflict[] = [];

  // Process each secondary track
  for (const secTrack of scaledSecondary) {
    const matchResult = findMatchingTrack(mergedTracks, secTrack);

    if (matchResult.type === 'exact_match') {
      // Both sources agree - boost confidence
      const track = mergedTracks[matchResult.index!];
      track.confidence = Math.min(1.0, (track.confidence || 0.7) + CONFIDENCE_BOOST);
      
      // Add secondary source to track
      if (!track.sources) track.sources = [];
      track.sources.push({
        platform: secTrack.source,
        timestamp: secTrack.timestamp,
        contributedBy: secTrack.contributedBy,
        confidence: secTrack.confidence,
        importedAt: new Date(),
      });
      
      stats.matched++;
    } else if (matchResult.type === 'conflict') {
      // Same timestamp but different track - create conflict
      const primaryTrack = mergedTracks[matchResult.index!];
      const conflict = createConflict(
        setId,
        setName,
        secTrack.timestamp,
        primaryTrack,
        secTrack
      );
      conflicts.push(conflict);
      stats.conflictsCreated++;
    } else {
      // No match - add as new track
      const newTrack = createTrackFromParsed(secTrack);
      mergedTracks.push(newTrack);
      stats.newFromSecondary++;
    }
  }

  // Sort by timestamp
  mergedTracks.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  return { mergedTracks, conflicts, stats };
}

/**
 * Calculate duration ratio for timestamp scaling
 */
function calculateDurationRatio(primary: number, secondary: number): number {
  if (!primary || !secondary) return 1;
  
  const ratio = primary / secondary;
  
  // If within tolerance, don't scale
  if (Math.abs(ratio - 1) <= DURATION_TOLERANCE) {
    return 1;
  }
  
  return ratio;
}

/**
 * Find a matching track in the primary list
 */
type MatchResult = 
  | { type: 'exact_match'; index: number }
  | { type: 'conflict'; index: number }
  | { type: 'no_match' };

function findMatchingTrack(primaryTracks: Track[], secTrack: ParsedTrack): MatchResult {
  // Find tracks within timestamp tolerance
  const candidates = primaryTracks
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => {
      const timeDiff = Math.abs((track.timestamp || 0) - secTrack.timestamp);
      return timeDiff <= TIMESTAMP_TOLERANCE;
    });

  if (candidates.length === 0) {
    return { type: 'no_match' };
  }

  // Check for exact or fuzzy match
  for (const { track, index } of candidates) {
    const similarity = calculateSimilarity(
      track.title,
      track.artist,
      secTrack.title,
      secTrack.artist
    );

    if (similarity >= MIN_SIMILARITY) {
      return { type: 'exact_match', index };
    }
  }

  // We have a track at same timestamp but different title/artist = conflict
  // Use the closest timestamp match
  const closest = candidates.reduce((best, current) => {
    const bestDiff = Math.abs((best.track.timestamp || 0) - secTrack.timestamp);
    const currDiff = Math.abs((current.track.timestamp || 0) - secTrack.timestamp);
    return currDiff < bestDiff ? current : best;
  });

  return { type: 'conflict', index: closest.index };
}

/**
 * Calculate similarity between two tracks (0-1)
 * Uses a combination of title and artist similarity
 */
function calculateSimilarity(
  title1: string,
  artist1: string,
  title2: string,
  artist2: string
): number {
  const titleSim = stringSimilarity(normalize(title1), normalize(title2));
  const artistSim = stringSimilarity(normalize(artist1), normalize(artist2));
  
  // Weight title slightly more than artist
  return titleSim * 0.6 + artistSim * 0.4;
}

/**
 * Normalize string for comparison
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

/**
 * Calculate string similarity using Levenshtein-like approach
 */
function stringSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;
  
  // Check for containment
  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = Math.min(s1.length, s2.length);
    const longer = Math.max(s1.length, s2.length);
    return shorter / longer;
  }
  
  // Simple word overlap similarity
  const words1 = new Set(s1.split(' '));
  const words2 = new Set(s2.split(' '));
  
  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }
  
  const total = words1.size + words2.size;
  return total > 0 ? (overlap * 2) / total : 0;
}

/**
 * Create a conflict for community voting
 */
function createConflict(
  setId: string,
  setName: string,
  timestamp: number,
  primaryTrack: Track,
  secondaryTrack: ParsedTrack
): TrackConflict {
  return {
    id: `conflict-${setId}-${timestamp}-${Date.now()}`,
    setId,
    setName,
    timestamp,
    options: [
      {
        id: `opt-primary-${Date.now()}`,
        title: primaryTrack.title,
        artist: primaryTrack.artist,
        source: (primaryTrack.sources?.[0]?.platform as any) || 'youtube',
        confidence: primaryTrack.confidence || 0.7,
        contributedBy: primaryTrack.contributedBy,
      },
      {
        id: `opt-secondary-${Date.now()}`,
        title: secondaryTrack.title,
        artist: secondaryTrack.artist,
        source: secondaryTrack.source,
        confidence: secondaryTrack.confidence,
        contributedBy: secondaryTrack.contributedBy,
      },
    ],
    votes: [],
    createdAt: new Date(),
    status: 'active',
  };
}

/**
 * Create a Track from parsed data
 */
function createTrackFromParsed(parsed: ParsedTrack): Track {
  return {
    id: `track-${parsed.source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: parsed.title,
    artist: parsed.artist,
    duration: 0,
    coverUrl: '',
    addedAt: new Date(),
    source: 'ai',
    timestamp: parsed.timestamp,
    contributedBy: parsed.contributedBy,
    verified: false,
    confidence: parsed.confidence,
    sources: [{
      platform: parsed.source,
      timestamp: parsed.timestamp,
      contributedBy: parsed.contributedBy,
      confidence: parsed.confidence,
      importedAt: new Date(),
    }],
  };
}

/**
 * Format timestamp as MM:SS or HH:MM:SS
 */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Check if a conflict can be resolved (has enough votes)
 */
export function canResolveConflict(conflict: TrackConflict, minVotes: number = 3): boolean {
  return conflict.votes.length >= minVotes;
}

/**
 * Resolve a conflict by determining the winner
 */
export function resolveConflict(conflict: TrackConflict): { winnerId: string; votes: number } | null {
  if (conflict.votes.length < 3) return null;
  
  // Count votes per option
  const voteCounts = new Map<string, number>();
  for (const option of conflict.options) {
    voteCounts.set(option.id, 0);
  }
  
  for (const vote of conflict.votes) {
    const current = voteCounts.get(vote.optionId) || 0;
    voteCounts.set(vote.optionId, current + 1);
  }
  
  // Find winner
  let winnerId = '';
  let maxVotes = 0;
  
  for (const [optionId, count] of voteCounts) {
    if (count > maxVotes) {
      maxVotes = count;
      winnerId = optionId;
    }
  }
  
  return { winnerId, votes: maxVotes };
}

/**
 * Convert winning option to a Track
 */
export function conflictOptionToTrack(option: ConflictOption, timestamp: number): Track {
  return {
    id: `track-resolved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: option.title,
    artist: option.artist,
    duration: 0,
    coverUrl: '',
    addedAt: new Date(),
    source: 'ai',
    timestamp,
    contributedBy: option.contributedBy,
    verified: true, // Community verified!
    confidence: 1.0, // Max confidence after community vote
    sources: [{
      platform: option.source,
      timestamp,
      contributedBy: option.contributedBy,
      confidence: option.confidence,
      importedAt: new Date(),
    }],
  };
}
