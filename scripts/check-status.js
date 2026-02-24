#!/usr/bin/env node
// Quick status check for Spotify API + Supabase database
const fs = require('fs');
const path = require('path');

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
  });
}

const { createClient } = require('@supabase/supabase-js');

async function checkSupabase() {
  console.log('\n=== SUPABASE DATABASE ===');
  const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  if (!url || !key) {
    console.log('  Status: MISSING CREDENTIALS');
    console.log('  URL:', url ? 'set' : 'NOT SET');
    console.log('  Key:', key ? 'set' : 'NOT SET');
    return;
  }

  console.log('  URL:', url);
  console.log('  Key:', key.substring(0, 20) + '...');

  const supabase = createClient(url, key);
  try {
    const start = Date.now();
    const { count: setCount, error } = await supabase.from('sets').select('*', { count: 'exact', head: true });
    const latency = Date.now() - start;

    if (error) {
      console.log('  Status: ERROR -', JSON.stringify(error));
      return;
    }

    console.log('  Status: CONNECTED (' + latency + 'ms latency)');
    console.log('  Sets:', setCount);

    const { count: trackCount } = await supabase.from('tracks').select('*', { count: 'exact', head: true });
    console.log('  Tracks:', trackCount);

    const { count: artistCount } = await supabase.from('artists').select('*', { count: 'exact', head: true });
    console.log('  Artists:', artistCount);

    const { count: setTrackCount } = await supabase.from('set_tracks').select('*', { count: 'exact', head: true });
    console.log('  Set Tracks:', setTrackCount);

    const { count: cacheCount } = await supabase.from('spotify_track_cache').select('*', { count: 'exact', head: true });
    console.log('  Spotify Cache Entries:', cacheCount);

    const { data: rl } = await supabase.from('spotify_rate_limit').select('*').eq('id', 1).single();
    if (rl) {
      const locked = rl.locked_until && new Date(rl.locked_until) > new Date();
      console.log('  Spotify Rate Limit:', rl.requests_this_window + '/30 this window', locked ? '[LOCKED until ' + rl.locked_until + ']' : '[OK]');
      console.log('  Window Start:', rl.window_start);
    }

    // Enrichment stats
    const { count: enrichedTracks } = await supabase.from('set_tracks').select('*', { count: 'exact', head: true }).not('spotify_data', 'is', null);
    const { count: unEnrichedTracks } = await supabase.from('set_tracks').select('*', { count: 'exact', head: true }).is('spotify_data', null).eq('is_id', false);
    console.log('\n  Enrichment Progress:');
    console.log('    Enriched set_tracks:', enrichedTracks);
    console.log('    Un-enriched set_tracks:', unEnrichedTracks);
    if (enrichedTracks + unEnrichedTracks > 0) {
      const pct = ((enrichedTracks / (enrichedTracks + unEnrichedTracks)) * 100).toFixed(1);
      console.log('    Coverage:', pct + '%');
    }

  } catch (e) {
    console.log('  Status: FAILED -', e.message);
  }
}

async function checkSpotify() {
  console.log('\n=== SPOTIFY API ===');
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('  Status: MISSING CREDENTIALS');
    console.log('  Client ID:', clientId ? 'set' : 'NOT SET');
    console.log('  Client Secret:', clientSecret ? 'set' : 'NOT SET');
    return;
  }

  try {
    const start = Date.now();
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });
    const latency = Date.now() - start;

    if (!response.ok) {
      const errText = await response.text();
      console.log('  Status: AUTH FAILED (' + response.status + ')');
      console.log('  Error:', errText);
      return;
    }

    const data = await response.json();
    console.log('  Status: CONNECTED (' + latency + 'ms latency)');
    console.log('  Token Type:', data.token_type);
    console.log('  Expires In:', data.expires_in + 's');

    // Test a search
    const searchStart = Date.now();
    const searchRes = await fetch('https://api.spotify.com/v1/search?q=artist:Fisher+track:Losing+It&type=track&limit=1', {
      headers: { 'Authorization': 'Bearer ' + data.access_token },
    });
    const searchLatency = Date.now() - searchStart;

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const track = searchData.tracks?.items?.[0];
      console.log('  Search API: OK (' + searchLatency + 'ms)');
      if (track) {
        console.log('  Test Query: "Fisher - Losing It" -> ' + track.name + ' by ' + track.artists[0].name);
      }
    } else if (searchRes.status === 429) {
      console.log('  Search API: RATE LIMITED (429)');
      console.log('  Retry-After:', searchRes.headers.get('Retry-After') + 's');
    } else {
      console.log('  Search API: ERROR (' + searchRes.status + ')');
    }

  } catch (e) {
    console.log('  Status: FAILED -', e.message);
  }
}

async function main() {
  console.log('DJ Set List Creator - Live Status Check');
  console.log('========================================');
  console.log('Time:', new Date().toISOString());

  await checkSupabase();
  await checkSpotify();

  console.log('\n=== OTHER SERVICES ===');
  console.log('  YouTube API Key:', process.env.YOUTUBE_API_KEY ? 'SET' : 'NOT SET');
  console.log('  ACRCloud:', process.env.ACRCLOUD_ACCESS_KEY ? 'SET' : 'NOT SET');
  console.log('  SoundCloud:', process.env.SOUNDCLOUD_CLIENT_ID ? 'SET' : 'NOT SET');
  console.log('  Cron Secret:', process.env.CRON_SECRET ? 'SET' : 'NOT SET');
  console.log('');
}

main().catch(console.error);
