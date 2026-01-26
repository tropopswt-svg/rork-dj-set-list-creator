#!/usr/bin/env node
/**
 * Beatport Import Script
 *
 * Scrapes Beatport genre charts to import artists and tracks with DJ-specific data
 * (BPM, key, label information).
 *
 * Run with: node scripts/beatport-import.js
 *
 * Options:
 *   --genre=tech-house      Specific genre slug to import
 *   --limit=100             Max tracks per genre
 *   --dry-run               Just show what would be imported
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://rork-dj-set-list-creator.vercel.app';
const DELAY_BETWEEN_REQUESTS = 1500; // Be respectful

// House music genre slugs on Beatport
const HOUSE_GENRES = [
  { slug: 'house', name: 'House' },
  { slug: 'deep-house', name: 'Deep House' },
  { slug: 'tech-house', name: 'Tech House' },
  { slug: 'progressive-house', name: 'Progressive House' },
  { slug: 'melodic-house-techno', name: 'Melodic House & Techno' },
  { slug: 'afro-house', name: 'Afro House' },
  { slug: 'organic-house-downtempo', name: 'Organic House / Downtempo' },
  { slug: 'funky-house', name: 'Funky House' },
  { slug: 'jackin-house', name: 'Jackin House' },
  { slug: 'nu-disco-disco', name: 'Nu Disco / Disco' },
  { slug: 'minimal-deep-tech', name: 'Minimal / Deep Tech' },
  { slug: 'electro-house', name: 'Electro House' },
  { slug: 'bass-house', name: 'Bass House' },
];

// Parse command line args
const args = process.argv.slice(2);
const options = {
  genre: null,
  limit: 100,
  dryRun: false,
};

args.forEach(arg => {
  if (arg.startsWith('--genre=')) {
    options.genre = arg.replace('--genre=', '');
  } else if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.replace('--limit=', ''));
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  }
});

// Fetch URL with proper headers
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Extract tracks from Beatport chart page HTML
function extractTracksFromHtml(html, genreName) {
  const tracks = [];
  const artists = new Map();

  try {
    // Beatport embeds data in script tags as JSON
    // Look for the __NEXT_DATA__ or similar JSON blob
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);

    if (nextDataMatch) {
      try {
        const jsonData = JSON.parse(nextDataMatch[1]);
        // Navigate to track data - structure may vary
        const pageProps = jsonData?.props?.pageProps;

        if (pageProps?.dehydratedState?.queries) {
          for (const query of pageProps.dehydratedState.queries) {
            const queryTracks = query?.state?.data?.tracks || query?.state?.data?.results;
            if (Array.isArray(queryTracks)) {
              for (const track of queryTracks) {
                if (track.name && track.artists) {
                  const artistNames = track.artists.map(a => a.name);
                  tracks.push({
                    title: track.name,
                    artist: artistNames[0] || 'Unknown',
                    artists: artistNames,
                    label: track.release?.label?.name || track.label?.name,
                    bpm: track.bpm,
                    key: track.key?.name || track.key,
                    release_year: track.publish_date?.substring(0, 4) || track.new_release_date?.substring(0, 4),
                    duration_seconds: track.length_ms ? Math.round(track.length_ms / 1000) : null,
                    beatport_url: track.url ? `https://www.beatport.com${track.url}` : null,
                    genre: genreName,
                  });

                  // Collect artists
                  for (const artist of track.artists || []) {
                    if (!artists.has(artist.name)) {
                      artists.set(artist.name, {
                        name: artist.name,
                        beatport_url: artist.url ? `https://www.beatport.com${artist.url}` : null,
                        genres: [genreName],
                      });
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // JSON parse error, fall back to regex
      }
    }

    // Fallback: regex extraction from HTML
    if (tracks.length === 0) {
      // Try to extract from visible HTML elements
      // This is less reliable but works as backup

      // Pattern for track items - Beatport uses specific classes
      const trackPattern = /<div[^>]*class="[^"]*TrackCard[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      let match;

      while ((match = trackPattern.exec(html)) !== null) {
        const trackHtml = match[1];

        // Extract title
        const titleMatch = trackHtml.match(/title="([^"]+)"/);
        const artistMatch = trackHtml.match(/class="[^"]*artist[^"]*"[^>]*>([^<]+)/i);
        const bpmMatch = trackHtml.match(/(\d{2,3})\s*BPM/i);
        const keyMatch = trackHtml.match(/([A-G][#b]?\s*(?:maj|min))/i);

        if (titleMatch) {
          const title = titleMatch[1];
          const artist = artistMatch ? artistMatch[1].trim() : 'Unknown';

          tracks.push({
            title,
            artist,
            bpm: bpmMatch ? parseInt(bpmMatch[1]) : null,
            key: keyMatch ? keyMatch[1] : null,
            genre: genreName,
          });

          if (!artists.has(artist)) {
            artists.set(artist, {
              name: artist,
              genres: [genreName],
            });
          }
        }
      }
    }

    // Alternative: Look for JSON-LD data
    if (tracks.length === 0) {
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/g);
      if (jsonLdMatch) {
        for (const jsonScript of jsonLdMatch) {
          try {
            const jsonContent = jsonScript.replace(/<\/?script[^>]*>/g, '');
            const data = JSON.parse(jsonContent);

            if (data['@type'] === 'MusicRecording' || data.track) {
              const trackList = data.track || [data];
              for (const t of trackList) {
                if (t.name) {
                  tracks.push({
                    title: t.name,
                    artist: t.byArtist?.name || 'Unknown',
                    duration_seconds: t.duration ? parseDuration(t.duration) : null,
                    genre: genreName,
                  });
                }
              }
            }
          } catch (e) {
            // JSON parse error
          }
        }
      }
    }

  } catch (e) {
    console.error('  Error parsing HTML:', e.message);
  }

  return { tracks, artists: Array.from(artists.values()) };
}

// Parse ISO 8601 duration
function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (match) {
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return null;
}

// Send data to our API
async function sendToApi(data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE_URL}/api/chrome-import`);
    const postData = JSON.stringify(data);

    const protocol = url.protocol === 'https:' ? https : http;

    const req = protocol.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ success: false, error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function
async function main() {
  console.log('='.repeat(60));
  console.log('Beatport House Music Import');
  console.log('='.repeat(60));
  console.log(`Limit: ${options.limit} tracks per genre`);
  console.log(`Genre filter: ${options.genre || 'all house genres'}`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log(`API: ${API_BASE_URL}`);
  console.log('');

  const allTracks = [];
  const allArtists = new Map();

  // Determine which genres to scrape
  const genresToScrape = options.genre
    ? HOUSE_GENRES.filter(g => g.slug === options.genre)
    : HOUSE_GENRES;

  if (genresToScrape.length === 0 && options.genre) {
    console.error(`Unknown genre: ${options.genre}`);
    console.log('Available genres:');
    HOUSE_GENRES.forEach(g => console.log(`  ${g.slug} (${g.name})`));
    process.exit(1);
  }

  // Scrape each genre
  for (const genre of genresToScrape) {
    console.log(`Fetching: ${genre.name} (${genre.slug})`);

    // Try top-100 chart page
    const chartUrl = `https://www.beatport.com/genre/${genre.slug}/top-100`;

    try {
      const html = await fetchUrl(chartUrl);
      const { tracks, artists } = extractTracksFromHtml(html, genre.name);

      console.log(`  Found ${tracks.length} tracks, ${artists.length} artists`);

      // Add to collections
      allTracks.push(...tracks.slice(0, options.limit));
      for (const artist of artists) {
        if (!allArtists.has(artist.name)) {
          allArtists.set(artist.name, artist);
        } else {
          // Merge genres
          const existing = allArtists.get(artist.name);
          const newGenres = [...new Set([...existing.genres, ...artist.genres])];
          existing.genres = newGenres;
        }
      }

    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }

    await sleep(DELAY_BETWEEN_REQUESTS);
  }

  const artistsArray = Array.from(allArtists.values());

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total tracks found: ${allTracks.length}`);
  console.log(`Total artists found: ${artistsArray.length}`);
  console.log('');

  if (allTracks.length === 0) {
    console.log('No tracks found. Beatport may be blocking automated requests.');
    console.log('');
    console.log('Alternative: Use the Chrome extension on Beatport pages, or');
    console.log('try the Spotify import script which uses an official API.');
    return;
  }

  if (options.dryRun) {
    console.log('DRY RUN - Sample tracks:');
    allTracks.slice(0, 15).forEach((t, i) => {
      const details = [t.bpm && `${t.bpm}BPM`, t.key, t.label].filter(Boolean).join(', ');
      console.log(`  ${i + 1}. ${t.artist} - ${t.title}${details ? ` (${details})` : ''}`);
    });
    console.log('');
    console.log('DRY RUN - Sample artists:');
    artistsArray.slice(0, 10).forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.name} (${a.genres.join(', ')})`);
    });
    return;
  }

  // Send to API
  console.log('Importing to database...');

  // Import artists first
  if (artistsArray.length > 0) {
    const result = await sendToApi({
      source: 'beatport',
      artists: artistsArray.map(a => ({
        name: a.name,
        genres: a.genres,
        beatport_url: a.beatport_url,
      })),
      tracks: [],
    });

    if (result.success) {
      console.log(`  Artists: ${result.artistsCreated} created, ${result.artistsSkipped} skipped`);
    } else {
      console.log(`  Artists error: ${result.error}`);
    }
  }

  // Import tracks in batches
  const BATCH_SIZE = 50;
  let totalTracksCreated = 0;
  let totalTracksSkipped = 0;

  for (let i = 0; i < allTracks.length; i += BATCH_SIZE) {
    const batch = allTracks.slice(i, i + BATCH_SIZE);
    const result = await sendToApi({
      source: 'beatport',
      artists: [],
      tracks: batch.map(t => ({
        title: t.title,
        artist: t.artist,
        artists: t.artists,
        label: t.label,
        bpm: t.bpm,
        key: t.key,
        release_year: t.release_year ? parseInt(t.release_year) : null,
        duration_seconds: t.duration_seconds,
        beatport_url: t.beatport_url,
      })),
    });

    if (result.success) {
      totalTracksCreated += result.tracksCreated || 0;
      totalTracksSkipped += result.tracksSkipped || 0;
    }
    await sleep(200);
  }

  console.log(`  Tracks: ${totalTracksCreated} created, ${totalTracksSkipped} skipped`);

  console.log('');
  console.log('='.repeat(60));
  console.log('Import Complete');
  console.log('='.repeat(60));
}

// Run
main().catch(console.error);
