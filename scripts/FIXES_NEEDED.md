# Identification Fixes Needed

## 🔍 Root Cause Found

**ACRCloud is never being called** because URL resolution is failing before it reaches ACRCloud.

## Issues Identified

### 1. ❌ yt-dlp Failing (CRITICAL)
- **Status**: yt-dlp binary found at correct path
- **Problem**: Failing to extract stream URL from YouTube
- **Impact**: Since app prioritizes YouTube, this blocks all identification
- **Error**: Need to see actual yt-dlp error output

**Fix**: 
- Improved error logging in `backend/trpc/routes/scraper.ts` to show full yt-dlp stderr/stdout
- Check backend logs when testing to see exact yt-dlp error

### 2. ❌ SoundCloud 403 Forbidden
- **Status**: SoundCloud API returning 403
- **Problem**: Authentication/access issue
- **Impact**: Fallback option not working

**Possible causes**:
- Invalid `SOUNDCLOUD_CLIENT_ID`
- Client ID doesn't have proper permissions
- Rate limiting
- SoundCloud API changes

**Fix**:
- Verify `SOUNDCLOUD_CLIENT_ID` is correct
- Check SoundCloud app settings at https://developers.soundcloud.com/
- Ensure app has proper scopes/permissions

## Next Steps

1. **Test yt-dlp manually** to see exact error:
   ```bash
   ./bin/yt-dlp -g -f "bestaudio/best" "https://www.youtube.com/watch?v=LXGBKmlRn0U"
   ```

2. **Check backend logs** when testing identification - look for:
   - `[Scraper] yt-dlp failed with status X`
   - Full stderr/stdout output

3. **Fix yt-dlp issue** based on error message:
   - May need to update yt-dlp: `./bin/yt-dlp -U`
   - May need different format: try without `-f "bestaudio/best"`
   - May be YouTube blocking - try different video

4. **Fix SoundCloud 403**:
   - Verify client ID is correct
   - Check SoundCloud developer dashboard
   - May need to regenerate client ID

## Current Flow (Where It Fails)

1. ✅ Frontend calls `/api/trpc/scraper.identifyTrackFromUrl`
2. ✅ Backend receives request
3. ✅ Backend detects YouTube URL
4. ❌ **yt-dlp fails to extract stream URL** ← FAILS HERE
5. ❌ Backend returns error (never reaches ACRCloud)

## After Fixes

Once yt-dlp works:
1. ✅ YouTube URL → yt-dlp → stream URL
2. ✅ Stream URL → ACRCloud API
3. ✅ ACRCloud returns identification result
