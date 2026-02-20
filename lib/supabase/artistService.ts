import { supabase, isSupabaseConfigured } from './client';
import type { DbArtist, DbArtistAlias, ArtistMatch, CreateArtistInput } from './types';

// Re-export types for convenience
export type { DbArtist, ArtistMatch, CreateArtistInput } from './types';

// ============================================
// Text normalization for matching
// ============================================

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

// Calculate similarity between two strings (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  
  if (s1 === s2) return 1;
  
  // Levenshtein distance
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

// ============================================
// Artist Matching
// ============================================

/**
 * Find an artist by name, checking exact match, aliases, and fuzzy matching
 */
export async function findArtist(name: string): Promise<ArtistMatch | null> {
  if (!isSupabaseConfigured()) {
    if (__DEV__) console.warn('[ArtistService] Supabase not configured');
    return null;
  }

  const normalizedName = normalizeText(name);
  
  // 1. Try exact match on name
  const { data: exactMatch } = await supabase
    .from('artists')
    .select('*')
    .ilike('name', name)
    .limit(1)
    .single();
  
  if (exactMatch) {
    return {
      artist: exactMatch as DbArtist,
      confidence: 1,
      matchType: 'exact',
      matchedOn: name,
    };
  }
  
  // 2. Try alias match
  const { data: aliasMatch } = await supabase
    .from('artist_aliases')
    .select('*, artists(*)')
    .eq('alias_lower', normalizedName)
    .limit(1)
    .single();
  
  if (aliasMatch?.artists) {
    return {
      artist: aliasMatch.artists as DbArtist,
      confidence: 0.95,
      matchType: 'alias',
      matchedOn: aliasMatch.alias,
    };
  }
  
  // 3. Fuzzy match - get all artists and find best match
  const { data: allArtists } = await supabase
    .from('artists')
    .select('*')
    .limit(1000); // Limit for performance
  
  if (allArtists && allArtists.length > 0) {
    let bestMatch: DbArtist | null = null;
    let bestSimilarity = 0;
    
    for (const artist of allArtists) {
      const similarity = calculateSimilarity(name, artist.name);
      if (similarity > bestSimilarity && similarity >= 0.8) {
        bestSimilarity = similarity;
        bestMatch = artist as DbArtist;
      }
    }
    
    if (bestMatch) {
      return {
        artist: bestMatch,
        confidence: bestSimilarity,
        matchType: 'fuzzy',
        matchedOn: bestMatch.name,
      };
    }
  }
  
  return null;
}

/**
 * Find multiple potential matches for an artist name
 */
export async function findArtistMatches(name: string, limit: number = 5): Promise<ArtistMatch[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const matches: ArtistMatch[] = [];
  const normalizedName = normalizeText(name);
  
  // Search by name pattern
  const { data: nameMatches } = await supabase
    .from('artists')
    .select('*')
    .ilike('name', `%${name}%`)
    .limit(limit);
  
  if (nameMatches) {
    for (const artist of nameMatches) {
      const similarity = calculateSimilarity(name, artist.name);
      matches.push({
        artist: artist as DbArtist,
        confidence: similarity,
        matchType: similarity === 1 ? 'exact' : 'fuzzy',
        matchedOn: artist.name,
      });
    }
  }
  
  // Also search aliases
  const { data: aliasMatches } = await supabase
    .from('artist_aliases')
    .select('*, artists(*)')
    .ilike('alias', `%${name}%`)
    .limit(limit);
  
  if (aliasMatches) {
    for (const alias of aliasMatches) {
      if (alias.artists && !matches.some(m => m.artist.id === alias.artists.id)) {
        const similarity = calculateSimilarity(name, alias.alias);
        matches.push({
          artist: alias.artists as DbArtist,
          confidence: similarity * 0.95, // Slightly lower for alias matches
          matchType: 'alias',
          matchedOn: alias.alias,
        });
      }
    }
  }
  
  // Sort by confidence
  return matches.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

// ============================================
// Artist CRUD Operations
// ============================================

/**
 * Get artist by ID
 */
export async function getArtist(id: string): Promise<DbArtist | null> {
  if (!isSupabaseConfigured()) return null;
  
  const { data, error } = await supabase
    .from('artists')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (__DEV__) console.error('[ArtistService] Error fetching artist:', error);
    return null;
  }
  
  return data as DbArtist;
}

/**
 * Get artist by slug
 */
export async function getArtistBySlug(slug: string): Promise<DbArtist | null> {
  if (!isSupabaseConfigured()) return null;
  
  const { data, error } = await supabase
    .from('artists')
    .select('*')
    .eq('slug', slug)
    .single();
  
  if (error) {
    if (__DEV__) console.error('[ArtistService] Error fetching artist by slug:', error);
    return null;
  }
  
  return data as DbArtist;
}

/**
 * Create a new artist
 */
export async function createArtist(input: CreateArtistInput): Promise<DbArtist | null> {
  if (!isSupabaseConfigured()) return null;
  
  const slug = generateSlug(input.name);
  
  // Check if slug already exists
  const existing = await getArtistBySlug(slug);
  if (existing) {
    if (__DEV__) console.warn('[ArtistService] Artist with this slug already exists:', slug);
    return existing;
  }
  
  const { data, error } = await supabase
    .from('artists')
    .insert({
      name: input.name,
      slug,
      image_url: input.image_url,
      bio: input.bio,
      spotify_url: input.spotify_url,
      soundcloud_url: input.soundcloud_url,
      instagram_url: input.instagram_url,
      resident_advisor_url: input.resident_advisor_url,
      bandcamp_url: input.bandcamp_url,
      beatport_url: input.beatport_url,
      genres: input.genres || [],
      country: input.country,
    })
    .select()
    .single();
  
  if (error) {
    if (__DEV__) console.error('[ArtistService] Error creating artist:', error);
    return null;
  }
  
  // Add aliases if provided
  if (input.aliases && input.aliases.length > 0) {
    await addArtistAliases(data.id, input.aliases);
  }
  
  // Also add the original name as an alias for matching
  await addArtistAliases(data.id, [input.name]);
  
  return data as DbArtist;
}

/**
 * Add aliases to an artist
 */
export async function addArtistAliases(artistId: string, aliases: string[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  
  const aliasRecords = aliases.map(alias => ({
    artist_id: artistId,
    alias,
    alias_lower: normalizeText(alias),
  }));
  
  const { error } = await supabase
    .from('artist_aliases')
    .upsert(aliasRecords, { onConflict: 'alias_lower' });
  
  if (error) {
    if (__DEV__) console.error('[ArtistService] Error adding aliases:', error);
  }
}

/**
 * Get or create artist - finds existing or creates new
 */
export async function getOrCreateArtist(name: string, additionalInfo?: Partial<CreateArtistInput>): Promise<{ artist: DbArtist; isNew: boolean } | null> {
  // First try to find existing artist
  const match = await findArtist(name);
  
  if (match && match.confidence >= 0.9) {
    return { artist: match.artist, isNew: false };
  }
  
  // Create new artist
  const newArtist = await createArtist({
    name,
    ...additionalInfo,
  });
  
  if (newArtist) {
    return { artist: newArtist, isNew: true };
  }
  
  return null;
}

/**
 * Get all artists (paginated)
 */
export async function getArtists(page: number = 0, limit: number = 50): Promise<DbArtist[]> {
  if (!isSupabaseConfigured()) return [];
  
  const { data, error } = await supabase
    .from('artists')
    .select('*')
    .order('name')
    .range(page * limit, (page + 1) * limit - 1);
  
  if (error) {
    if (__DEV__) console.error('[ArtistService] Error fetching artists:', error);
    return [];
  }
  
  return data as DbArtist[];
}

/**
 * Search artists by name — tiered: exact match first, then starts-with, then contains.
 * Filters out B2B/collaboration/featuring entries for canonical results.
 */
export async function searchArtists(query: string, limit: number = 20): Promise<DbArtist[]> {
  if (!isSupabaseConfigured()) return [];

  const seen = new Set<string>();
  const results: DbArtist[] = [];

  const addUnique = (artists: DbArtist[]) => {
    for (const artist of artists) {
      if (!seen.has(artist.id)) {
        seen.add(artist.id);
        results.push(artist);
      }
    }
  };

  // Tier 1: Exact name match (case-insensitive, no wildcards)
  const { data: exact } = await supabase
    .from('artists')
    .select('*')
    .ilike('name', query)
    .order('tracks_count', { ascending: false })
    .limit(limit);

  if (exact) addUnique(filterOutB2B(exact as DbArtist[]));

  // Tier 2: Starts-with match
  if (results.length < limit) {
    const { data: startsWith } = await supabase
      .from('artists')
      .select('*')
      .ilike('name', `${query}%`)
      .order('tracks_count', { ascending: false })
      .limit(limit);

    if (startsWith) addUnique(filterOutB2B(startsWith as DbArtist[]));
  }

  // Tier 3: Contains match (substring)
  if (results.length < limit) {
    const { data: contains } = await supabase
      .from('artists')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('tracks_count', { ascending: false })
      .limit(limit * 2); // fetch extra to account for filtering

    if (contains) addUnique(filterOutB2B(contains as DbArtist[]));
  }

  return results.slice(0, limit);
}

/**
 * Get artist's tracks with the sets they appear in
 */
export async function getArtistTracks(artistId: string, limit: number = 50): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('tracks')
    .select('*, set_tracks(set_id, timestamp_seconds, sets(id, title, venue, cover_url, youtube_url))')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (__DEV__) console.error('[ArtistService] Error fetching artist tracks:', error);
    return [];
  }

  return data;
}

/**
 * Get artist's sets by artist name (sets table uses dj_name, not artist_id)
 */
export async function getArtistSets(artistId: string, limit: number = 50): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];

  // First get the artist to get their name
  const artist = await getArtist(artistId);
  if (!artist) return [];

  // Query sets by dj_name (case insensitive)
  const { data, error } = await supabase
    .from('sets')
    .select('*')
    .ilike('dj_name', artist.name)
    .order('event_date', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    if (__DEV__) console.error('[ArtistService] Error fetching artist sets:', error);
    return [];
  }

  return data;
}

// ============================================
// Browse Artists
// ============================================

export type ArtistSortOption = 'name' | 'tracks_count' | 'followers_count' | 'created_at';

interface BrowseArtistsOptions {
  limit?: number;
  offset?: number;
  search?: string;
  genre?: string;
  sortBy?: ArtistSortOption;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Check if an artist name is a B2B/collaboration/featuring (not a solo canonical artist)
 */
function isCollabOrFeaturing(name: string): boolean {
  // Check for explicit b2b/b3b patterns
  if (name.toLowerCase().match(/\bb\d+b\b/)) {
    return true;
  }

  // Check for "&" that separates artists (but not names that start with &, like "&ME")
  if (name.match(/[a-zA-Z0-9]\s*&\s*[a-zA-Z]/)) {
    return true;
  }

  // Check for " x " or " vs " separators (common DJ collab notation)
  if (name.match(/\s+x\s+/i) || name.match(/\s+vs\.?\s+/i)) {
    return true;
  }

  // Check for " and " between names
  if (name.match(/\s+and\s+/i)) {
    return true;
  }

  // Check for featuring patterns: "ft", "ft.", "feat", "feat.", "featuring"
  if (name.match(/\s+(?:ft\.?|feat\.?|featuring)\s+/i)) {
    return true;
  }

  return false;
}

/**
 * Filter out B2B/collaboration/featuring artists from a list
 */
function filterOutB2B(artists: DbArtist[]): DbArtist[] {
  return artists.filter(artist => !isCollabOrFeaturing(artist.name));
}

/**
 * Browse all artists with filtering and sorting (excludes B2B collaborations)
 */
export async function browseArtists(options: BrowseArtistsOptions = {}): Promise<{ data: DbArtist[]; count: number }> {
  if (!isSupabaseConfigured()) return { data: [], count: 0 };

  const {
    limit = 20,
    offset = 0,
    search,
    genre,
    sortBy = 'name',
    sortOrder = 'asc',
  } = options;

  // Fetch more than needed to account for B2B filtering
  const fetchLimit = limit * 3;

  let query = supabase
    .from('artists')
    .select('*', { count: 'exact' });

  // Apply search filter
  if (search && search.length > 0) {
    query = query.ilike('name', `%${search}%`);
  }

  // Apply genre filter
  if (genre && genre.length > 0) {
    query = query.contains('genres', [genre]);
  }

  // Apply sorting
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  // Fetch all for proper filtering and pagination
  const { data, error } = await query;

  if (error) {
    if (__DEV__) console.error('[ArtistService] Error browsing artists:', error);
    return { data: [], count: 0 };
  }

  // Filter out B2B collaborations
  const soloArtists = filterOutB2B(data as DbArtist[]);

  // When searching, sort exact/starts-with matches to the top
  let sortedArtists = soloArtists;
  if (search && search.length > 0) {
    const searchLower = search.toLowerCase();
    sortedArtists = [...soloArtists].sort((a, b) => {
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();
      const aExact = aLower === searchLower;
      const bExact = bLower === searchLower;
      if (aExact !== bExact) return aExact ? -1 : 1;
      const aStarts = aLower.startsWith(searchLower);
      const bStarts = bLower.startsWith(searchLower);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return 0; // preserve existing sort order otherwise
    });
  }

  // Apply pagination on filtered results
  const paginatedArtists = sortedArtists.slice(offset, offset + limit);

  return { data: paginatedArtists, count: soloArtists.length };
}

/**
 * Get popular artists (by tracks count or followers) - excludes B2B
 */
export async function getPopularArtists(limit: number = 20): Promise<DbArtist[]> {
  if (!isSupabaseConfigured()) return [];

  // Fetch more to account for B2B filtering
  const { data, error } = await supabase
    .from('artists')
    .select('*')
    .order('tracks_count', { ascending: false })
    .limit(limit * 3);

  if (error) {
    if (__DEV__) console.error('[ArtistService] Error fetching popular artists:', error);
    return [];
  }

  // Filter out B2B and return requested limit
  return filterOutB2B(data as DbArtist[]).slice(0, limit);
}

/**
 * Get the top N artists by popularity (tracks + sets + followers), sorted A-Z by name.
 * Used as the default view before the user searches or filters.
 */
export async function getTopArtists(limit: number = 100): Promise<DbArtist[]> {
  if (!isSupabaseConfigured()) return [];

  // Fetch a larger pool sorted by tracks_count to get the most active artists
  const { data, error } = await supabase
    .from('artists')
    .select('*')
    .order('tracks_count', { ascending: false })
    .limit(limit * 3);

  if (error) {
    if (__DEV__) console.error('[ArtistService] Error fetching top artists:', error);
    return [];
  }

  // Filter out B2B collaborations, take the top N, then sort A-Z
  const top = filterOutB2B(data as DbArtist[]).slice(0, limit);
  top.sort((a, b) => a.name.localeCompare(b.name));
  return top;
}

/**
 * Get all unique genres from artists
 */
export async function getArtistGenres(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('artists')
    .select('genres')
    .not('genres', 'is', null);

  if (error) {
    if (__DEV__) console.error('[ArtistService] Error fetching genres:', error);
    return [];
  }

  // Flatten and dedupe genres
  const allGenres = data.flatMap(a => a.genres || []);
  const uniqueGenres = [...new Set(allGenres)].sort();

  return uniqueGenres;
}

// ============================================
// Genre Browsing
// ============================================

export interface GenreInfo {
  genre: string;
  artistCount: number;
}

/**
 * Get all genres with artist counts, sorted by count descending
 */
export async function getGenresWithCounts(): Promise<GenreInfo[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('artists')
    .select('genres')
    .not('genres', 'is', null);

  if (error) {
    if (__DEV__) console.error('[ArtistService] Error fetching genres with counts:', error);
    return [];
  }

  // Count occurrences of each genre
  const genreCounts = new Map<string, number>();
  for (const artist of data) {
    for (const genre of (artist.genres || [])) {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    }
  }

  // Convert to array and sort by count descending
  return Array.from(genreCounts.entries())
    .map(([genre, artistCount]) => ({ genre, artistCount }))
    .sort((a, b) => b.artistCount - a.artistCount);
}

/**
 * Get sets by genre — finds artists with the genre, then queries their sets
 */
export async function getSetsByGenre(
  genre: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ data: any[]; count: number }> {
  if (!isSupabaseConfigured()) return { data: [], count: 0 };

  // Step 1: Get artist IDs for this genre
  const { data: genreArtists } = await browseArtists({
    genre: genre.toLowerCase(),
    limit: 500,
  });

  if (!genreArtists || genreArtists.length === 0) {
    return { data: [], count: 0 };
  }

  const artistIds = genreArtists.map(a => a.id);

  // Step 2: Query sets for these artists
  const { data: sets, error, count } = await supabase
    .from('sets')
    .select('id, title, dj_name, dj_id, venue, event_date, track_count, cover_url, youtube_url', { count: 'exact' })
    .in('dj_id', artistIds)
    .order('event_date', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    if (__DEV__) console.error('[ArtistService] Error fetching sets by genre:', error);
    return { data: [], count: 0 };
  }

  return { data: sets || [], count: count || 0 };
}
