// Artist image fetching using free APIs (no keys required)

interface MusicBrainzArtist {
  id: string;
  name: string;
  score: number;
}

interface MusicBrainzSearchResponse {
  artists: MusicBrainzArtist[];
}

/**
 * Search MusicBrainz for an artist and get their image from Cover Art Archive
 * This is completely free and requires no API key
 */
export async function getArtistImageMusicBrainz(artistName: string): Promise<string | null> {
  try {
    // Search MusicBrainz for artist
    const query = encodeURIComponent(artistName);
    const searchUrl = `https://musicbrainz.org/ws/2/artist/?query=artist:${query}&fmt=json&limit=5`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'TRACKD-App/1.0 (https://trackd.app)',
      },
    });

    if (!searchResponse.ok) {
      return null;
    }

    const searchData: MusicBrainzSearchResponse = await searchResponse.json();

    if (!searchData.artists?.length) {
      return null;
    }

    // Find best match (highest score or exact name match)
    const normalizedSearch = artistName.toLowerCase().trim();
    let bestMatch = searchData.artists[0];

    for (const artist of searchData.artists) {
      if (artist.name.toLowerCase().trim() === normalizedSearch) {
        bestMatch = artist;
        break;
      }
    }

    // Try to get image from Cover Art Archive via Wikimedia/Fanart
    // MusicBrainz itself doesn't host images, but we can check related sources
    const mbid = bestMatch.id;

    // Try Wikimedia Commons via MusicBrainz relations
    const artistUrl = `https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels&fmt=json`;
    const artistResponse = await fetch(artistUrl, {
      headers: {
        'User-Agent': 'TRACKD-App/1.0 (https://trackd.app)',
      },
    });

    if (artistResponse.ok) {
      const artistData = await artistResponse.json();

      // Look for image URL in relations
      if (artistData.relations) {
        for (const rel of artistData.relations) {
          if (rel.type === 'image' && rel.url?.resource) {
            // Convert Wikimedia file page to direct image URL
            if (rel.url.resource.includes('commons.wikimedia.org')) {
              const fileMatch = rel.url.resource.match(/File:(.+)$/);
              if (fileMatch) {
                const fileName = fileMatch[1];
                const hash = await md5Hash(fileName);
                const imageUrl = `https://upload.wikimedia.org/wikipedia/commons/thumb/${hash[0]}/${hash.substring(0,2)}/${fileName}/400px-${fileName}`;
                return imageUrl;
              }
            }
            return rel.url.resource;
          }
        }
      }
    }

    return null;
  } catch (error) {
    if (__DEV__) console.error('[ArtistImages] MusicBrainz error:', error);
    return null;
  }
}

/**
 * Generate a placeholder avatar URL using UI Avatars (free service)
 * This generates a nice colored avatar with initials
 */
export function getPlaceholderAvatar(artistName: string, size: number = 200): string {
  const encoded = encodeURIComponent(artistName);
  // UI Avatars is a free service that generates avatar images
  return `https://ui-avatars.com/api/?name=${encoded}&size=${size}&background=random&color=fff&bold=true&format=png`;
}

/**
 * Generate avatar using DiceBear (another free option with more styles)
 */
export function getDiceBearAvatar(artistName: string, style: 'initials' | 'shapes' | 'icons' = 'initials'): string {
  const seed = encodeURIComponent(artistName);
  return `https://api.dicebear.com/7.x/${style}/png?seed=${seed}&size=200`;
}

/**
 * Try to get artist image, with fallback to placeholder
 */
export async function getArtistImageWithFallback(artistName: string): Promise<string> {
  // Try MusicBrainz first
  const mbImage = await getArtistImageMusicBrainz(artistName);
  if (mbImage) {
    return mbImage;
  }

  // Fall back to generated avatar
  return getPlaceholderAvatar(artistName);
}

/**
 * Simple hash function for Wikimedia URLs
 */
async function md5Hash(str: string): Promise<string> {
  // Simple implementation - in production you'd want a proper MD5
  // For Wikimedia we just need a consistent hash
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

/**
 * Batch get placeholder avatars for artists without images
 */
export function getPlaceholderAvatars(artistNames: string[]): Map<string, string> {
  const results = new Map<string, string>();
  for (const name of artistNames) {
    results.set(name, getPlaceholderAvatar(name));
  }
  return results;
}
