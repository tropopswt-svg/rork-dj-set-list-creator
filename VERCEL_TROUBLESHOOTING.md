# Vercel Troubleshooting Guide

## If you're getting a 404

### Check 1: Build Settings in Vercel Dashboard

1. Go to your project in Vercel dashboard
2. Click **Settings** → **General**
3. Under **Build & Development Settings**:
   - **Framework Preset**: Should be "Other" or blank
   - **Root Directory**: Should be `.` (root)
   - **Build Command**: Leave **EMPTY**
   - **Output Directory**: Leave **EMPTY**
   - **Install Command**: Should be `bun install` or `npm install`

### Check 2: Function Logs

1. Go to **Deployments** tab
2. Click on your latest deployment
3. Click **Functions** tab
4. Look for `api/index.ts`
5. Check the logs for any errors

### Check 3: Verify File Structure

Make sure these files exist:
- ✅ `api/index.ts` (serverless function)
- ✅ `vercel.json` (configuration)
- ✅ `backend/hono.ts` (Hono app)

### Check 4: Test the Function Directly

Try accessing:
- `https://your-app.vercel.app/api/index`
- `https://your-app.vercel.app/`

Both should work.

## Alternative: Use Vercel's Newer Format

If the above doesn't work, try this configuration:

### Update vercel.json to:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api"
    }
  ]
}
```

### Update api/index.ts to:

```typescript
import app from "../backend/hono";

export default async function handler(req: Request): Promise<Response> {
  return app.fetch(req);
}
```

## Common Issues

### Issue: "Cannot find module"
- **Fix**: Make sure all dependencies are in `package.json`
- Check that `bun install` or `npm install` runs successfully

### Issue: "Function timeout"
- **Fix**: Vercel has a 10s timeout on free tier
- Your scraping might be taking too long
- Consider adding timeouts to your fetch calls

### Issue: "CORS errors"
- **Fix**: CORS is already enabled in `backend/hono.ts`
- If still having issues, check the CORS configuration

## Still Not Working?

1. Check the **Deployments** tab for build errors
2. Look at **Function Logs** for runtime errors
3. Try redeploying after making changes
4. Make sure you've committed and pushed the latest code
