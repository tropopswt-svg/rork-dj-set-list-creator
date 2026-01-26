#!/usr/bin/env node
/**
 * Spotify API Import Script
 *
 * Uses Spotify's official API to import artists and tracks for house music genres.
 *
 * Setup:
 * 1. Go to https://developer.spotify.com/dashboard
 * 2. Create an app to get Client ID and Client Secret
 * 3. Set environment variables:
 *    export SPOTIFY_CLIENT_ID=your_client_id
 *    export SPOTIFY_CLIENT_SECRET=your_client_secret
 *
 * Run with: node scripts/spotify-import.js
 *
 * Options:
 *   --genre=deep-house      Specific genre to import
 *   --limit=100             Max artists to import
 *   --dry-run               Just show what would be imported
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://rork-dj-set-list-creator.vercel.app';
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// House music genres to search
const HOUSE_GENRES = [
  'house',
  'deep house',
  'tech house',
  'progressive house',
  'melodic house',
  'afro house',
  'organic house',
  'minimal tech house',
  'funky house',
  'jackin house',
  'soulful house',
  'disco house',
  'electro house',
  'bass house',
  'future house',
];

// Popular house music playlists to pull from
const HOUSE_PLAYLISTS = [
  '37i9dQZF1DX2TRYkJECvfC', // House Music Anthems
  '37i9dQZF1DX8tZsk68tuDw', // Dance Rising
  '37i9dQZF1DX6VdMW310YC7', // Mint
  '37i9dQZF1DX5xiztvBdlUf', // Tech House
  '37i9dQZF1DX2vYju3i0lNX', // Deep House Relax
  '37i9dQZF1DWTujiC1uxuDs', // House Party
  '37i9dQZF1DX0r3x8OtiwEM', // Deep Focus House
];

// Parse command line args
const args = process.argv.slice(2);
const options = {
  genre: null, // null means all genres
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

// Get Spotify access token
async function getSpotifyToken() {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

    const postData = 'grant_type=client_credentials';

    const req = https.request({
      hostname: 'accounts.spotify.com',
      path: '/api/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) {
            resolve(json.access_token);
          } else {
            reject(new Error(json.error_description || 'Failed to get token'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Make Spotify API request
async function spotifyRequest(token, endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.spotify.com',
      path: endpoint,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Search for artists by genre
async function searchArtistsByGenre(token, genre, limit = 50) {
  const encoded = encodeURIComponent(`genre:"${genre}"`);
  const data = await spotifyRequest(token, `/v1/search?q=${encoded}&type=artist&limit=${Math.min(limit, 50)}`);
  return data.artists?.items || [];
}

// Get playlist tracks
async function getPlaylistTracks(token, playlistId, limit = 100) {
  const data = await spotifyRequest(token, `/v1/playlists/${playlistId}/tracks?limit=${Math.min(limit, 100)}`);
  return data.items || [];
}

// Get artist's top tracks
async function getArtistTopTracks(token, artistId) {
  const data = await spotifyRequest(token, `/v1/artists/${artistId}/top-tracks?market=US`);
  return data.tracks || [];
}

// Get related artists
async function getRelatedArtists(token, artistId) {
  const data = await spotifyRequest(token, `/v1/artists/${artistId}/related`);
  return data.artists || [];
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
  console.log('Spotify House Music Import');
  console.log('='.repeat(60));
  console.log(`Limit: ${options.limit} artists`);
  console.log(`Genre filter: ${options.genre || 'all house genres'}`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log(`API: ${API_BASE_URL}`);
  console.log('');

  // Check credentials
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error('Missing Spotify credentials!');
    console.log('');
    console.log('Setup instructions:');
    console.log('1. Go to https://developer.spotify.com/dashboard');
    console.log('2. Create an app to get Client ID and Client Secret');
    console.log('3. Run with:');
    console.log('   SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node scripts/spotify-import.js');
    process.exit(1);
  }

  try {
    // Get access token
    console.log('Getting Spotify access token...');
    const token = await getSpotifyToken();
    console.log('Token acquired!');
    console.log('');

    const allArtists = new Map(); // Use Map to dedupe by ID
    const allTracks = new Map();

    // Determine which genres to search
    const genresToSearch = options.genre
      ? [options.genre]
      : HOUSE_GENRES;

    // Search by genre
    console.log('Searching artists by genre...');
    for (const genre of genresToSearch) {
      if (allArtists.size >= options.limit) break;

      console.log(`  Searching: ${genre}`);
      try {
        const artists = await searchArtistsByGenre(token, genre, 50);
        for (const artist of artists) {
          if (!allArtists.has(artist.id)) {
            allArtists.set(artist.id, {
              id: artist.id,
              name: artist.name,
              genres: artist.genres || [],
              image_url: artist.images?.[0]?.url,
              spotify_url: artist.external_urls?.spotify,
              popularity: artist.popularity,
              followers: artist.followers?.total,
            });
          }
        }
        await sleep(100); // Rate limit
      } catch (e) {
        console.log(`    Error: ${e.message}`);
      }
    }

    console.log(`Found ${allArtists.size} unique artists from genre search`);
    console.log('');

    // Get tracks from playlists
    console.log('Fetching tracks from house playlists...');
    for (const playlistId of HOUSE_PLAYLISTS) {
      console.log(`  Playlist: ${playlistId}`);
      try {
        const items = await getPlaylistTracks(token, playlistId);
        for (const item of items) {
          const track = item.track;
          if (!track || !track.id) continue;

          if (!allTracks.has(track.id)) {
            const artistNames = track.artists?.map(a => a.name) || [];
            allTracks.set(track.id, {
              id: track.id,
              title: track.name,
              artist: artistNames[0] || 'Unknown',
              artists: artistNames,
              album: track.album?.name,
              release_year: track.album?.release_date?.substring(0, 4),
              duration_seconds: Math.round((track.duration_ms || 0) / 1000),
              spotify_url: track.external_urls?.spotify,
              preview_url: track.preview_url,
              popularity: track.popularity,
            });
          }

          // Also add artists from tracks
          for (const artist of (track.artists || [])) {
            if (!allArtists.has(artist.id)) {
              allArtists.set(artist.id, {
                id: artist.id,
                name: artist.name,
                spotify_url: artist.external_urls?.spotify,
                genres: [], // Will need separate call to get genres
              });
            }
          }
        }
        await sleep(100);
      } catch (e) {
        console.log(`    Error: ${e.message}`);
      }
    }

    console.log(`Found ${allTracks.size} unique tracks from playlists`);
    console.log(`Total artists: ${allArtists.size}`);
    console.log('');

    // Get top tracks for top artists
    const topArtists = Array.from(allArtists.values())
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, Math.min(50, options.limit));

    console.log(`Fetching top tracks for ${topArtists.length} popular artists...`);
    for (const artist of topArtists) {
      try {
        const tracks = await getArtistTopTracks(token, artist.id);
        for (const track of tracks) {
          if (!allTracks.has(track.id)) {
            const artistNames = track.artists?.map(a => a.name) || [];
            allTracks.set(track.id, {
              id: track.id,
              title: track.name,
              artist: artistNames[0] || artist.name,
              artists: artistNames,
              album: track.album?.name,
              release_year: track.album?.release_date?.substring(0, 4),
              duration_seconds: Math.round((track.duration_ms || 0) / 1000),
              spotify_url: track.external_urls?.spotify,
              preview_url: track.preview_url,
              popularity: track.popularity,
            });
          }
        }
        await sleep(50);
      } catch (e) {
        // Ignore individual errors
      }
    }

    console.log(`Total tracks after artist top tracks: ${allTracks.size}`);
    console.log('');

    // Prepare data for import
    const artistsArray = Array.from(allArtists.values()).slice(0, options.limit);
    const tracksArray = Array.from(allTracks.values());

    // Filter to only house-related
    const houseKeywords = ['house', 'deep', 'tech', 'disco', 'funk', 'soul', 'garage', 'progressive'];
    const filteredArtists = artistsArray.filter(a => {
      const genres = (a.genres || []).join(' ').toLowerCase();
      return houseKeywords.some(kw => genres.includes(kw)) || a.genres?.length === 0;
    });

    console.log('='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`Artists to import: ${filteredArtists.length}`);
    console.log(`Tracks to import: ${tracksArray.length}`);
    console.log('');

    if (options.dryRun) {
      console.log('DRY RUN - Sample artists:');
      filteredArtists.slice(0, 10).forEach((a, i) => {
        console.log(`  ${i + 1}. ${a.name} (${a.genres?.slice(0, 3).join(', ') || 'no genres'})`);
      });
      console.log('');
      console.log('DRY RUN - Sample tracks:');
      tracksArray.slice(0, 10).forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.artist} - ${t.title}`);
      });
      return;
    }

    // Send to API in batches
    const BATCH_SIZE = 50;
    let totalArtistsCreated = 0;
    let totalTracksCreated = 0;

    // Import artists
    console.log('Importing artists...');
    for (let i = 0; i < filteredArtists.length; i += BATCH_SIZE) {
      const batch = filteredArtists.slice(i, i + BATCH_SIZE);
      const result = await sendToApi({
        source: 'spotify',
        artists: batch.map(a => ({
          name: a.name,
          genres: a.genres,
          image_url: a.image_url,
          spotify_url: a.spotify_url,
        })),
        tracks: [],
      });

      if (result.success) {
        totalArtistsCreated += result.artistsCreated || 0;
        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.artistsCreated} created, ${result.artistsSkipped} skipped`);
      }
      await sleep(200);
    }

    // Import tracks
    console.log('Importing tracks...');
    for (let i = 0; i < tracksArray.length; i += BATCH_SIZE) {
      const batch = tracksArray.slice(i, i + BATCH_SIZE);
      const result = await sendToApi({
        source: 'spotify',
        artists: [],
        tracks: batch.map(t => ({
          title: t.title,
          artist: t.artist,
          artists: t.artists,
          release_year: t.release_year ? parseInt(t.release_year) : null,
          duration_seconds: t.duration_seconds,
          spotify_url: t.spotify_url,
        })),
      });

      if (result.success) {
        totalTracksCreated += result.tracksCreated || 0;
        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.tracksCreated} created, ${result.tracksSkipped} skipped`);
      }
      await sleep(200);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Import Complete');
    console.log('='.repeat(60));
    console.log(`Artists created: ${totalArtistsCreated}`);
    console.log(`Tracks created: ${totalTracksCreated}`);

  } catch (e) {
    console.error('Fatal error:', e.message);
    process.exit(1);
  }
}

// Run
main().catch(console.error);
