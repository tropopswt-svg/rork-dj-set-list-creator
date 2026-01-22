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
  source: 'shazam' | 'social' | 'manual' | 'ai' | 'link';
  timestamp?: number;
  contributedBy?: string;
  verified?: boolean;
  isUnreleased?: boolean;
  trackLinks?: TrackLink[];
  featuredIn?: FeaturedInSet[];
}

export interface SourceLink {
  platform: 'youtube' | 'soundcloud' | 'mixcloud' | '1001tracklists';
  url: string;
  label?: string;
}

export interface SetList {
  id: string;
  name: string;
  artist: string;
  venue?: string;
  date: Date;
  tracks: Track[];
  coverUrl?: string;
  sourceLinks: SourceLink[];
  totalDuration?: number;
  aiProcessed?: boolean;
  commentsScraped?: number;
  tracksIdentified?: number;
  plays?: number;
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
