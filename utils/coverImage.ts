export const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1508854710579-5cecc3a9ff17?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=400&h=400&fit=crop',
];

// Keywords to match venues to appropriate images (using reliable Unsplash static URLs)
const VENUE_IMAGE_KEYWORDS: Array<{ keywords: string[]; image: string }> = [
  // Ibiza venues - beach/pool club vibes
  {
    keywords: ['ushuaia', 'ushuaïa', 'hi ibiza', 'hï ibiza', 'ocean beach', 'o beach'],
    image: 'https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?w=400&q=80'
  },
  {
    keywords: ['pacha', 'amnesia', 'privilege', 'eden', 'ibiza'],
    image: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=400&q=80'
  },
  {
    keywords: ['dc-10', 'dc10', 'circoloco'],
    image: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&q=80'
  },

  // Berlin - industrial/warehouse
  {
    keywords: ['berghain', 'tresor', 'sisyphos', 'about blank', 'rso'],
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&q=80'
  },
  {
    keywords: ['watergate', 'kater', 'salon'],
    image: 'https://images.unsplash.com/photo-1545128485-c400e7702796?w=400&q=80'
  },

  // UK venues
  {
    keywords: ['fabric', 'ministry of sound', 'mos', 'printworks', 'warehouse project', 'e1', 'drumsheds', 'london'],
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80'
  },

  // Streaming/Radio
  {
    keywords: ['boiler room', 'hör', 'hor berlin', 'hor.berlin', 'rinse', 'nts', 'bbc radio', 'essential mix', 'lot radio'],
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80'
  },
  {
    keywords: ['cercle'],
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&q=80'
  },

  // Festivals - outdoor/stage
  {
    keywords: ['tomorrowland', 'ultra', 'edc', 'electric daisy', 'creamfields', 'mysteryland'],
    image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&q=80'
  },
  {
    keywords: ['coachella', 'burning man', 'lightning in a bottle'],
    image: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&q=80'
  },
  {
    keywords: ['awakenings', 'dekmantel', 'ade', 'amsterdam dance', 'sonar', 'movement', 'time warp', 'kappa', 'primavera'],
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&q=80'
  },

  // US venues
  {
    keywords: ['space miami', 'club space', 'liv', 'e11even', 'wynwood', 'miami'],
    image: 'https://images.unsplash.com/photo-1571266028243-d220c6a88b5a?w=400&q=80'
  },
  {
    keywords: ['output', 'avant gardner', 'knockdown', 'brooklyn mirage', 'good room', 'elsewhere', 'brooklyn', 'nyc'],
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80'
  },
  {
    keywords: ['exchange la', 'sound nightclub', 'academy', 'los angeles'],
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80'
  },

  // Amsterdam
  {
    keywords: ['de school', 'shelter amsterdam', 'paradiso', 'melkweg', 'marktkantine', 'amsterdam'],
    image: 'https://images.unsplash.com/photo-1504704911898-68304a7d2571?w=400&q=80'
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
 * Get image URL for a venue using keyword matching.
 * Returns a venue-specific image if matched, otherwise a deterministic default.
 */
export function getVenueImage(venueName: string): string {
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

/**
 * Hash-based deterministic fallback image selection.
 * Same ID always returns the same fallback image.
 */
export function getFallbackImage(id: string): string {
  let hash = 0;
  const idStr = id || '';
  for (let i = 0; i < idStr.length; i++) {
    hash = ((hash << 5) - hash) + idStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % FALLBACK_IMAGES.length;
  return FALLBACK_IMAGES[index] || FALLBACK_IMAGES[0];
}

/**
 * Returns coverUrl if truthy, otherwise tries venue-specific image,
 * then falls back to a deterministic generic image.
 */
export function getCoverImageUrl(coverUrl: string | undefined | null, id: string, venue?: string | null): string {
  if (coverUrl) return coverUrl;
  if (venue) return getVenueImage(venue);
  return getFallbackImage(id);
}
