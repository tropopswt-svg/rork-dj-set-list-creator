// API endpoint to enrich tracks/artists with MusicBrainz metadata
// POST /api/musicbrainz-enrich
// Free API, no key needed — 1 req/sec rate limit handled internally
// Useful for: label info, catalog numbers, genres/tags, ISRC lookups, disambiguation

import { searchRecording, searchRelease, lookupByISRC, searchArtist } from './_lib/musicbrainz-core.js';

// Supabase client (reuse pattern from spotify-enrich)
function getSupabaseClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  // Dynamic import would be ideal, but for Vercel serverless, we use the global
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ready',
      description: 'POST to enrich tracks/artists with MusicBrainz metadata. Free API, no key needed.',
      actions: ['lookup-track', 'lookup-isrc', 'lookup-artist', 'enrich-batch', 'enrich-artists'],
      usage: {
        'lookup-track': '{ "action": "lookup-track", "artist": "...", "title": "..." }',
        'lookup-isrc': '{ "action": "lookup-isrc", "isrc": "..." }',
        'lookup-artist': '{ "action": "lookup-artist", "name": "..." }',
        'enrich-batch': '{ "action": "enrich-batch", "limit": 20 }',
        'enrich-artists': '{ "action": "enrich-artists", "limit": 30 }',
      },
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action = 'lookup-track', artist, title, name, isrc, limit = 20 } = req.body || {};

    // === Single track lookup ===
    if (action === 'lookup-track') {
      if (!artist || !title) {
        return res.status(400).json({ error: 'artist and title required' });
      }
      const result = await searchRecording(artist, title);
      return res.status(200).json({ success: !!result, data: result });
    }

    // === ISRC lookup ===
    if (action === 'lookup-isrc') {
      if (!isrc) {
        return res.status(400).json({ error: 'isrc required' });
      }
      const result = await lookupByISRC(isrc);
      return res.status(200).json({ success: !!result, data: result });
    }

    // === Artist lookup ===
    if (action === 'lookup-artist') {
      if (!name) {
        return res.status(400).json({ error: 'name required' });
      }
      const result = await searchArtist(name);
      return res.status(200).json({ success: !!result, data: result });
    }

    // === Batch enrich — find tracks in DB missing MusicBrainz data ===
    if (action === 'enrich-batch') {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Database not configured' });
      }

      // Find tracks that have no label info (not yet enriched from MusicBrainz)
      // We use the metadata JSONB column to store MB data
      const { data: tracks, error } = await supabase
        .from('tracks')
        .select('id, title, artist, isrc, metadata')
        .is('metadata->musicbrainz_mbid', null)
        .not('artist', 'is', null)
        .not('title', 'is', null)
        .limit(Math.min(limit, 50)); // Cap at 50 to respect rate limits

      if (error) {
        return res.status(500).json({ error: 'Database query failed', details: error.message });
      }

      if (!tracks?.length) {
        return res.status(200).json({ success: true, message: 'No tracks to enrich', enriched: 0 });
      }

      let enriched = 0;
      const results = [];

      for (const track of tracks) {
        try {
          let mbData = null;

          // Try ISRC first (exact match)
          if (track.isrc) {
            mbData = await lookupByISRC(track.isrc);
          }

          // Fall back to artist + title search
          if (!mbData && track.artist && track.title) {
            mbData = await searchRecording(track.artist, track.title);
          }

          if (mbData) {
            // Merge MusicBrainz data into existing metadata
            const existingMetadata = track.metadata || {};
            const updatedMetadata = {
              ...existingMetadata,
              musicbrainz_mbid: mbData.mbid,
              musicbrainz_label: mbData.label,
              musicbrainz_catalog: mbData.catalogNumber,
              musicbrainz_tags: mbData.tags,
              musicbrainz_release: mbData.releaseTitle,
              musicbrainz_release_date: mbData.releaseDate,
              musicbrainz_country: mbData.releaseCountry,
              musicbrainz_enriched_at: new Date().toISOString(),
            };

            const { error: updateError } = await supabase
              .from('tracks')
              .update({ metadata: updatedMetadata })
              .eq('id', track.id);

            if (!updateError) {
              enriched++;
              results.push({
                id: track.id,
                artist: track.artist,
                title: track.title,
                label: mbData.label,
                tags: mbData.tags?.slice(0, 3),
              });
            }
          }
        } catch {
          // Continue on individual track failure
        }
      }

      return res.status(200).json({
        success: true,
        enriched,
        total: tracks.length,
        results,
      });
    }

    // === Batch enrich artist genres from MusicBrainz ===
    if (action === 'enrich-artists') {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Database not configured' });
      }

      // Find artists with no genres populated
      const { data: artists, error } = await supabase
        .from('artists')
        .select('id, name, genres')
        .or('genres.is.null,genres.eq.{}')
        .limit(Math.min(limit, 30)); // Cap at 30 (1 req/sec ≈ 33s, within 60s limit)

      if (error) {
        return res.status(500).json({ error: 'Database query failed', details: error.message });
      }

      if (!artists?.length) {
        return res.status(200).json({ success: true, message: 'No artists to enrich', enriched: 0 });
      }

      let enriched = 0;
      const results = [];

      for (const artist of artists) {
        try {
          const mbData = await searchArtist(artist.name);

          // Combine MusicBrainz genres + tags into a single deduped list
          const mbGenres = [
            ...(mbData?.genres || []),
            ...(mbData?.tags || []).map(t => typeof t === 'string' ? t : t.name),
          ];
          const existingGenres = artist.genres || [];
          const merged = [...new Set([...existingGenres, ...mbGenres])].slice(0, 10);

          // If MusicBrainz returned nothing, set empty array to prevent re-processing
          const updatedGenres = merged.length > 0 ? merged : [];

          const { error: updateError } = await supabase
            .from('artists')
            .update({ genres: updatedGenres })
            .eq('id', artist.id);

          if (!updateError) {
            enriched++;
            results.push({
              id: artist.id,
              name: artist.name,
              genres: updatedGenres,
            });
          }
        } catch {
          // Continue on individual artist failure
        }
      }

      return res.status(200).json({
        success: true,
        enriched,
        total: artists.length,
        results,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
