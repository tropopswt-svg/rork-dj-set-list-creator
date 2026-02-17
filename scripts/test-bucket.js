#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const bucketId = process.env.ACRCLOUD_BUCKET_NAME; // Bucket ID: 29490
const bearerToken = process.env.ACRCLOUD_BEARER_TOKEN;

console.log('Testing ACRCloud Custom Files bucket (v2 API)...');
console.log('Bucket ID:', bucketId);
console.log('Token:', bearerToken ? bearerToken.substring(0, 20) + '...' : 'NOT SET');

if (!bucketId || !bearerToken) {
  console.log('Missing credentials');
  process.exit(1);
}

// ACRCloud Console API v2 - list files in bucket
const url = `https://api-v2.acrcloud.com/api/buckets/${bucketId}/files`;

console.log('Requesting:', url);

// Bearer token auth (Console API v2)
fetch(url, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${bearerToken}`,
  }
})
.then(r => r.json())
.then(data => {
  console.log('\nResponse:', JSON.stringify(data, null, 2));
})
.catch(err => console.error('Error:', err.message));
