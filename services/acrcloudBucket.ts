/**
 * ACRCloud Custom Bucket Service
 *
 * Handles uploading unreleased/ID tracks to ACRCloud custom bucket
 * for fingerprinting and later identification.
 *
 * Uses two APIs:
 * - Console API v2 (api-v2.acrcloud.com) - Bearer token auth for bucket management
 * - Identification API (identify-*.acrcloud.com) - HMAC signature auth for recognition
 */

import crypto from 'crypto';

// Environment configuration
const getBucketConfig = () => {
  const cleanEnvVar = (val: string | undefined) =>
    (val || '').replace(/\\n/g, '').replace(/\n/g, '').trim();

  return {
    bucketId: cleanEnvVar(process.env.ACRCLOUD_BUCKET_NAME), // Bucket ID (e.g., "29490")
    bearerToken: cleanEnvVar(process.env.ACRCLOUD_BEARER_TOKEN), // Personal Access Token
    accessKey: cleanEnvVar(process.env.ACRCLOUD_ACCESS_KEY), // For identification
    accessSecret: cleanEnvVar(process.env.ACRCLOUD_ACCESS_SECRET), // For identification
    identifyHost: cleanEnvVar(process.env.ACRCLOUD_HOST) || 'identify-us-west-2.acrcloud.com',
    consoleHost: 'api-v2.acrcloud.com',
  };
};

// Types
export interface TrackMetadata {
  title: string;
  artist: string;
  album?: string;
  releaseDate?: string;
  label?: string;
  genres?: string[];
  isrc?: string;
  upc?: string;
  duration?: number;
  customFields?: Record<string, string>;
}

export interface UploadResult {
  success: boolean;
  acrId?: string;
  error?: string;
  message?: string;
}

export interface TrackStatus {
  acrId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
}

export interface BucketTrack {
  acrId: string;
  title: string;
  artist: string;
  album?: string;
  createdAt: string;
  state: number;
}

/**
 * Create HMAC signature for ACRCloud Identification API
 */
function createSignature(
  httpMethod: string,
  httpUri: string,
  accessKey: string,
  accessSecret: string,
  dataType: string,
  timestamp: string
): string {
  const signatureVersion = '1';
  const stringToSign = [
    httpMethod,
    httpUri,
    accessKey,
    dataType,
    signatureVersion,
    timestamp,
  ].join('\n');

  return crypto
    .createHmac('sha1', accessSecret)
    .update(stringToSign)
    .digest('base64');
}

/**
 * Check if bucket credentials are configured
 */
export function isBucketConfigured(): boolean {
  const config = getBucketConfig();
  return Boolean(config.bucketId && config.bearerToken);
}

/**
 * Check if identification credentials are configured
 */
export function isIdentificationConfigured(): boolean {
  const config = getBucketConfig();
  return Boolean(config.accessKey && config.accessSecret);
}

/**
 * Upload a track to ACRCloud custom bucket via Console API v2
 */
export async function uploadTrack(
  audioBuffer: Buffer,
  metadata: TrackMetadata,
  audioFormat: string = 'mp3'
): Promise<UploadResult> {
  const config = getBucketConfig();

  if (!config.bucketId || !config.bearerToken) {
    return {
      success: false,
      error: 'ACRCloud bucket credentials not configured (need ACRCLOUD_BUCKET_NAME and ACRCLOUD_BEARER_TOKEN)',
    };
  }

  // Build multipart form data for Console API v2
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  const formParts: (string | Buffer)[] = [];

  const addTextField = (name: string, value: string) => {
    formParts.push(`--${boundary}\r\n`);
    formParts.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
    formParts.push(`${value}\r\n`);
  };

  // Required fields
  addTextField('title', metadata.title);
  addTextField('data_type', 'audio');

  // Optional metadata as JSON
  const userDefined: Record<string, any> = {
    artist: metadata.artist,
  };
  if (metadata.album) userDefined.album = metadata.album;
  if (metadata.label) userDefined.label = metadata.label;
  if (metadata.releaseDate) userDefined.release_date = metadata.releaseDate;
  if (metadata.genres) userDefined.genres = metadata.genres;
  if (metadata.customFields) {
    Object.assign(userDefined, metadata.customFields);
  }
  addTextField('user_defined', JSON.stringify(userDefined));

  // Audio file
  formParts.push(`--${boundary}\r\n`);
  formParts.push(
    `Content-Disposition: form-data; name="file"; filename="track.${audioFormat}"\r\n`
  );
  formParts.push(`Content-Type: audio/${audioFormat}\r\n\r\n`);
  formParts.push(audioBuffer);
  formParts.push(`\r\n--${boundary}--\r\n`);

  // Combine parts into buffer
  const bodyParts = formParts.map((part) =>
    typeof part === 'string' ? Buffer.from(part) : part
  );
  const bodyBuffer = Buffer.concat(bodyParts);

  try {
    console.log(`[ACRCloud Bucket] Uploading: ${metadata.artist} - ${metadata.title}`);
    console.log(`[ACRCloud Bucket] Audio size: ${Math.round(audioBuffer.length / 1024)} KB`);

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
    console.log(`[ACRCloud Bucket] Response status: ${response.status}`);
    console.log(`[ACRCloud Bucket] Response: ${responseText.substring(0, 500)}`);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: `Invalid JSON response: ${responseText.substring(0, 200)}`,
      };
    }

    if (response.ok) {
      return {
        success: true,
        acrId: result.data?.acr_id || result.acr_id,
        message: 'Track uploaded successfully',
      };
    }

    return {
      success: false,
      error: result.message || result.error || `HTTP ${response.status}`,
    };
  } catch (error) {
    console.error('[ACRCloud Bucket] Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upload track from base64-encoded audio
 */
export async function uploadTrackFromBase64(
  audioBase64: string,
  metadata: TrackMetadata,
  audioFormat: string = 'mp3'
): Promise<UploadResult> {
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  return uploadTrack(audioBuffer, metadata, audioFormat);
}

/**
 * Upload track from file path (for use in scripts)
 */
export async function uploadTrackFromFile(
  filePath: string,
  metadata: TrackMetadata
): Promise<UploadResult> {
  const fs = await import('fs');
  const path = await import('path');

  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      error: `File not found: ${filePath}`,
    };
  }

  const audioBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'mp3';

  return uploadTrack(audioBuffer, metadata, ext);
}

/**
 * Delete a track from ACRCloud bucket
 */
export async function deleteTrack(acrId: string): Promise<UploadResult> {
  const config = getBucketConfig();

  if (!config.bucketId || !config.bearerToken) {
    return {
      success: false,
      error: 'ACRCloud bucket credentials not configured',
    };
  }

  try {
    console.log(`[ACRCloud Bucket] Deleting track: ${acrId}`);

    const url = `https://${config.consoleHost}/api/buckets/${config.bucketId}/files/${acrId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${config.bearerToken}`,
      },
    });

    if (response.ok || response.status === 204) {
      return {
        success: true,
        acrId,
        message: 'Track deleted successfully',
      };
    }

    const result = await response.json().catch(() => ({}));
    return {
      success: false,
      error: result.message || `HTTP ${response.status}`,
    };
  } catch (error) {
    console.error('[ACRCloud Bucket] Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get track status from ACRCloud bucket
 */
export async function getTrackStatus(acrId: string): Promise<TrackStatus | null> {
  const config = getBucketConfig();

  if (!config.bucketId || !config.bearerToken) {
    console.error('[ACRCloud Bucket] Credentials not configured');
    return null;
  }

  try {
    const url = `https://${config.consoleHost}/api/buckets/${config.bucketId}/files/${acrId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.bearerToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();

    // ACRCloud states: 0=pending, 1=processing, 2=completed, 3=failed
    const stateMap: Record<number, TrackStatus['status']> = {
      0: 'pending',
      1: 'processing',
      2: 'completed',
      3: 'failed',
    };

    return {
      acrId,
      status: stateMap[result.data?.state] || 'pending',
      message: result.data?.title,
    };
  } catch (error) {
    console.error('[ACRCloud Bucket] Get status error:', error);
    return null;
  }
}

/**
 * List tracks in the bucket (paginated)
 */
export async function listBucketTracks(
  page: number = 1,
  pageSize: number = 20
): Promise<{ tracks: BucketTrack[]; total: number } | null> {
  const config = getBucketConfig();

  if (!config.bucketId || !config.bearerToken) {
    console.error('[ACRCloud Bucket] Credentials not configured');
    return null;
  }

  try {
    const url = `https://${config.consoleHost}/api/buckets/${config.bucketId}/files?page=${page}&per_page=${pageSize}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.bearerToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();

    const tracks: BucketTrack[] = (result.data || []).map((file: any) => ({
      acrId: file.acr_id,
      title: file.title,
      artist: file.user_defined?.artist || '',
      album: file.user_defined?.album || '',
      createdAt: file.created_at,
      state: file.state,
    }));

    return {
      tracks,
      total: result.meta?.total || tracks.length,
    };
  } catch (error) {
    console.error('[ACRCloud Bucket] List tracks error:', error);
    return null;
  }
}

/**
 * Identify audio against custom bucket using Identification API
 * This uses HMAC signature authentication
 */
export async function identifyWithBucket(
  audioBase64: string,
  audioFormat: string = 'mp3'
): Promise<{
  success: boolean;
  result: {
    acrId: string;
    title: string;
    artist: string;
    confidence: number;
    customFields?: Record<string, string>;
  } | null;
  error?: string;
}> {
  const config = getBucketConfig();

  if (!config.bucketId || !config.accessKey || !config.accessSecret) {
    return {
      success: false,
      result: null,
      error: 'ACRCloud credentials not configured for identification',
    };
  }

  const httpMethod = 'POST';
  const httpUri = '/v1/identify';
  const dataType = 'audio';
  const signatureVersion = '1';
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signature = createSignature(
    httpMethod,
    httpUri,
    config.accessKey,
    config.accessSecret,
    dataType,
    timestamp
  );

  const audioBuffer = Buffer.from(audioBase64, 'base64');

  // Build multipart form data
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const formData: string[] = [];

  const addField = (name: string, value: string) => {
    formData.push(`--${boundary}`);
    formData.push(`Content-Disposition: form-data; name="${name}"`);
    formData.push('');
    formData.push(value);
  };

  addField('access_key', config.accessKey);
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

  const textPart = formData.join('\r\n') + '\r\n';
  const endPart = `\r\n--${boundary}--\r\n`;

  const bodyBuffer = Buffer.concat([
    Buffer.from(textPart),
    audioBuffer,
    Buffer.from(endPart),
  ]);

  try {
    const response = await fetch(`https://${config.identifyHost}${httpUri}`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length.toString(),
      },
      body: bodyBuffer,
    });

    const result = await response.json();

    if (result.status?.code === 1001) {
      // No match found
      return { success: true, result: null };
    }

    if (result.status?.code !== 0) {
      return {
        success: false,
        result: null,
        error: result.status?.msg || 'Unknown error',
      };
    }

    // Parse result - check custom_files first (bucket results), then music (main DB)
    const music = result.metadata?.custom_files?.[0] || result.metadata?.music?.[0];

    if (!music) {
      return { success: true, result: null };
    }

    return {
      success: true,
      result: {
        acrId: music.acr_id,
        title: music.title || 'Unknown',
        artist: music.artists?.map((a: any) => a.name).join(', ') || music.artist || 'Unknown',
        confidence: music.score || 0,
        customFields: music.custom_fields || music.user_defined,
      },
    };
  } catch (error) {
    console.error('[ACRCloud Bucket] Identify error:', error);
    return {
      success: false,
      result: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Download audio from a URL (for direct audio file URLs only)
 */
export async function downloadAudio(sourceUrl: string): Promise<Buffer> {
  if (sourceUrl.match(/\.(mp3|m4a|wav|ogg|flac)(\?|$)/i)) {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  throw new Error(
    'Platform URLs require yt-dlp. Use the scraper script for SoundCloud/Instagram/TikTok URLs.'
  );
}

export default {
  isBucketConfigured,
  isIdentificationConfigured,
  uploadTrack,
  uploadTrackFromBase64,
  uploadTrackFromFile,
  deleteTrack,
  getTrackStatus,
  listBucketTracks,
  identifyWithBucket,
  downloadAudio,
};
