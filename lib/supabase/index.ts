// Supabase client and services
export { supabase, isSupabaseConfigured } from './client';

// Types
export * from './types';

// Artist service
export {
  findArtist,
  findArtistMatches,
  getArtist,
  getArtistBySlug,
  createArtist,
  addArtistAliases,
  getOrCreateArtist,
  getArtists,
  searchArtists,
  getArtistTracks,
  getArtistSets,
  normalizeText,
  generateSlug,
} from './artistService';

// Track service
export {
  findTrack,
  getTrack,
  createTrack,
  getOrCreateTrack,
  addTrackAlias,
  searchTracks,
  getPopularTracks,
  incrementTrackPlays,
} from './trackService';
