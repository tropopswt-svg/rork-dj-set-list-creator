/**
 * Extract YouTube video ID from various URL formats.
 */
function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Returns the coverUrl if it's a real image, or null if missing.
 * No stock/placeholder images — components handle the empty state.
 */
export function getCoverImageUrl(coverUrl: string | undefined | null, _id?: string, _venue?: string | null): string | null {
  if (coverUrl && !coverUrl.includes('unsplash.com')) return coverUrl;
  return null;
}

/**
 * Returns a cover image URL with YouTube thumbnail and artist image fallbacks.
 * Use this for raw Supabase set objects (from FK joins that include youtube_url
 * and optionally artist:dj_id(image_url)).
 */
export function getSetCoverUrl(set: {
  cover_url?: string | null;
  youtube_url?: string | null;
  artist?: { image_url?: string | null } | null;
}): string | null {
  // 1. Direct cover URL
  if (set.cover_url && !set.cover_url.includes('unsplash.com')) return set.cover_url;
  // 2. YouTube thumbnail
  const videoId = extractYouTubeVideoId(set.youtube_url);
  if (videoId) return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  // 3. Artist image (from joined dj_id → artists table)
  if (set.artist?.image_url) return set.artist.image_url;
  return null;
}

/** @deprecated — returns null. Use getCoverImageUrl instead. */
export function getFallbackImage(_id: string): null {
  return null;
}

/** @deprecated — returns null. No stock images. */
export function getVenueImage(_venueName: string | null | undefined): null {
  return null;
}
