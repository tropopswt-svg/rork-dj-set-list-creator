export interface TrackLink {
  platform: 'spotify' | 'beatport' | 'soundcloud' | 'bandcamp' | 'youtube' | 'apple_music' | 'other';
  url: string;
}

export interface FeaturedInSet {
  setId: string;
  setName: string;
  artist: string;
  timestamp: number;
  coverUrl?: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  bpm?: number;
  key?: string;
  coverUrl: string;
  addedAt: Date;
  source: 'shazam' | 'social' | 'manual' | 'ai' | 'link' | 'database' | '1001tracklists' | 'youtube' | 'soundcloud' | 'user';
  timestamp?: number;
  contributedBy?: string;
  verified?: boolean;
  isUnreleased?: boolean;
  isId?: boolean;
  hasConflict?: boolean;
  conflictId?: string;
  trackLinks?: TrackLink[];
  featuredIn?: FeaturedInSet[];
  // Multi-source identification
  sources?: TrackSource[];
  confidence?: number; // 0-1 confidence score
}

// Track identification from a specific platform
export interface TrackSource {
  platform: 'youtube' | 'soundcloud';
  timestamp: number;
  contributedBy?: string;
  confidence: number;
  importedAt: Date;
}

export interface SourceLink {
  platform: 'youtube' | 'soundcloud' | '1001tracklists' | 'mixcloud';
  url: string;
  label?: string;
}

export interface SetList {
  id: string;
  name: string;
  artist: string;
  venue?: string;
  location?: string;
  stage?: string; // Festival stage name (e.g., "Main Stage", "Yuma Tent")
  eventName?: string; // Event/festival name if different from venue
  date: Date;
  tracks: Track[];
  coverUrl?: string;
  sourceLinks: SourceLink[];
  totalDuration?: number;
  aiProcessed?: boolean;
  commentsScraped?: number;
  tracksIdentified?: number;
  trackCount?: number;
  hasGaps?: boolean;
  gapCount?: number;
  plays?: number;
  sourcePlatform?: string;
  // Multi-source merging
  conflicts?: TrackConflict[]; // Unresolved track conflicts needing votes
  // TRACK'D matching state
  isMatchingInProgress?: boolean;
  matchingStats?: {
    total: number;
    matched: number;
    unreleased: number;
  };
}

export interface SocialComment {
  id: string;
  username: string;
  avatarUrl: string;
  platform: 'instagram' | 'tiktok' | 'twitter' | 'youtube' | 'soundcloud';
  comment: string;
  timestamp: Date;
  suggestedTrack?: Track;
  likes: number;
  trackTimestamp?: string;
}

export interface ListeningSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  tracksIdentified: Track[];
}

export interface TrackContribution {
  id: string;
  trackId: string;
  setId: string;
  userId: string;
  username: string;
  timestamp: number;
  trackTitle: string;
  trackArtist: string;
  status: 'pending' | 'verified' | 'rejected';
  upvotes: number;
  downvotes: number;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio?: string;
  joinedAt: Date;
  verifiedTracks: number;
  pendingTracks: number;
  totalPoints: number;
  favoriteGenres?: string[];
  contributions: UserContribution[];
}

export interface UserContribution {
  id: string;
  setId: string;
  setName: string;
  trackTitle: string;
  trackArtist: string;
  timestamp: number;
  status: 'pending' | 'verified' | 'rejected';
  addedAt: Date;
  points: number;
}

export interface Artist {
  id: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  setsCount: number;
  followersCount?: number;
}

// ==========================================
// Track Conflict & Community Voting System
// ==========================================

// When two sources disagree on a track at the same timestamp
export interface TrackConflict {
  id: string;
  setId: string;
  setName: string;
  timestamp: number; // Position in set (seconds)
  options: ConflictOption[];
  votes: ConflictVote[];
  createdAt: Date;
  resolvedAt?: Date;
  winnerId?: string; // ID of winning option
  status: 'active' | 'resolved' | 'expired';
}

export interface ConflictOption {
  id: string;
  title: string;
  artist: string;
  source: 'youtube' | 'soundcloud';
  confidence: number;
  contributedBy?: string;
  duration?: number; // Track duration in seconds
}

export interface ConflictVote {
  oderId: string; // User who voted
  optionId: string; // Which option they chose
  votedAt: Date;
}

// ==========================================
// Points & Gamification System
// ==========================================

export interface UserPoints {
  oderId: string;
  total: number;
  breakdown: PointsBreakdown;
  history: PointsTransaction[];
}

export interface PointsBreakdown {
  voting: number;        // Points from voting on conflicts
  correctVotes: number;  // Bonus for voting with majority
  contributions: number; // Adding secondary sources
  trackIds: number;      // Confirmed track identifications
}

export interface PointsTransaction {
  id: string;
  amount: number;
  reason: PointsReason;
  description: string;
  relatedId?: string; // Conflict ID, Set ID, etc.
  createdAt: Date;
}

export type PointsReason =
  | 'vote_cast'           // +5 for voting
  | 'vote_correct'        // +10 bonus for correct vote
  | 'source_added'        // +25 for adding secondary source
  | 'track_confirmed'     // +15 for confirmed track ID
  | 'first_import';       // +10 for first import of a set

export type PointsCategory = 'voting' | 'contributions' | 'track_ids';

// Database point transaction (for Supabase storage)
export interface DbPointTransaction {
  id: string;
  userId: string;
  amount: number;
  reason: PointsReason;
  description: string;
  relatedId?: string;
  category: PointsCategory;
  isSyncedFromAnonymous?: boolean;
  anonymousUserId?: string;
  createdAt: Date;
}

// Sync state for points system
export type PointsSyncState = 'idle' | 'syncing' | 'synced' | 'error';
