/**
 * POST /api/deezer-enrich
 *
 * Enrich tracks in the database using Deezer's free public API.
 * Primary use case: validate tracks that Spotify couldn't confirm.
 *
 * Actions:
 *   re-validate  — check set_tracks with is_unreleased=true against Deezer
 *                  (exact/strong match → flip is_unreleased=false + store full metadata)
 *   enrich-set   — run Deezer on all tracks in a specific set (skips already-enriched)
 *   enrich-batch — run Deezer on unenriched tracks globally (limit param)
 *   check-one    — check a single artist+title pair (for testing/UI)
 *
 * Body: { action, setId?, limit?, artist?, title? }
 *
 * Match confidence:
 *   'exact'  → identical normalized title + artist → is_unreleased = false
 *   'strong' → substring match → is_unreleased = false
 *   null     → no match → status unchanged
 *
 * No API key required — Deezer's /search endpoint is public.
 * Rate limit: ~50 requests per 5 seconds (enforced here conservatively).
 */

import { getSupabaseClient } from './_lib/spotify-core.js';
import { searchDeezerTrack, isDjEditTitle } from './_lib/deezer-core.js';

export const config = { maxDuration: 120 };

const DELAY_MS = 200; // Conservative ~5 req/sec (well under Deezer's 50/5s limit)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ready',
      description: 'Enrich/validate tracks using Deezer public API (no auth required).',
      actions: ['re-validate', 'enrich-set', 'enrich-batch', 'check-one'],
      usage: {
        're-validate': '{ "action": "re-validate", "limit": 100 } — flip is_unreleased tracks that Deezer can confirm',
        'enrich-set':  '{ "action": "enrich-set", "setId": "uuid" } — enrich all tracks in a set',
        'enrich-batch':'{ "action": "enrich-batch", "limit": 50 } — enrich unenriched tracks globally',
        'check-one':   '{ "action": "check-one", "artist": "...", "title": "..." } — single lookup',
      },
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { action = 'enrich-batch', setId, limit = 50, artist, title } = req.body || {};

  // ── CHECK-ONE ──────────────────────────────────────────────────────────────
  if (action === 'check-one') {
    if (!artist || !title) {
      return res.status(400).json({ error: 'artist and title are required for check-one' });
    }
    const result = await searchDeezerTrack(artist, title);
    return res.status(200).json({
      success: true,
      query: { artist, title },
      match: result,
    });
  }

  // ── RE-VALIDATE ────────────────────────────────────────────────────────────
  // Check tracks marked as unreleased (Spotify miss) against Deezer.
  // Exact/strong Deezer match → flip to released with full metadata.
  if (action === 're-validate') {
    let query = supabase
      .from('set_tracks')
      .select('id, artist_name, track_title, spotify_data')
      .eq('is_unreleased', true)
      .eq('is_id', false)
      .not('artist_name', 'is', null)
      .not('track_title', 'is', null)
      .neq('track_title', 'ID')
      .neq('track_title', 'Unknown')
      // Skip tracks where we already have a confirmed Deezer match
      .not('spotify_data->deezer_confidence', 'in', '("exact","strong")')
      .limit(parseInt(limit));

    if (setId) query = query.eq('set_id', setId);

    const { data: tracks, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const stats = { checked: 0, confirmed: 0, noMatch: 0, errors: 0 };
    const confirmed = [];

    for (const track of tracks || []) {
      if (!track.artist_name || !track.track_title) { stats.errors++; continue; }

      // Skip DJ edits — they're often unreleased tools, not commercially released tracks
      if (isDjEditTitle(track.track_title)) {
        stats.errors++; // reuse errors counter as "skipped"
        continue;
      }

      try {
        await new Promise(r => setTimeout(r, DELAY_MS));
        const match = await searchDeezerTrack(track.artist_name, track.track_title);
        stats.checked++;

        if (match && (match.confidence === 'exact' || match.confidence === 'strong')) {
          const deezerData = buildDeezerData(match, track.spotify_data);
          await supabase
            .from('set_tracks')
            .update({ spotify_data: deezerData, is_unreleased: false })
            .eq('id', track.id);

          stats.confirmed++;
          confirmed.push({
            track: `${track.artist_name} - ${track.track_title}`,
            matched: `${match.artist} - ${match.title}`,
            confidence: match.confidence,
            albumArt: !!match.albumArtUrl,
          });
        } else {
          stats.noMatch++;
        }
      } catch (err) {
        console.error(`[deezer-enrich] Error on ${track.artist_name} - ${track.track_title}:`, err.message);
        stats.errors++;
      }
    }

    return res.status(200).json({
      success: true,
      action: 're-validate',
      stats,
      confirmed: confirmed.slice(0, 50), // cap response size
    });
  }

  // ── ENRICH-SET ─────────────────────────────────────────────────────────────
  if (action === 'enrich-set') {
    if (!setId) return res.status(400).json({ error: 'setId is required for enrich-set' });

    const { data: tracks, error } = await supabase
      .from('set_tracks')
      .select('id, artist_name, track_title, spotify_data, is_unreleased')
      .eq('set_id', setId)
      .eq('is_id', false)
      .not('artist_name', 'is', null)
      .not('track_title', 'is', null)
      .order('position');

    if (error) return res.status(500).json({ error: error.message });

    const stats = { checked: 0, enriched: 0, skipped: 0, noMatch: 0 };
    const results = [];

    for (const track of tracks || []) {
      // Skip if already has a confirmed Deezer or Spotify match
      if (track.spotify_data?.spotify_id) { stats.skipped++; continue; }
      if (track.spotify_data?.deezer_id && ['exact', 'strong'].includes(track.spotify_data?.deezer_confidence)) {
        stats.skipped++; continue;
      }
      if (!track.artist_name || !track.track_title) { stats.skipped++; continue; }
      // Skip DJ edits — they're often unreleased tools
      if (isDjEditTitle(track.track_title)) { stats.skipped++; continue; }

      try {
        await new Promise(r => setTimeout(r, DELAY_MS));
        const match = await searchDeezerTrack(track.artist_name, track.track_title);
        stats.checked++;

        if (match) {
          const deezerData = buildDeezerData(match, track.spotify_data);
          const isConfirmed = match.confidence === 'exact' || match.confidence === 'strong';
          await supabase
            .from('set_tracks')
            .update({
              spotify_data: deezerData,
              is_unreleased: isConfirmed ? false : track.is_unreleased,
            })
            .eq('id', track.id);

          stats.enriched++;
          results.push({
            track: `${track.artist_name} - ${track.track_title}`,
            matched: `${match.artist} - ${match.title}`,
            confidence: match.confidence,
            flippedToReleased: isConfirmed,
          });
        } else {
          stats.noMatch++;
        }
      } catch (err) {
        console.error(`[deezer-enrich] Error:`, err.message);
      }
    }

    return res.status(200).json({
      success: true,
      action: 'enrich-set',
      setId,
      stats,
      results: results.slice(0, 50),
    });
  }

  // ── ENRICH-BATCH ───────────────────────────────────────────────────────────
  if (action === 'enrich-batch') {
    const { data: tracks, error } = await supabase
      .from('set_tracks')
      .select('id, artist_name, track_title, spotify_data')
      .eq('is_id', false)
      .is('spotify_data', null)
      .not('artist_name', 'is', null)
      .not('track_title', 'is', null)
      .neq('track_title', 'ID')
      .neq('track_title', 'Unknown')
      .limit(parseInt(limit));

    if (error) return res.status(500).json({ error: error.message });

    const stats = { checked: 0, enriched: 0, noMatch: 0 };
    const results = [];

    for (const track of tracks || []) {
      // Skip DJ edits — they're often unreleased tools
      if (!track.artist_name || !track.track_title) continue;
      if (isDjEditTitle(track.track_title)) { stats.noMatch++; continue; }

      try {
        await new Promise(r => setTimeout(r, DELAY_MS));
        const match = await searchDeezerTrack(track.artist_name, track.track_title);
        stats.checked++;

        if (match) {
          const deezerData = buildDeezerData(match, null);
          const isConfirmed = match.confidence === 'exact' || match.confidence === 'strong';
          await supabase
            .from('set_tracks')
            .update({
              spotify_data: deezerData,
              is_unreleased: !isConfirmed,
            })
            .eq('id', track.id);

          stats.enriched++;
          results.push({
            track: `${track.artist_name} - ${track.track_title}`,
            matched: `${match.artist} - ${match.title}`,
            confidence: match.confidence,
          });
        } else {
          stats.noMatch++;
        }
      } catch (err) {
        console.error(`[deezer-enrich] Error:`, err.message);
      }
    }

    return res.status(200).json({
      success: true,
      action: 'enrich-batch',
      stats,
      results: results.slice(0, 50),
    });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

/**
 * Build the spotify_data JSONB object from a Deezer match.
 * Merges with any existing data so we don't lose Spotify fields.
 */
function buildDeezerData(match, existing) {
  return {
    ...(existing || {}),
    // Full Deezer metadata
    title: match.title,
    artist: match.artist,
    album: match.album,
    album_art_url: match.albumArtUrl || existing?.album_art_url,
    album_art_small: match.albumArtSmall || existing?.album_art_small,
    preview_url: match.previewUrl || existing?.preview_url,
    deezer_preview_url: match.previewUrl,
    deezer_id: match.deezerId,
    deezer_url: match.deezerUrl,
    isrc: match.isrc || existing?.isrc,
    release_date: match.releaseDate || existing?.release_date,
    duration_ms: match.duration ? match.duration * 1000 : existing?.duration_ms,
    source: existing?.spotify_id ? existing.source : 'deezer',
    deezer_confidence: match.confidence,
  };
}
