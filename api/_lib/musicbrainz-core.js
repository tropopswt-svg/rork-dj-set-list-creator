// MusicBrainz API integration for track metadata enrichment
// Free API — no key needed, 1 req/sec rate limit, User-Agent required
// https://musicbrainz.org/doc/MusicBrainz_API

const MB_BASE = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'TrakdApp/1.0.0 (https://trakd.app)';

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1100; // 1.1s between requests (1 req/sec + margin)

// Rate-limited fetch — enforces 1 req/sec globally
async function mbFetch(path, params = {}) {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();

  const url = new URL(`${MB_BASE}${path}`);
  url.searchParams.set('fmt', 'json');
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, String(val));
  }

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
  });

  if (res.status === 503) {
    // Rate limited — back off and retry once
    await new Promise(r => setTimeout(r, 2000));
    lastRequestTime = Date.now();
    const retry = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    });
    if (!retry.ok) return null;
    return retry.json();
  }

  if (!res.ok) return null;
  return res.json();
}

// Normalize strings for comparison
function normalize(str) {
  return str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Search for a recording (track) by artist + title
// Returns enriched metadata not available from Spotify
export async function searchRecording(artist, title) {
  const query = `recording:"${title}" AND artist:"${artist}"`;
  const data = await mbFetch('/recording', { query, limit: 5 });
  if (!data?.recordings?.length) return null;

  // Find best match
  const normArtist = normalize(artist);
  const normTitle = normalize(title);

  const match = data.recordings.find(rec => {
    const recTitle = normalize(rec.title || '');
    const recArtist = normalize(
      (rec['artist-credit'] || []).map(ac => ac.name || ac.artist?.name).join(' ')
    );
    return recTitle.includes(normTitle) || normTitle.includes(recTitle)
      ? recArtist.includes(normArtist) || normArtist.includes(recArtist)
      : false;
  }) || data.recordings[0]; // fallback to top result

  const release = match.releases?.[0];

  return {
    mbid: match.id,
    title: match.title,
    artist: (match['artist-credit'] || []).map(ac => ac.name || ac.artist?.name).join(', '),
    duration: match.length ? Math.round(match.length / 1000) : null, // ms → seconds
    releaseTitle: release?.title || null,
    releaseDate: release?.date || null,
    releaseCountry: release?.country || null,
    label: release?.['label-info']?.[0]?.label?.name || null,
    catalogNumber: release?.['label-info']?.[0]?.['catalog-number'] || null,
    barcode: release?.barcode || null,
    disambiguation: match.disambiguation || null,
    isrcs: match.isrcs || [],
    tags: (match.tags || []).map(t => t.name).slice(0, 10),
    score: match.score || 0,
  };
}

// Search for a release (album/EP/single) by name
export async function searchRelease(title, artist) {
  const query = artist
    ? `release:"${title}" AND artist:"${artist}"`
    : `release:"${title}"`;
  const data = await mbFetch('/release', { query, limit: 5 });
  if (!data?.releases?.length) return null;

  const release = data.releases[0];
  return {
    mbid: release.id,
    title: release.title,
    artist: (release['artist-credit'] || []).map(ac => ac.name).join(', '),
    date: release.date || null,
    country: release.country || null,
    label: release['label-info']?.[0]?.label?.name || null,
    catalogNumber: release['label-info']?.[0]?.['catalog-number'] || null,
    barcode: release.barcode || null,
    status: release.status || null,
    trackCount: release['track-count'] || null,
    tags: (release.tags || []).map(t => t.name).slice(0, 10),
  };
}

// Lookup a recording by ISRC (exact match)
export async function lookupByISRC(isrc) {
  const data = await mbFetch(`/isrc/${isrc}`);
  if (!data?.recordings?.length) return null;

  const rec = data.recordings[0];
  return {
    mbid: rec.id,
    title: rec.title,
    artist: (rec['artist-credit'] || []).map(ac => ac.name).join(', '),
    duration: rec.length ? Math.round(rec.length / 1000) : null,
    tags: (rec.tags || []).map(t => t.name).slice(0, 10),
  };
}

// Lookup artist by name — returns genres, tags, disambiguation
export async function searchArtist(name) {
  const data = await mbFetch('/artist', { query: `artist:"${name}"`, limit: 5 });
  if (!data?.artists?.length) return null;

  const normName = normalize(name);
  const match = data.artists.find(a => normalize(a.name) === normName) || data.artists[0];

  return {
    mbid: match.id,
    name: match.name,
    sortName: match['sort-name'] || null,
    type: match.type || null, // Person, Group, etc.
    country: match.country || null,
    beginDate: match['life-span']?.begin || null,
    disambiguation: match.disambiguation || null,
    tags: (match.tags || []).map(t => ({ name: t.name, count: t.count })).slice(0, 15),
    genres: (match.genres || []).map(g => g.name).slice(0, 10),
    score: match.score || 0,
  };
}
