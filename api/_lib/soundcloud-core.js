// Shared SoundCloud utilities — client_id fetching and track search
// Used by import.js and spotify-enrich.js (as fallback for track artwork)

const SOUNDCLOUD_API_V2 = 'https://api-v2.soundcloud.com';

// Cache for dynamic SoundCloud client_id
let cachedClientId = null;
let clientIdFetchedAt = 0;
const CLIENT_ID_CACHE_DURATION = 3600000; // 1 hour

/**
 * Dynamically fetch a fresh SoundCloud client_id from their JS files.
 * Falls back to SOUNDCLOUD_CLIENT_ID env var.
 */
export async function fetchSoundCloudClientId() {
  if (cachedClientId && (Date.now() - clientIdFetchedAt) < CLIENT_ID_CACHE_DURATION) {
    return cachedClientId;
  }

  try {
    const homeResponse = await fetch('https://soundcloud.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    if (!homeResponse.ok) return process.env.SOUNDCLOUD_CLIENT_ID || null;

    const html = await homeResponse.text();
    const scriptPattern = /<script crossorigin src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g;
    const urls = [];
    let match;
    while ((match = scriptPattern.exec(html)) !== null) {
      urls.push(match[1]);
    }

    if (urls.length === 0) return process.env.SOUNDCLOUD_CLIENT_ID || null;

    const jsUrl = urls[urls.length - 1];
    const jsResponse = await fetch(jsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!jsResponse.ok) return process.env.SOUNDCLOUD_CLIENT_ID || null;

    const jsContent = await jsResponse.text();

    const clientIdMatch = jsContent.match(/,client_id:"([^"]+)"/);
    if (clientIdMatch) {
      cachedClientId = clientIdMatch[1];
      clientIdFetchedAt = Date.now();
      return cachedClientId;
    }

    const altMatch = jsContent.match(/client_id=([a-zA-Z0-9]+)/);
    if (altMatch) {
      cachedClientId = altMatch[1];
      clientIdFetchedAt = Date.now();
      return cachedClientId;
    }

    return process.env.SOUNDCLOUD_CLIENT_ID || null;
  } catch (error) {
    console.error('[SoundCloud] Error fetching client_id:', error.message);
    return process.env.SOUNDCLOUD_CLIENT_ID || null;
  }
}

/**
 * Normalize a string for comparison.
 */
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Search SoundCloud for a track and return its artwork URL.
 * Returns { artwork_url, title, artist, permalink_url } or null.
 */
export async function searchTrackOnSoundCloud(clientId, artist, title) {
  if (!clientId || !artist || !title) return null;

  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const response = await fetch(
      `${SOUNDCLOUD_API_V2}/search/tracks?q=${query}&client_id=${clientId}&limit=5`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const tracks = data.collection || [];

    for (const track of tracks) {
      const trackTitle = track.title || '';
      const trackArtist = track.user?.username || '';

      // Check for a reasonable match
      const titleMatch =
        normalize(trackTitle).includes(normalize(title)) ||
        normalize(title).includes(normalize(trackTitle));
      const artistMatch =
        normalize(trackArtist).includes(normalize(artist)) ||
        normalize(artist).includes(normalize(trackArtist));

      if (titleMatch && artistMatch && track.artwork_url) {
        // Upgrade to 500x500 resolution
        const artworkUrl = track.artwork_url.replace('-large', '-t500x500');
        return {
          artwork_url: artworkUrl,
          title: track.title,
          artist: track.user?.username,
          permalink_url: track.permalink_url || null,
        };
      }
    }

    // If no exact match, return first result with artwork (less strict)
    for (const track of tracks) {
      if (track.artwork_url) {
        const titleMatch =
          normalize(track.title || '').includes(normalize(title)) ||
          normalize(title).includes(normalize(track.title || ''));

        if (titleMatch) {
          const artworkUrl = track.artwork_url.replace('-large', '-t500x500');
          return {
            artwork_url: artworkUrl,
            title: track.title,
            artist: track.user?.username,
            permalink_url: track.permalink_url || null,
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[SoundCloud] Track search error:', error.message);
    return null;
  }
}

/**
 * Search SoundCloud for an artist (user) profile.
 * Returns { username, permalink_url, avatar_url, followers_count } or null.
 */
export async function searchArtistOnSoundCloud(clientId, artistName) {
  if (!clientId || !artistName) return null;

  try {
    const query = encodeURIComponent(artistName);
    const response = await fetch(
      `${SOUNDCLOUD_API_V2}/search/users?q=${query}&client_id=${clientId}&limit=5`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const users = data.collection || [];

    for (const user of users) {
      const username = user.username || '';

      const nameMatch =
        normalize(username) === normalize(artistName) ||
        normalize(username).includes(normalize(artistName)) ||
        normalize(artistName).includes(normalize(username));

      if (nameMatch) {
        // Upgrade avatar to high-res (t500x500)
        const avatarUrl = user.avatar_url
          ? user.avatar_url.replace('-large', '-t500x500')
          : null;

        return {
          username: user.username,
          permalink_url: user.permalink_url || `https://soundcloud.com/${user.permalink}`,
          avatar_url: avatarUrl,
          followers_count: user.followers_count || 0,
          track_count: user.track_count || 0,
          description: user.description || null,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('[SoundCloud] Artist search error:', error.message);
    return null;
  }
}

/**
 * Fetch artwork for a SoundCloud URL via oEmbed.
 * Used for set-level cover fallback.
 */
export async function fetchSoundCloudArtwork(soundcloudUrl) {
  if (!soundcloudUrl) return null;

  try {
    const response = await fetch(
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(soundcloudUrl)}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.thumbnail_url || null;
  } catch {
    return null;
  }
}
