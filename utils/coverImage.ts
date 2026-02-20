/**
 * Returns the coverUrl if it's a real image, or null if missing.
 * No stock/placeholder images — components handle the empty state.
 */
export function getCoverImageUrl(coverUrl: string | undefined | null, _id?: string, _venue?: string | null): string | null {
  if (coverUrl && !coverUrl.includes('unsplash.com')) return coverUrl;
  return null;
}

/** @deprecated — returns null. Use getCoverImageUrl instead. */
export function getFallbackImage(_id: string): null {
  return null;
}

/** @deprecated — returns null. Use getCoverImageUrl instead. */
export function getVenueImage(_venueName: string): null {
  return null;
}
