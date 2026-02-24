// Self-contained audio identification endpoint using ACRCloud
// Now includes custom bucket check for unreleased tracks
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from './_lib/rate-limit.js';

export const config = {
  maxDuration: 60,
};

// Supabase client for tracking unreleased identifications
function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// Create HMAC signature for ACRCloud
function createSignature(stringToSign, secretKey) {
  return crypto.createHmac('sha1', secretKey).update(stringToSign).digest('base64');
}

// Check if bucket is configured
function isBucketConfigured() {
  const cleanEnvVar = (val) => (val || '').replace(/\\n/g, '').replace(/\n/g, '').trim();
  const bucketName = cleanEnvVar(process.env.ACRCLOUD_BUCKET_NAME);
  return Boolean(bucketName);
}

// Send to ACRCloud for identification (main database)
async function identifyWithACRCloud(audioBase64, audioFormat) {
  // Clean env vars - remove whitespace, newlines, and literal \n strings
  const cleanEnvVar = (val) => (val || '').replace(/\\n/g, '').replace(/\n/g, '').trim();

  const accessKey = cleanEnvVar(process.env.ACRCLOUD_ACCESS_KEY);
  const accessSecret = cleanEnvVar(process.env.ACRCLOUD_ACCESS_SECRET);
  const host = cleanEnvVar(process.env.ACRCLOUD_HOST) || 'identify-us-west-2.acrcloud.com';

  if (!accessKey || !accessSecret) {
    throw new Error('ACRCloud credentials not configured');
  }

  console.log(`[Identify] Using host: ${host}`);
  console.log(`[Identify] Key length: ${accessKey.length}, Secret length: ${accessSecret.length}`);

  const httpMethod = 'POST';
  const httpUri = '/v1/identify';
  const dataType = 'audio';
  const signatureVersion = '1';
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const stringToSign = [
    httpMethod,
    httpUri,
    accessKey,
    dataType,
    signatureVersion,
    timestamp,
  ].join('\n');

  const signature = createSignature(stringToSign, accessSecret);

  // Convert base64 to buffer
  const audioBuffer = Buffer.from(audioBase64, 'base64');

  // Create multipart form data manually
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const formData = [];

  const addField = (name, value) => {
    formData.push(`--${boundary}`);
    formData.push(`Content-Disposition: form-data; name="${name}"`);
    formData.push('');
    formData.push(value);
  };

  addField('access_key', accessKey);
  addField('sample_bytes', audioBuffer.length.toString());
  addField('timestamp', timestamp);
  addField('signature', signature);
  addField('data_type', dataType);
  addField('signature_version', signatureVersion);

  // Add audio file
  formData.push(`--${boundary}`);
  formData.push(`Content-Disposition: form-data; name="sample"; filename="audio.${audioFormat}"`);
  formData.push(`Content-Type: audio/${audioFormat}`);
  formData.push('');

  // Combine text parts with audio buffer
  const textPart = formData.join('\r\n') + '\r\n';
  const endPart = `\r\n--${boundary}--\r\n`;

  const bodyBuffer = Buffer.concat([
    Buffer.from(textPart),
    audioBuffer,
    Buffer.from(endPart),
  ]);

  const response = await fetch(`https://${host}${httpUri}`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': bodyBuffer.length.toString(),
    },
    body: bodyBuffer,
  });

  if (!response.ok) {
    throw new Error(`ACRCloud request failed: ${response.status}`);
  }

  return await response.json();
}

// Identify against custom bucket (for unreleased tracks)
async function identifyWithBucket(audioBase64, audioFormat) {
  const cleanEnvVar = (val) => (val || '').replace(/\\n/g, '').replace(/\n/g, '').trim();

  const bucketName = cleanEnvVar(process.env.ACRCLOUD_BUCKET_NAME);
  const accessKey = cleanEnvVar(process.env.ACRCLOUD_BUCKET_ACCESS_KEY) ||
                    cleanEnvVar(process.env.ACRCLOUD_ACCESS_KEY);
  const accessSecret = cleanEnvVar(process.env.ACRCLOUD_BUCKET_ACCESS_SECRET) ||
                       cleanEnvVar(process.env.ACRCLOUD_ACCESS_SECRET);
  const host = cleanEnvVar(process.env.ACRCLOUD_HOST) || 'identify-us-west-2.acrcloud.com';

  if (!bucketName || !accessKey || !accessSecret) {
    return null;
  }

  console.log(`[Identify] Checking custom bucket: ${bucketName}`);

  const httpMethod = 'POST';
  const httpUri = '/v1/identify';
  const dataType = 'audio';
  const signatureVersion = '1';
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const stringToSign = [
    httpMethod,
    httpUri,
    accessKey,
    dataType,
    signatureVersion,
    timestamp,
  ].join('\n');

  const signature = createSignature(stringToSign, accessSecret);
  const audioBuffer = Buffer.from(audioBase64, 'base64');

  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const formData = [];

  const addField = (name, value) => {
    formData.push(`--${boundary}`);
    formData.push(`Content-Disposition: form-data; name="${name}"`);
    formData.push('');
    formData.push(value);
  };

  addField('access_key', accessKey);
  addField('sample_bytes', audioBuffer.length.toString());
  addField('timestamp', timestamp);
  addField('signature', signature);
  addField('data_type', dataType);
  addField('signature_version', signatureVersion);
  addField('bucket_name', bucketName); // Specify custom bucket

  formData.push(`--${boundary}`);
  formData.push(`Content-Disposition: form-data; name="sample"; filename="audio.${audioFormat}"`);
  formData.push(`Content-Type: audio/${audioFormat}`);
  formData.push('');

  const textPart = formData.join('\r\n') + '\r\n';
  const endPart = `\r\n--${boundary}--\r\n`;

  const bodyBuffer = Buffer.concat([
    Buffer.from(textPart),
    audioBuffer,
    Buffer.from(endPart),
  ]);

  try {
    const response = await fetch(`https://${host}${httpUri}`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length.toString(),
      },
      body: bodyBuffer,
    });

    if (!response.ok) {
      console.log(`[Identify] Bucket check failed: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[Identify] Bucket check error:', error);
    return null;
  }
}

// Parse bucket response for unreleased tracks
function parseBucketResponse(response) {
  if (response.status?.code !== 0) {
    return null;
  }

  // Custom bucket results come in custom_files
  const track = response.metadata?.custom_files?.[0];
  if (!track) {
    return null;
  }

  return {
    acrId: track.acrid || track.acr_id, // API returns 'acrid' not 'acr_id'
    title: track.title || 'Unknown',
    artist: track.artists?.map(a => a.name).join(', ') || track.artist || 'Unknown',
    confidence: track.score || 0,
    customFields: track.custom_fields || track.user_defined,
    sourceUrl: track.source_url,
    sourcePlatform: track.source,
  };
}

// Parse ACRCloud response - checks both main DB and custom bucket
function parseACRCloudResponse(response) {
  console.log('[Identify] ACRCloud status code:', response.status?.code);
  console.log('[Identify] ACRCloud status msg:', response.status?.msg);

  if (response.status?.code !== 0) {
    if (response.status?.code === 1001) {
      return { success: true, result: null }; // No match found
    }
    return {
      success: false,
      error: response.status?.msg || 'Unknown error',
      result: null,
      debug: {
        code: response.status?.code,
        msg: response.status?.msg,
        keyPresent: !!process.env.ACRCLOUD_ACCESS_KEY,
        keyPrefix: process.env.ACRCLOUD_ACCESS_KEY?.substring(0, 4) + '...',
      }
    };
  }

  // Check custom bucket first (unreleased tracks)
  const customFile = response.metadata?.custom_files?.[0];
  if (customFile) {
    console.log('[Identify] Found in custom bucket:', customFile.title);
    return {
      success: true,
      source: 'unreleased',
      result: {
        title: customFile.title || 'Unknown Title',
        artist: customFile.artist || 'Unknown Artist',
        confidence: Math.round((customFile.score || 0) * 100) / 100,
        duration: customFile.duration_ms ? Math.floor(customFile.duration_ms / 1000) : undefined,
        isUnreleased: true,
        acrId: customFile.acrid,
        links: {
          source: customFile.source_url,
        },
        sourcePlatform: customFile.source,
      },
    };
  }

  // Check main database (released tracks)
  const music = response.metadata?.music?.[0];
  if (!music) {
    return { success: true, result: null };
  }

  // Extract external links
  const spotifyId = music.external_metadata?.spotify?.track?.id;
  const youtubeId = music.external_metadata?.youtube?.vid;

  return {
    success: true,
    source: 'released',
    result: {
      title: music.title || 'Unknown Title',
      artist: music.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
      album: music.album?.name,
      releaseDate: music.release_date,
      label: music.label,
      confidence: Math.round((music.score || 0) * 100) / 100,
      duration: music.duration_ms ? Math.floor(music.duration_ms / 1000) : undefined,
      links: {
        spotify: spotifyId ? `https://open.spotify.com/track/${spotifyId}` : undefined,
        youtube: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : undefined,
        isrc: music.external_ids?.isrc,
      },
    },
  };
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 15 identify requests per minute per IP
  if (!rateLimit(req, res, { key: 'identify', limit: 15, windowMs: 60_000 })) return;

  try {
    const { audioBase64, audioFormat = 'm4a' } = req.body;

    if (!audioBase64) {
      return res.status(400).json({
        success: false,
        error: 'Audio data is required',
      });
    }

    console.log(`[Identify] Starting audio identification`);
    console.log(`[Identify] Audio format: ${audioFormat}`);
    console.log(`[Identify] Audio size: ${Math.round(audioBase64.length / 1024)} KB`);

    // Debug: Check if env vars are set (don't log actual values)
    const hasKey = !!process.env.ACRCLOUD_ACCESS_KEY;
    const hasSecret = !!process.env.ACRCLOUD_ACCESS_SECRET;
    const keyLength = process.env.ACRCLOUD_ACCESS_KEY?.length || 0;
    console.log(`[Identify] ACRCloud config - hasKey: ${hasKey}, hasSecret: ${hasSecret}, keyLength: ${keyLength}`);

    if (!hasKey || !hasSecret) {
      return res.status(500).json({
        success: false,
        error: 'ACRCloud credentials not configured on server',
        debug: { hasKey, hasSecret }
      });
    }

    // 1. Check main ACRCloud database (released tracks)
    const acrResponse = await identifyWithACRCloud(audioBase64, audioFormat);
    console.log('[Identify] ACRCloud response:', JSON.stringify(acrResponse).substring(0, 500));

    const mainResult = parseACRCloudResponse(acrResponse);

    if (mainResult.result) {
      const supabase = getSupabaseClient();

      // If found as RELEASED in main DB, check if we have it marked as unreleased
      if (mainResult.source === 'released' && supabase) {
        // Try to find matching unreleased track by title/artist similarity
        const titleLower = mainResult.result.title?.toLowerCase() || '';
        const artistLower = mainResult.result.artist?.toLowerCase() || '';

        const { data: possibleMatches } = await supabase
          .from('unreleased_tracks')
          .select('id, title, artist, acrcloud_status')
          .eq('is_active', true)
          .neq('acrcloud_status', 'released_confirmed');

        if (possibleMatches) {
          for (const track of possibleMatches) {
            const trackTitle = track.title?.toLowerCase() || '';
            const trackArtist = track.artist?.toLowerCase() || '';

            // Check for significant overlap in title and artist
            const titleMatch = titleLower.includes(trackTitle) || trackTitle.includes(titleLower);
            const artistMatch = artistLower.includes(trackArtist) || trackArtist.includes(artistLower);

            if (titleMatch && artistMatch && trackTitle.length > 3 && trackArtist.length > 2) {
              console.log(`[Identify] Marking unreleased track as released: ${track.title} by ${track.artist}`);

              await supabase
                .from('unreleased_tracks')
                .update({
                  acrcloud_status: 'released_confirmed',
                  metadata: {
                    released_title: mainResult.result.title,
                    released_artist: mainResult.result.artist,
                    released_album: mainResult.result.album,
                    released_date: mainResult.result.releaseDate,
                    confirmed_at: new Date().toISOString(),
                  },
                })
                .eq('id', track.id);

              // Add note to response
              mainResult.result.wasUnreleased = true;
              break;
            }
          }
        }
      }

      // Track unreleased identification stats if it's from the bucket
      if (mainResult.source === 'unreleased' && mainResult.result.acrId && supabase) {
        const { data: unreleasedTrack } = await supabase
          .from('unreleased_tracks')
          .select('id, times_identified')
          .eq('acrcloud_acr_id', mainResult.result.acrId)
          .single();

        if (unreleasedTrack) {
          await supabase
            .from('unreleased_tracks')
            .update({
              times_identified: (unreleasedTrack.times_identified || 0) + 1,
              last_identified_at: new Date().toISOString(),
            })
            .eq('id', unreleasedTrack.id);

          await supabase
            .from('unreleased_identifications')
            .insert({
              unreleased_track_id: unreleasedTrack.id,
              confidence: mainResult.result.confidence,
            });
        }
      }

      return res.status(200).json(mainResult);
    }

    // 2. Fallback: Check custom bucket separately if not already found
    if (isBucketConfigured()) {
      console.log('[Identify] No main DB match, checking custom bucket...');
      const bucketResponse = await identifyWithBucket(audioBase64, audioFormat);

      if (bucketResponse) {
        const bucketResult = parseBucketResponse(bucketResponse);

        if (bucketResult) {
          console.log(`[Identify] Found in bucket: ${bucketResult.artist} - ${bucketResult.title}`);

          // Get source info from database if available
          let sourceUrl = null;
          let sourcePlatform = null;
          const supabase = getSupabaseClient();

          if (supabase && bucketResult.acrId) {
            const { data: unreleasedTrack } = await supabase
              .from('unreleased_tracks')
              .select('id, source_url, source_platform, times_identified')
              .eq('acrcloud_acr_id', bucketResult.acrId)
              .single();

            if (unreleasedTrack) {
              sourceUrl = unreleasedTrack.source_url;
              sourcePlatform = unreleasedTrack.source_platform;

              // Increment identification count
              await supabase
                .from('unreleased_tracks')
                .update({
                  times_identified: (unreleasedTrack.times_identified || 0) + 1,
                  last_identified_at: new Date().toISOString(),
                })
                .eq('id', unreleasedTrack.id);

              // Record identification
              await supabase
                .from('unreleased_identifications')
                .insert({
                  unreleased_track_id: unreleasedTrack.id,
                  confidence: bucketResult.confidence,
                });
            }
          }

          return res.status(200).json({
            success: true,
            source: 'unreleased',
            result: {
              title: bucketResult.title,
              artist: bucketResult.artist,
              confidence: Math.round(bucketResult.confidence * 100) / 100,
              isUnreleased: true,
              acrId: bucketResult.acrId,
              links: {
                source: sourceUrl || bucketResult.sourceUrl,
              },
              sourcePlatform: sourcePlatform || bucketResult.sourcePlatform,
            },
          });
        }
      }
    }

    // No match in either database
    return res.status(200).json({
      ...mainResult,
      source: mainResult.result ? 'released' : null,
    });
  } catch (error) {
    console.error('[Identify] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to identify track',
    });
  }
}
