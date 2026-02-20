import { supabase, isSupabaseConfigured } from './client';
import { normalizeVenueName, getVenueAliases } from '../venueNormalization';
import { getVenueImage } from '@/utils/coverImage';

// ============================================
// Venue Types
// ============================================

export interface VenueInfo {
  name: string;
  setsCount: number;
  imageUrl?: string;
  location?: string;
}

export interface VenueWithSets extends VenueInfo {
  recentSets: any[];
}

// ============================================
// Browse Venues
// ============================================

export type VenueSortOption = 'name' | 'sets_count' | 'recent';

interface BrowseVenuesOptions {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: VenueSortOption;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Get all unique venues with their set counts
 */
export async function browseVenues(options: BrowseVenuesOptions = {}): Promise<{ data: VenueInfo[]; count: number }> {
  if (!isSupabaseConfigured()) return { data: [], count: 0 };

  const {
    limit = 20,
    offset = 0,
    search,
    sortBy = 'sets_count',
    sortOrder = 'desc',
  } = options;

  try {
    // Since venues are stored as strings on sets, we need to aggregate them
    let query = supabase
      .from('sets')
      .select('venue')
      .not('venue', 'is', null)
      .neq('venue', '');

    // Apply search filter
    if (search && search.length > 0) {
      query = query.ilike('venue', `%${search}%`);
    }

    const { data: rawData, error } = await query;

    if (error) {
      if (__DEV__) console.error('[VenueService] Error fetching venues:', error);
      return { data: [], count: 0 };
    }

    // Aggregate venues — normalize to canonical names so "Amnesia" and "Amnesia Ibiza" group together
    const venueMap = new Map<string, number>();

    for (const row of rawData || []) {
      if (row.venue) {
        const normalized = normalizeVenueName(row.venue);
        venueMap.set(normalized, (venueMap.get(normalized) || 0) + 1);
      }
    }

    // Convert to array and sort, adding images
    let venues: VenueInfo[] = Array.from(venueMap.entries()).map(([name, count]) => ({
      name,
      setsCount: count,
      imageUrl: undefined,
    }));

    // Apply sorting
    if (sortBy === 'name') {
      venues.sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    } else if (sortBy === 'sets_count') {
      venues.sort((a, b) => {
        const comparison = a.setsCount - b.setsCount;
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    const totalCount = venues.length;

    // Apply pagination
    venues = venues.slice(offset, offset + limit);

    return { data: venues, count: totalCount };
  } catch (err) {
    if (__DEV__) console.error('[VenueService] Unexpected error:', err);
    return { data: [], count: 0 };
  }
}

/**
 * Get popular venues (most sets)
 */
export async function getPopularVenues(limit: number = 10): Promise<VenueInfo[]> {
  try {
    const { data } = await browseVenues({
      limit,
      sortBy: 'sets_count',
      sortOrder: 'desc',
    });
    return data;
  } catch (err) {
    if (__DEV__) console.error('[VenueService] Error getting popular venues:', err);
    return [];
  }
}

/**
 * Get the top N venues by set count, sorted A-Z by name.
 * Used as the default view before the user searches or changes sort.
 */
export async function getTopVenues(limit: number = 100): Promise<VenueInfo[]> {
  try {
    // Fetch all venues sorted by sets count
    const { data } = await browseVenues({
      limit: limit,
      sortBy: 'sets_count',
      sortOrder: 'desc',
    });
    // Sort the top venues A-Z by name
    const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  } catch (err) {
    if (__DEV__) console.error('[VenueService] Error getting top venues:', err);
    return [];
  }
}

/**
 * Get sets for a specific venue
 */
export async function getVenueSets(venueName: string, limit: number = 50, offset: number = 0): Promise<{ data: any[]; count: number }> {
  if (!isSupabaseConfigured()) return { data: [], count: 0 };

  try {
    // Get all known aliases for this venue so "Amnesia" also finds "Amnesia Ibiza" rows
    const aliases = getVenueAliases(venueName);
    const orFilter = aliases.map(a => `venue.ilike.%${a}%`).join(',');

    const { data, error, count } = await supabase
      .from('sets')
      .select('*', { count: 'exact' })
      .or(orFilter)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (__DEV__) console.error('[VenueService] Error fetching venue sets:', error);
      return { data: [], count: 0 };
    }

    return { data: data || [], count: count || 0 };
  } catch (err) {
    if (__DEV__) console.error('[VenueService] Unexpected error fetching venue sets:', err);
    return { data: [], count: 0 };
  }
}

/**
 * Get venue details with recent sets
 */
export async function getVenueWithSets(venueName: string, setsLimit: number = 20): Promise<VenueWithSets | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    // Match all aliases for this venue
    const aliases = getVenueAliases(venueName);
    const orFilter = aliases.map(a => `venue.ilike.%${a}%`).join(',');

    const { data: sets, count } = await supabase
      .from('sets')
      .select('*', { count: 'exact' })
      .or(orFilter)
      .order('created_at', { ascending: false })
      .limit(setsLimit);

    if (!sets || sets.length === 0) {
      return null;
    }

    return {
      name: venueName,
      setsCount: count || sets.length,
      imageUrl: undefined,
      recentSets: sets,
    };
  } catch (err) {
    if (__DEV__) console.error('[VenueService] Error getting venue with sets:', err);
    return null;
  }
}

/**
 * Search venues by name
 */
export async function searchVenues(query: string, limit: number = 10): Promise<VenueInfo[]> {
  try {
    const { data } = await browseVenues({
      limit,
      search: query,
      sortBy: 'sets_count',
      sortOrder: 'desc',
    });
    return data;
  } catch (err) {
    if (__DEV__) console.error('[VenueService] Error searching venues:', err);
    return [];
  }
}
