# Unreleased Track Database - Implementation Status

## Completed
- [x] Create Supabase migration `006_unreleased_tracks.sql`
- [x] Run migration (tables created successfully)
- [x] Create `services/acrcloudBucket.ts` (updated for Bearer token auth)
- [x] Create `lib/supabase/unreleasedTrackService.ts`
- [x] Create `api/bucket/upload.js` endpoint (updated for Bearer token auth)
- [x] Create `scripts/unreleased-scraper.ts` (updated for Bearer token auth)
- [x] Update `api/identify.js` to check bucket
- [x] Update `.env.example` with bucket vars
- [x] Configure ACRCloud bucket API authentication
  - Bucket ID: 29490
  - Bearer token: Created via Personal Access Token
  - API verified working

## Tested & Working
- [x] Test upload with real audio file
- [x] Test SoundCloud scraper end-to-end
- [x] Test identification against bucket
- [x] Link bucket to project via API

### Test Results (2026-02-02)
- Downloaded: "Robbie Doherty & Ruze - Lonely (Unreleased)" from SoundCloud
- Uploaded to bucket: ACR ID `b4c52ac95dbbd24c949d1810647c0997`
- Fingerprint status: Processing (state 1) but identification works
- Identification test: **Score 100** - found in custom_files

## Configuration
Environment variables in `.env.local`:
```
ACRCLOUD_BUCKET_NAME=29490
ACRCLOUD_BEARER_TOKEN=eyJ0eXAi...
ACRCLOUD_BUCKET_HOST=api-v2.acrcloud.com
```

## Architecture Summary

### Two ACRCloud APIs:
1. **Console API v2** (`api-v2.acrcloud.com`)
   - Auth: Bearer token (Personal Access Token)
   - Used for: Upload, list, delete, get status

2. **Identification API** (`identify-us-west-2.acrcloud.com`)
   - Auth: HMAC signature (Access Key + Secret)
   - Used for: Audio recognition

## Test Commands
```bash
# Test bucket connection
node scripts/test-bucket.js

# Test bucket upload (with file)
node scripts/test-bucket-upload.js ./path/to/audio.mp3

# Run SoundCloud scraper
bun scripts/unreleased-scraper.ts https://soundcloud.com/username
```

## Future Tasks
- [ ] Admin dashboard for unreleased tracks
- [ ] Chrome extension for community submission
- [ ] Instagram/TikTok support
- [ ] Scheduled scraper runs
