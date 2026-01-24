import { supabase, isSupabaseConfigured } from './client';
import type { DbArtist, DbArtistAlias, ArtistMatch, CreateArtistInput } from './types';

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
    console.warn('[ArtistService] Supabase not configured');
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
    console.error('[ArtistService] Error fetching artist:', error);
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
    console.error('[ArtistService] Error fetching artist by slug:', error);
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
    console.warn('[ArtistService] Artist with this slug already exists:', slug);
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
    console.error('[ArtistService] Error creating artist:', error);
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
    console.error('[ArtistService] Error adding aliases:', error);
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
    console.error('[ArtistService] Error fetching artists:', error);
    return [];
  }
  
  return data as DbArtist[];
}

/**
 * Search artists by name
 */
export async function searchArtists(query: string, limit: number = 20): Promise<DbArtist[]> {
  if (!isSupabaseConfigured()) return [];
  
  const { data, error } = await supabase
    .from('artists')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('tracks_count', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('[ArtistService] Error searching artists:', error);
    return [];
  }
  
  return data as DbArtist[];
}

/**
 * Get artist's tracks
 */
export async function getArtistTracks(artistId: string, limit: number = 50): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .eq('artist_id', artistId)
    .order('times_played', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('[ArtistService] Error fetching artist tracks:', error);
    return [];
  }
  
  return data;
}

/**
 * Get artist's sets
 */
export async function getArtistSets(artistId: string, limit: number = 50): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  const { data, error } = await supabase
    .from('sets')
    .select('*')
    .eq('artist_id', artistId)
    .order('set_date', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('[ArtistService] Error fetching artist sets:', error);
    return [];
  }
  
  return data;
}
