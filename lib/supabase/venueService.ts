import { supabase, isSupabaseConfigured } from './client';
import { normalizeVenueName, getVenueAliases } from '../venueNormalization';

// ============================================
// Venue Images - Curated venue/club photos
// ============================================

// Keywords to match venues to appropriate images (using reliable Unsplash static URLs)
const VENUE_IMAGE_KEYWORDS: Array<{ keywords: string[]; image: string }> = [
  // Ibiza venues - beach/pool club vibes
  {
    keywords: ['ushuaia', 'ushuaïa', 'hi ibiza', 'hï ibiza', 'ocean beach', 'o beach'],
    image: 'https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?w=400&q=80' // Pool party
  },
  {
    keywords: ['pacha', 'amnesia', 'privilege', 'eden', 'ibiza'],
    image: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=400&q=80' // Club lights
  },
  {
    keywords: ['dc-10', 'dc10', 'circoloco'],
    image: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&q=80' // Underground
  },

  // Berlin - industrial/warehouse
  {
    keywords: ['berghain', 'tresor', 'sisyphos', 'about blank', 'rso'],
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&q=80' // Dark club
  },
  {
    keywords: ['watergate', 'kater', 'salon'],
    image: 'https://images.unsplash.com/photo-1545128485-c400e7702796?w=400&q=80' // Club interior
  },

  // UK venues
  {
    keywords: ['fabric', 'ministry of sound', 'mos', 'printworks', 'warehouse project', 'e1', 'drumsheds', 'london'],
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80' // Club/warehouse
  },

  // Streaming/Radio
  {
    keywords: ['boiler room', 'hör', 'hor berlin', 'hor.berlin', 'rinse', 'nts', 'bbc radio', 'essential mix', 'lot radio'],
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80' // DJ decks
  },
  {
    keywords: ['cercle'],
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&q=80' // Outdoor scenic
  },

  // Festivals - outdoor/stage
  {
    keywords: ['tomorrowland', 'ultra', 'edc', 'electric daisy', 'creamfields', 'mysteryland'],
    image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&q=80' // Festival main stage
  },
  {
    keywords: ['coachella', 'burning man', 'lightning in a bottle'],
    image: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&q=80' // Festival crowd
  },
  {
    keywords: ['awakenings', 'dekmantel', 'ade', 'amsterdam dance', 'sonar', 'movement', 'time warp', 'kappa', 'primavera'],
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&q=80' // Festival lights
  },

  // US venues
  {
    keywords: ['space miami', 'club space', 'liv', 'e11even', 'wynwood', 'miami'],
    image: 'https://images.unsplash.com/photo-1571266028243-d220c6a88b5a?w=400&q=80' // Miami club
  },
  {
    keywords: ['output', 'avant gardner', 'knockdown', 'brooklyn mirage', 'good room', 'elsewhere', 'brooklyn', 'nyc'],
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80' // NYC venue
  },
  {
    keywords: ['exchange la', 'sound nightclub', 'academy', 'los angeles'],
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80' // LA club
  },

  // Amsterdam
  {
    keywords: ['de school', 'shelter amsterdam', 'paradiso', 'melkweg', 'marktkantine', 'amsterdam'],
    image: 'https://images.unsplash.com/photo-1504704911898-68304a7d2571?w=400&q=80' // Club venue
  },

  // More specific venues/brands
  {
    keywords: ['defected', 'glitterbox'],
    image: 'https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?w=400&q=80'
  },
  {
    keywords: ['drumcode', 'afterlife', 'resistance', 'techno'],
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&q=80'
  },
  {
    keywords: ['anjuna', 'above & beyond', 'a&b', 'trance'],
    image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&q=80'
  },

  // Generic fallbacks based on common words
  {
    keywords: ['club', 'nightclub', 'lounge', 'disco'],
    image: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=400&q=80'
  },
  {
    keywords: ['festival', 'fest', 'open air', 'outdoor'],
    image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&q=80'
  },
  {
    keywords: ['warehouse', 'factory', 'hangar', 'depot', 'industrial'],
    image: 'https://images.unsplash.com/photo-1504704911898-68304a7d2571?w=400&q=80'
  },
  {
    keywords: ['beach', 'pool', 'rooftop', 'terrace', 'garden', 'sunset'],
    image: 'https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?w=400&q=80'
  },
  {
    keywords: ['radio', 'studio', 'live', 'stream', 'podcast'],
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80'
  },
  {
    keywords: ['stage', 'main', 'arena', 'tent', 'hall'],
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&q=80'
  },
];

// Default venue images by first letter (for variety) - reliable URLs
const DEFAULT_VENUE_IMAGES = [
  'https://images.unsplash.com/photo-1571266028243-d220c6a88b5a?w=400&q=80',
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=400&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
  'https://images.unsplash.com/photo-1504704911898-68304a7d2571?w=400&q=80',
];

/**
 * Get image URL for a venue using keyword matching
 * Always returns an image URL
 */
function getVenueImage(venueName: string): string {
  if (!venueName) {
    return DEFAULT_VENUE_IMAGES[0];
  }

  const lowerName = venueName.toLowerCase();

  // Find first matching keyword group
  for (const { keywords, image } of VENUE_IMAGE_KEYWORDS) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        return image;
      }
    }
  }

  // Return a default image based on first letter for variety
  const charCode = venueName.charCodeAt(0) || 0;
  const index = charCode % DEFAULT_VENUE_IMAGES.length;
  return DEFAULT_VENUE_IMAGES[index];
}

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
      imageUrl: getVenueImage(name),
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
      imageUrl: getVenueImage(venueName),
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
