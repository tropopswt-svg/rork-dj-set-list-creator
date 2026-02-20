// Database types for Supabase
// These match the schema in supabase/migrations/001_initial_schema.sql

export interface DbArtist {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  bio: string | null;
  
  // Links
  spotify_url: string | null;
  soundcloud_url: string | null;
  instagram_url: string | null;
  resident_advisor_url: string | null;
  bandcamp_url: string | null;
  beatport_url: string | null;
  
  // Metadata
  genres: string[];
  country: string | null;
  
  // Stats
  tracks_count: number;
  sets_count: number;
  followers_count: number;

  // Enrichment
  spotify_artist_id: string | null;
  popularity: number | null;
  enriched_at: string | null;

  // Verification
  verified: boolean;
  verified_at: string | null;
  verified_by: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface DbArtistAlias {
  id: string;
  artist_id: string;
  alias: string;
  alias_lower: string;
  created_at: string;
}

export interface DbTrack {
  id: string;
  title: string;
  title_normalized: string;
  
  // Artist
  artist_id: string | null;
  artist_name: string;
  
  // Remix
  remix_artist_id: string | null;
  remix_artist_name: string | null;
  remix_type: string | null;
  
  // Release info
  label: string | null;
  release_year: number | null;
  is_unreleased: boolean;
  
  // Links
  spotify_url: string | null;
  beatport_url: string | null;
  soundcloud_url: string | null;
  youtube_url: string | null;
  
  // Audio
  isrc: string | null;
  duration_seconds: number | null;
  bpm: number | null;
  key: string | null;

  // Enrichment
  artwork_url: string | null;
  spotify_preview_url: string | null;
  popularity: number | null;
  album_name: string | null;
  enriched_at: string | null;

  // Stats
  times_played: number;

  // Verification
  verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface DbTrackAlias {
  id: string;
  track_id: string;
  title_alias: string;
  title_alias_normalized: string;
  artist_alias: string | null;
  created_at: string;
}

export interface DbSet {
  id: string;
  external_id: string | null;
  name: string;
  
  artist_id: string | null;
  artist_name: string;
  
  venue: string | null;
  event_name: string | null;
  set_date: string | null;
  
  youtube_url: string | null;
  soundcloud_url: string | null;
  
  duration_seconds: number | null;
  tracks_count: number;
  cover_url: string | null;
  enriched_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface DbSetTrack {
  id: string;
  set_id: string;
  track_id: string | null;
  
  position: number;
  timestamp_seconds: number | null;
  
  raw_title: string | null;
  raw_artist: string | null;
  
  confidence: number;
  source: string | null;
  
  created_at: string;
}

// ============================================
// App-friendly types (with relations)
// ============================================

export interface Artist extends Omit<DbArtist, 'created_at' | 'updated_at' | 'verified_at'> {
  createdAt: Date;
  updatedAt: Date;
  verifiedAt: Date | null;
  aliases?: string[];
  recentTracks?: Track[];
  recentSets?: Set[];
}

export interface Track extends Omit<DbTrack, 'created_at' | 'updated_at' | 'verified_at' | 'title_normalized'> {
  createdAt: Date;
  updatedAt: Date;
  verifiedAt: Date | null;
  artist?: Artist;
  remixArtist?: Artist;
}

export interface Set extends Omit<DbSet, 'created_at' | 'updated_at'> {
  createdAt: Date;
  updatedAt: Date;
  artist?: Artist;
  tracks?: SetTrack[];
}

export interface SetTrack extends Omit<DbSetTrack, 'created_at'> {
  createdAt: Date;
  track?: Track;
}

// ============================================
// Input types for creating/updating
// ============================================

export interface CreateArtistInput {
  name: string;
  image_url?: string;
  bio?: string;
  spotify_url?: string;
  soundcloud_url?: string;
  instagram_url?: string;
  resident_advisor_url?: string;
  bandcamp_url?: string;
  beatport_url?: string;
  genres?: string[];
  country?: string;
  aliases?: string[];
}

export interface CreateTrackInput {
  title: string;
  artist_name: string;
  artist_id?: string;
  remix_artist_name?: string;
  remix_artist_id?: string;
  remix_type?: string;
  label?: string;
  release_year?: number;
  is_unreleased?: boolean;
  spotify_url?: string;
  beatport_url?: string;
  soundcloud_url?: string;
  youtube_url?: string;
  duration_seconds?: number;
  bpm?: number;
  key?: string;
}

// ============================================
// Match results
// ============================================

export interface ArtistMatch {
  artist: DbArtist;
  confidence: number; // 0-1
  matchType: 'exact' | 'alias' | 'fuzzy';
  matchedOn: string; // What string matched
}

export interface TrackMatch {
  track: DbTrack;
  confidence: number;
  matchType: 'exact' | 'alias' | 'fuzzy';
  artistMatch?: ArtistMatch;
}
