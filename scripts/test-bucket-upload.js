#!/usr/bin/env node
/**
 * Test uploading a track to ACRCloud bucket
 *
 * Usage:
 *   node scripts/test-bucket-upload.js <audio-file-path>
 *   node scripts/test-bucket-upload.js ./test-audio.mp3
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const bucketId = process.env.ACRCLOUD_BUCKET_NAME;
const bearerToken = process.env.ACRCLOUD_BEARER_TOKEN;

async function testUpload(filePath) {
  console.log('Testing ACRCloud bucket upload...');
  console.log('Bucket ID:', bucketId);
  console.log('Token:', bearerToken ? bearerToken.substring(0, 20) + '...' : 'NOT SET');

  if (!bucketId || !bearerToken) {
    console.error('Missing ACRCLOUD_BUCKET_NAME or ACRCLOUD_BEARER_TOKEN');
    process.exit(1);
  }

  if (!filePath) {
    console.log('\nNo file provided. Testing with a simple list request...');

    // Just test listing
    const listUrl = `https://api-v2.acrcloud.com/api/buckets/${bucketId}/files`;
    const listRes = await fetch(listUrl, {
      headers: { 'Authorization': `Bearer ${bearerToken}` }
    });
    const listData = await listRes.json();
    console.log('\nCurrent bucket contents:');
    console.log('Total files:', listData.meta?.total || 0);
    if (listData.data?.length > 0) {
      listData.data.forEach(f => {
        console.log(`  - ${f.title} (ACR ID: ${f.acr_id}, State: ${f.state})`);
      });
    }
    return;
  }

  // Upload file
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const audioBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'mp3';

  console.log('\nUploading:', fileName);
  console.log('Size:', Math.round(audioBuffer.length / 1024), 'KB');

  // Build multipart form
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  const formParts = [];

  const addField = (name, value) => {
    formParts.push(`--${boundary}\r\n`);
    formParts.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
    formParts.push(`${value}\r\n`);
  };

  addField('title', fileName.replace(/\.[^/.]+$/, '')); // filename without extension
  addField('data_type', 'audio');
  addField('user_defined', JSON.stringify({
    artist: 'Test Artist',
    source: 'test-upload-script'
  }));

  // Audio file
  formParts.push(`--${boundary}\r\n`);
  formParts.push(`Content-Disposition: form-data; name="audio_file"; filename="${fileName}"\r\n`);
  formParts.push(`Content-Type: audio/${ext}\r\n\r\n`);
  formParts.push(audioBuffer);
  formParts.push(`\r\n--${boundary}--\r\n`);

  const bodyParts = formParts.map(p => typeof p === 'string' ? Buffer.from(p) : p);
  const bodyBuffer = Buffer.concat(bodyParts);

  const url = `https://api-v2.acrcloud.com/api/buckets/${bucketId}/files`;

  console.log('Uploading to:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: bodyBuffer,
  });

  const responseText = await response.text();
  console.log('\nResponse status:', response.status);

  try {
    const result = JSON.parse(responseText);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (response.ok && result.data?.acr_id) {
      console.log('\n SUCCESS! Track uploaded.');
      console.log('ACR ID:', result.data.acr_id);
    }
  } catch {
    console.log('Response:', responseText);
  }
}

const filePath = process.argv[2];
testUpload(filePath).catch(console.error);
