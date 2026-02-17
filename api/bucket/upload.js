/**
 * API endpoint to upload unreleased tracks to ACRCloud bucket
 *
 * POST /api/bucket/upload
 * Body: { sourceUrl, title, artist, platform, audioBase64?, audioFormat? }
 *
 * Two modes:
 * 1. With audioBase64: Directly upload the audio data
 * 2. Without audioBase64: Create DB entry with pending status (for scraper to process)
 */

import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 120, // Allow 2 minutes for large uploads
};

// Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// ACRCloud bucket config (Console API v2 with Bearer token)
function getBucketConfig() {
  const cleanEnvVar = (val) => (val || '').replace(/\\n/g, '').replace(/\n/g, '').trim();
  return {
    bucketId: cleanEnvVar(process.env.ACRCLOUD_BUCKET_NAME),
    bearerToken: cleanEnvVar(process.env.ACRCLOUD_BEARER_TOKEN),
    consoleHost: 'api-v2.acrcloud.com',
  };
}

// Upload audio to ACRCloud bucket using Console API v2
async function uploadToACRCloud(audioBuffer, metadata, audioFormat) {
  const config = getBucketConfig();

  if (!config.bucketId || !config.bearerToken) {
    throw new Error('ACRCloud bucket credentials not configured (need ACRCLOUD_BUCKET_NAME and ACRCLOUD_BEARER_TOKEN)');
  }

  // Build multipart form data
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  const formParts = [];

  const addTextField = (name, value) => {
    formParts.push(`--${boundary}\r\n`);
    formParts.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
    formParts.push(`${value}\r\n`);
  };

  // Required fields for Console API v2
  addTextField('title', metadata.title);
  addTextField('data_type', 'audio');

  // User-defined metadata as JSON
  const userDefined = {
    artist: metadata.artist,
    source_platform: metadata.sourcePlatform || 'manual',
    source_url: metadata.sourceUrl || '',
    db_track_id: metadata.dbTrackId || '',
  };
  addTextField('user_defined', JSON.stringify(userDefined));

  // Audio file
  formParts.push(`--${boundary}\r\n`);
  formParts.push(`Content-Disposition: form-data; name="file"; filename="track.${audioFormat}"\r\n`);
  formParts.push(`Content-Type: audio/${audioFormat}\r\n\r\n`);
  formParts.push(audioBuffer);
  formParts.push(`\r\n--${boundary}--\r\n`);

  // Combine into buffer
  const bodyParts = formParts.map(part => typeof part === 'string' ? Buffer.from(part) : part);
  const bodyBuffer = Buffer.concat(bodyParts);

  console.log(`[Bucket Upload] Uploading: ${metadata.artist} - ${metadata.title}`);
  console.log(`[Bucket Upload] Audio size: ${Math.round(audioBuffer.length / 1024)} KB`);

  const url = `https://${config.consoleHost}/api/buckets/${config.bucketId}/files`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.bearerToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: bodyBuffer,
  });

  const responseText = await response.text();
  console.log(`[Bucket Upload] Response: ${response.status} - ${responseText.substring(0, 300)}`);

  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(`Invalid response: ${responseText.substring(0, 200)}`);
  }

  if (response.ok && result.data?.acr_id) {
    return {
      success: true,
      acrId: result.data.acr_id,
    };
  }

  throw new Error(result.message || result.error || `Upload failed: HTTP ${response.status}`);
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const {
      sourceUrl,
      title,
      artist,
      platform = 'manual',
      sourceUser,
      sourcePostDate,
      audioBase64,
      audioFormat = 'mp3',
      audioDuration,
      audioQuality,
      metadata: extraMetadata,
    } = req.body;

    // Validate required fields
    if (!sourceUrl) {
      return res.status(400).json({ error: 'sourceUrl is required' });
    }
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!artist) {
      return res.status(400).json({ error: 'artist is required' });
    }

    const validPlatforms = ['soundcloud', 'instagram', 'tiktok', 'manual'];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ error: `platform must be one of: ${validPlatforms.join(', ')}` });
    }

    // Check if track already exists by source URL
    const { data: existing } = await supabase
      .from('unreleased_tracks')
      .select('id, acrcloud_status, acrcloud_acr_id')
      .eq('source_url', sourceUrl)
      .single();

    if (existing) {
      return res.status(409).json({
        error: 'Track with this source URL already exists',
        trackId: existing.id,
        status: existing.acrcloud_status,
        acrId: existing.acrcloud_acr_id,
      });
    }

    // Create database entry
    const trackData = {
      title,
      artist,
      source_platform: platform,
      source_url: sourceUrl,
      source_user: sourceUser || null,
      source_post_date: sourcePostDate || null,
      audio_duration_seconds: audioDuration || null,
      audio_quality: audioQuality || null,
      acrcloud_status: 'pending',
      metadata: extraMetadata || {},
    };

    const { data: track, error: insertError } = await supabase
      .from('unreleased_tracks')
      .insert(trackData)
      .select()
      .single();

    if (insertError) {
      console.error('[Bucket Upload] DB insert error:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    console.log(`[Bucket Upload] Created track entry: ${track.id}`);

    // If audio data is provided, upload to ACRCloud
    if (audioBase64) {
      try {
        const audioBuffer = Buffer.from(audioBase64, 'base64');

        const uploadResult = await uploadToACRCloud(
          audioBuffer,
          {
            title,
            artist,
            sourcePlatform: platform,
            sourceUrl: sourceUrl,
            dbTrackId: track.id,
          },
          audioFormat
        );

        // Update track with ACRCloud ID
        const { error: updateError } = await supabase
          .from('unreleased_tracks')
          .update({
            acrcloud_acr_id: uploadResult.acrId,
            acrcloud_status: 'uploaded',
            fingerprint_created_at: new Date().toISOString(),
          })
          .eq('id', track.id);

        if (updateError) {
          console.error('[Bucket Upload] DB update error:', updateError);
        }

        return res.status(200).json({
          success: true,
          trackId: track.id,
          acrId: uploadResult.acrId,
          status: 'uploaded',
          message: 'Track uploaded to ACRCloud bucket',
        });

      } catch (uploadError) {
        console.error('[Bucket Upload] ACRCloud upload error:', uploadError);

        // Mark as failed in DB
        await supabase
          .from('unreleased_tracks')
          .update({
            acrcloud_status: 'failed',
            metadata: {
              ...trackData.metadata,
              lastError: uploadError.message,
              lastErrorAt: new Date().toISOString(),
            },
          })
          .eq('id', track.id);

        return res.status(500).json({
          success: false,
          trackId: track.id,
          status: 'failed',
          error: uploadError.message,
        });
      }
    }

    // No audio provided - track is created with pending status
    return res.status(201).json({
      success: true,
      trackId: track.id,
      status: 'pending',
      message: 'Track entry created. Upload audio separately or use scraper to process.',
    });

  } catch (error) {
    console.error('[Bucket Upload] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
