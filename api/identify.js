// Self-contained audio identification endpoint using ACRCloud
import crypto from 'crypto';

export const config = {
  maxDuration: 60,
};

// Create HMAC signature for ACRCloud
function createSignature(stringToSign, secretKey) {
  return crypto.createHmac('sha1', secretKey).update(stringToSign).digest('base64');
}

// Send to ACRCloud for identification
async function identifyWithACRCloud(audioBase64, audioFormat) {
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
  const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET;
  const host = process.env.ACRCLOUD_HOST || 'identify-us-west-2.acrcloud.com';

  if (!accessKey || !accessSecret) {
    throw new Error('ACRCloud credentials not configured');
  }

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

// Parse ACRCloud response
function parseACRCloudResponse(response) {
  if (response.status?.code !== 0) {
    if (response.status?.code === 1001) {
      return { success: true, result: null }; // No match found
    }
    return {
      success: false,
      error: response.status?.msg || 'Unknown error',
      result: null,
    };
  }

  const music = response.metadata?.music?.[0];
  if (!music) {
    return { success: true, result: null };
  }

  // Extract external links
  const spotifyId = music.external_metadata?.spotify?.track?.id;
  const youtubeId = music.external_metadata?.youtube?.vid;

  return {
    success: true,
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

    const acrResponse = await identifyWithACRCloud(audioBase64, audioFormat);
    console.log('[Identify] ACRCloud response:', JSON.stringify(acrResponse).substring(0, 500));

    const result = parseACRCloudResponse(acrResponse);

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Identify] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to identify track',
    });
  }
}
