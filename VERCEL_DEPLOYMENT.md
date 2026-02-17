# Vercel Deployment Guide

This guide will help you ensure your dashboard and API are properly deployed and configured on Vercel.

## ✅ Deployment Checklist

### 1. Verify Vercel Configuration

The `vercel.json` file has been configured to support:
- ✅ Hono backend (tRPC API) at `/api/trpc/*` and root `/`
- ✅ Legacy API routes in `/api/*`
- ✅ CORS headers for all routes
- ✅ Extended timeout (60s) for serverless functions

### 2. Required Environment Variables

Add these environment variables in your Vercel project settings:

**Go to:** https://vercel.com/henrys-projects-285a9e70/dashboard/settings/environment-variables

#### Required for Backend API:
```bash
# Supabase Database
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# ACRCloud (for track identification)
ACRCLOUD_ACCESS_KEY=your_acrcloud_access_key
ACRCLOUD_ACCESS_SECRET=your_acrcloud_access_secret
ACRCLOUD_HOST=identify-us-west-2.acrcloud.com

# ACRCloud Custom Bucket (for unreleased track fingerprinting)
ACRCLOUD_BUCKET_NAME=your-bucket-id
ACRCLOUD_BUCKET_HOST=api-v2.acrcloud.com
ACRCLOUD_BEARER_TOKEN=your-personal-access-token

# Optional but recommended
SOUNDCLOUD_CLIENT_ID=your_soundcloud_client_id
YOUTUBE_API_KEY=your_youtube_api_key

# Optional - Spotify release checking for unreleased tracks
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

#### For Frontend (if deploying web version):
```bash
# Backend API URL (should point to your Vercel deployment)
EXPO_PUBLIC_RORK_API_BASE_URL=https://dashboard-lovat-two-22.vercel.app
```

### 3. Verify Deployment

After deploying, test these endpoints:

#### Health Check:
```bash
curl https://dashboard-lovat-two-22.vercel.app/
```
**Expected:** `{"status":"ok","message":"SetList API is running","version":"1.0.1"}`

#### tRPC Endpoint:
```bash
curl https://dashboard-lovat-two-22.vercel.app/api/trpc
```
**Expected:** Should return tRPC endpoint information

#### Legacy API Routes:
```bash
curl https://dashboard-lovat-two-22.vercel.app/api/sets
```
**Expected:** JSON response with sets data

### 4. Common Issues & Fixes

#### Issue: 404 on all routes
**Solution:** 
- Check that `server.ts` is in the root directory
- Verify `vercel.json` rewrites are correct
- Redeploy: `vercel --prod`

#### Issue: CORS errors
**Solution:**
- Check `vercel.json` headers configuration
- Verify CORS is enabled in `backend/hono.ts` (it should be)

#### Issue: Environment variables not working
**Solution:**
- Go to Vercel dashboard → Settings → Environment Variables
- Add all required variables
- Redeploy after adding variables
- Make sure variables are set for **Production**, **Preview**, and **Development** environments

#### Issue: Timeout errors
**Solution:**
- Check `vercel.json` has `maxDuration: 60` for serverless functions
- For longer operations, consider using background jobs

### 5. Testing Your Deployment

Run these tests to verify everything works:

```bash
# 1. Health check
curl https://dashboard-lovat-two-22.vercel.app/

# 2. Test tRPC endpoint (should return method not allowed for GET, but not 404)
curl -X POST https://dashboard-lovat-two-22.vercel.app/api/trpc/scraper.scrapeUrl \
  -H "Content-Type: application/json" \
  -d '{"json":{"url":"https://www.youtube.com/watch?v=test"}}'

# 3. Test legacy API
curl https://dashboard-lovat-two-22.vercel.app/api/sets?limit=5
```

### 6. Update Frontend Configuration

If your frontend app needs to connect to this backend, update your `.env`:

```bash
EXPO_PUBLIC_RORK_API_BASE_URL=https://dashboard-lovat-two-22.vercel.app
```

Or update the default in your code files:
- `app/(tabs)/(discover)/index.tsx`
- `app/(tabs)/(discover)/[id].tsx`
- `app/(tabs)/(submit)/index.tsx`
- `contexts/SetsContext.tsx`

### 7. Monitoring & Logs

- **View logs:** https://vercel.com/henrys-projects-285a9e70/dashboard/logs
- **View deployments:** https://vercel.com/henrys-projects-285a9e70/dashboard/deployments
- **Inspect deployment:** https://vercel.com/henrys-projects-285a9e70/dashboard/BqN62xwPH9TsEJoaiTJDNtVrhPfF

## 🚀 Quick Deploy Commands

```bash
# Deploy to production
vercel --prod

# Deploy preview
vercel

# Check deployment status
vercel ls

# View logs
vercel logs
```

## 📝 Notes

- The Hono backend is configured as a serverless function via `server.ts`
- Legacy API routes in `/api/*` are also supported
- All routes have CORS enabled for cross-origin requests
- Maximum function duration is set to 60 seconds

## 🔗 Your Deployment URLs

- **Production:** https://dashboard-lovat-two-22.vercel.app
- **Inspect:** https://vercel.com/henrys-projects-285a9e70/dashboard/BqN62xwPH9TsEJoaiTJDNtVrhPfF
- **Settings:** https://vercel.com/henrys-projects-285a9e70/dashboard/settings
