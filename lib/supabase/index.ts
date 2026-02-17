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

// Linking service (for auto-linking imports)
export {
  linkImportedSet,
  enhanceTracksWithDatabase,
  artistExists,
  getArtistSlug,
  batchCheckTracks,
} from './linkingService';

// Points service
export {
  addPointsToDatabase,
  getPointsTransactions,
  hasEarnedPointsForDb,
  syncAnonymousPoints,
  getCategoryFromReason,
} from './pointsService';
export type { DbPointTransaction } from './pointsService';

// Social service
export * from './socialService';

// Recommendation service
export * from './recommendationService';

// Notification service (enhanced)
export * from './notificationService';
