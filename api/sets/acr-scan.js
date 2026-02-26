// API endpoint to submit a set's audio URL to ACRCloud File Scanning
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 5 submits per minute per IP
  if (!rateLimit(req, res, { key: 'acr-scan', limit: 5, windowMs: 60_000 })) return;

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
    const { setId } = req.body;

    if (!setId) {
      return res.status(400).json({ error: 'setId is required' });
    }

    // Fetch set to get audio URL and current scan status
    const { data: set, error: setError } = await supabase
      .from('sets')
      .select('id, youtube_url, soundcloud_url, acr_scan_status, acr_scan_task_id, acr_scan_submitted_at')
      .eq('id', setId)
      .single();

    if (setError || !set) {
      return res.status(404).json({ error: 'Set not found' });
    }

    // Guard: don't re-submit if already in progress and < 30 min old
    if (
      (set.acr_scan_status === 'submitted' || set.acr_scan_status === 'processing') &&
      set.acr_scan_submitted_at
    ) {
      const submittedAt = new Date(set.acr_scan_submitted_at).getTime();
      const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
      if (submittedAt > thirtyMinAgo) {
        return res.status(200).json({
          success: true,
          status: set.acr_scan_status,
          taskId: set.acr_scan_task_id,
          message: 'Scan already in progress',
        });
      }
    }

    // Pick the best available URL (prefer YouTube)
    const audioUrl = set.youtube_url || set.soundcloud_url;
    if (!audioUrl) {
      return res.status(400).json({ error: 'Set has no YouTube or SoundCloud URL' });
    }

    console.log(`[ACR Scan] Submitting set ${setId} with URL: ${audioUrl}`);

    // Submit to ACRCloud File Scanning API
    const acrResponse = await fetch(
      `https://api-us-west-2.acrcloud.com/api/fs-containers/${containerId}/files`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data_type: 'platforms',
          url: audioUrl,
        }),
      }
    );

    const acrData = await acrResponse.json();

    if (!acrResponse.ok) {
      console.error('[ACR Scan] Submit failed:', acrData);

      // Store error in DB
      await supabase
        .from('sets')
        .update({
          acr_scan_status: 'failed',
          acr_scan_error: acrData.message || `HTTP ${acrResponse.status}`,
        })
        .eq('id', setId);

      return res.status(502).json({
        error: 'ACRCloud submission failed',
        detail: acrData.message || `HTTP ${acrResponse.status}`,
      });
    }

    // Extract task ID from response
    const taskId = acrData.data?.id || acrData.id;
    if (!taskId) {
      console.error('[ACR Scan] No task ID in response:', acrData);
      return res.status(502).json({ error: 'No task ID returned from ACRCloud' });
    }

    console.log(`[ACR Scan] Task created: ${taskId}`);

    // Update set with scan state
    await supabase
      .from('sets')
      .update({
        acr_scan_status: 'submitted',
        acr_scan_task_id: String(taskId),
        acr_scan_submitted_at: new Date().toISOString(),
        acr_scan_error: null,
        acr_scan_result: null,
      })
      .eq('id', setId);

    return res.status(200).json({
      success: true,
      status: 'submitted',
      taskId: String(taskId),
    });

  } catch (error) {
    console.error('[ACR Scan] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit scan' });
  }
}
