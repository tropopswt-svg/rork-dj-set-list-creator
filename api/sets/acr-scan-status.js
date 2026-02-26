// API endpoint to check ACRCloud File Scanning status and return deduplicated tracks
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '../_lib/rate-limit.js';

export const config = {
  maxDuration: 60,
};

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// Format seconds to timestamp string (e.g., 3661 -> "1:01:01")
function formatTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Deduplicate segments: DJs don't play the same track twice in a set,
// so ALL segments with the same acrid collapse into one entry (first occurrence wins).
//
// ACRCloud response format: results.music[] where each entry has
// { offset, played_duration, result: { acrid, title, artists[], ... } }
function deduplicateSegments(segments) {
  if (!segments || segments.length === 0) return [];

  // Sort by offset (position in mix, in seconds)
  const sorted = [...segments].sort((a, b) => (a.offset || 0) - (b.offset || 0));

  const seen = new Set();   // acrids we've already added
  const tracks = [];

  for (const seg of sorted) {
    // Each segment's track data is in seg.result (not seg.result.music)
    const r = seg.result || {};
    const acrId = r.acrid || r.acr_id;
    if (!acrId) continue;

    // Skip if we've already seen this track anywhere in the set
    if (seen.has(acrId)) continue;
    seen.add(acrId);

    const artists = r.artists?.map(a => a.name).join(', ') || 'Unknown';
    const title = r.title || 'Unknown';
    const offsetSeconds = seg.offset || 0;

    // Extract external metadata
    const spotifyId = r.external_metadata?.spotify?.track?.id;
    const isrc = r.external_ids?.isrc;

    tracks.push({
      title,
      artist: artists,
      timestamp: offsetSeconds,
      timestampFormatted: formatTimestamp(offsetSeconds),
      confidence: r.score || 0,
      acrId,
      spotifyId: spotifyId || null,
      isrc: isrc || null,
    });
  }

  return tracks;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 30 polls per minute per IP (allows frequent polling)
  if (!rateLimit(req, res, { key: 'acr-scan-status', limit: 30, windowMs: 60_000 })) return;

  const containerId = (process.env.ACRCLOUD_FS_CONTAINER_ID || '').trim();
  const bearerToken = (process.env.ACRCLOUD_BEARER_TOKEN || '').trim();

  if (!containerId || !bearerToken) {
    return res.status(500).json({ error: 'ACRCloud File Scanning not configured' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const { setId } = req.query;

    if (!setId) {
      return res.status(400).json({ error: 'setId query parameter is required' });
    }

    // Fetch current scan state
    const { data: set, error: setError } = await supabase
      .from('sets')
      .select('id, acr_scan_status, acr_scan_task_id, acr_scan_result, acr_scan_error')
      .eq('id', setId)
      .single();

    if (setError || !set) {
      return res.status(404).json({ error: 'Set not found' });
    }

    if (!set.acr_scan_task_id) {
      return res.status(400).json({ error: 'No scan has been submitted for this set' });
    }

    // If already completed or failed, return cached result
    if (set.acr_scan_status === 'completed') {
      const cachedTracks = set.acr_scan_result?.tracks || [];
      return res.status(200).json({
        success: true,
        status: 'completed',
        tracks: cachedTracks,
        rawSegmentCount: set.acr_scan_result?.rawSegmentCount || 0,
        deduplicatedTrackCount: cachedTracks.length,
      });
    }

    if (set.acr_scan_status === 'failed') {
      return res.status(200).json({
        success: false,
        status: 'failed',
        error: set.acr_scan_error || 'Scan failed',
      });
    }

    // Poll ACRCloud for current status
    console.log(`[ACR Scan Status] Polling task ${set.acr_scan_task_id}`);

    const acrResponse = await fetch(
      `https://api-us-west-2.acrcloud.com/api/fs-containers/${containerId}/files/${set.acr_scan_task_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
        },
      }
    );

    if (!acrResponse.ok) {
      console.error(`[ACR Scan Status] Poll failed: ${acrResponse.status}`);
      return res.status(502).json({
        error: 'Failed to poll ACRCloud',
        status: set.acr_scan_status,
      });
    }

    const acrData = await acrResponse.json();
    const fileState = acrData.data?.state ?? acrData.state;

    console.log(`[ACR Scan Status] ACRCloud state: ${fileState}`);

    // Map ACRCloud states:
    //  0 = processing, 1 = completed with results,
    // -1 = completed no results, -2/-3 = failed
    if (fileState === 0) {
      // Still processing
      if (set.acr_scan_status !== 'processing') {
        await supabase
          .from('sets')
          .update({ acr_scan_status: 'processing' })
          .eq('id', setId);
      }

      return res.status(200).json({
        success: true,
        status: 'processing',
      });
    }

    if (fileState === 1) {
      // Completed with results — deduplicate segments
      // ACRCloud nests segments under results.music[]
      const resultsObj = acrData.data?.results || acrData.results || {};
      const segments = Array.isArray(resultsObj) ? resultsObj : (resultsObj.music || []);
      const rawSegmentCount = segments.length;
      const tracks = deduplicateSegments(segments);

      console.log(`[ACR Scan Status] ${rawSegmentCount} segments → ${tracks.length} deduplicated tracks`);

      // Cache result in DB
      await supabase
        .from('sets')
        .update({
          acr_scan_status: 'completed',
          acr_scan_completed_at: new Date().toISOString(),
          acr_scan_error: null,
          acr_scan_result: { tracks, rawSegmentCount },
        })
        .eq('id', setId);

      return res.status(200).json({
        success: true,
        status: 'completed',
        tracks,
        rawSegmentCount,
        deduplicatedTrackCount: tracks.length,
      });
    }

    if (fileState === -1) {
      // Completed but no results found
      await supabase
        .from('sets')
        .update({
          acr_scan_status: 'completed',
          acr_scan_completed_at: new Date().toISOString(),
          acr_scan_error: null,
          acr_scan_result: { tracks: [], rawSegmentCount: 0 },
        })
        .eq('id', setId);

      return res.status(200).json({
        success: true,
        status: 'completed',
        tracks: [],
        rawSegmentCount: 0,
        deduplicatedTrackCount: 0,
      });
    }

    // -2, -3, or other negative = failed
    const errorMsg = acrData.data?.error || acrData.error || `Scan failed (state: ${fileState})`;
    console.error(`[ACR Scan Status] Failed:`, errorMsg);

    await supabase
      .from('sets')
      .update({
        acr_scan_status: 'failed',
        acr_scan_error: errorMsg,
      })
      .eq('id', setId);

    return res.status(200).json({
      success: false,
      status: 'failed',
      error: errorMsg,
    });

  } catch (error) {
    console.error('[ACR Scan Status] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to check scan status' });
  }
}
