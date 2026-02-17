# Lessons Learned

## 2026-02-02: ACRCloud API Architecture

### Issue
Assumed ACRCloud bucket API used same authentication as identification API.

### Root Cause
ACRCloud has two separate API systems:
1. **Identification API** (v1) at `identify-*.acrcloud.com` - HMAC signature authentication
2. **Console API** (v2) at `api-v2.acrcloud.com` - Bearer token authentication

### Lesson
When integrating with third-party APIs, verify authentication methods for each endpoint type before implementation. Read the specific documentation for each API endpoint, not just the general docs.

### Fix Applied
- Obtained Bearer token from ACRCloud console: Developer Setting → Personal Access Token → Create Token
- Updated bucket service to use Bearer auth for management operations (upload, list, delete)
- Keep HMAC auth for identification operations
- Documented both APIs and their auth methods in tasks/todo.md

---

## 2026-02-02: ACRCloud Upload Field Name

### Issue
Upload was returning HTML redirect page instead of JSON response.

### Root Cause
The form field for the audio file must be named `file`, not `audio_file`.

### Lesson
When an API returns unexpected HTML instead of JSON, check the exact field names in the documentation. ACRCloud Console API v2 expects `file` for the audio upload field.

### Fix Applied
- Changed all occurrences of `audio_file` to `file` in:
  - `api/bucket/upload.js`
  - `services/acrcloudBucket.ts`
  - `scripts/unreleased-scraper.ts`

---

## Template for Future Entries

### Issue
[Brief description]

### Root Cause
[What actually caused the problem]

### Lesson
[What to do differently next time]

### Fix Applied
[What was changed to resolve it]
