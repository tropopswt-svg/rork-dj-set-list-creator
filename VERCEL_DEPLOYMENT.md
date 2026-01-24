# Vercel Deployment Guide (Recommended for Hono)

Vercel is the **best choice** for deploying your Hono backend because:
- ✅ Native Hono support
- ✅ Zero configuration needed
- ✅ Free tier with generous limits
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Easy environment variables
- ✅ Automatic deployments from GitHub

## Step-by-Step Deployment

### Step 1: Sign Up for Vercel

1. Go to **https://vercel.com**
2. Click **"Sign Up"** (top right)
3. Choose **"Continue with GitHub"** (recommended)
4. Authorize Vercel to access your GitHub account

### Step 2: Import Your Project

1. After signing in, you'll see the Vercel dashboard
2. Click **"Add New..."** → **"Project"**
3. You'll see a list of your GitHub repositories
4. Find **`rork-dj-set-list-creator`** and click **"Import"**

### Step 3: Configure Project Settings

Vercel will auto-detect your project. Verify these settings:

**Framework Preset:** Leave as "Other" or "Vercel"

**Root Directory:** Leave as `.` (root)

**Build Command:** Leave empty (not needed for serverless)

**Output Directory:** Leave empty

**Install Command:** `bun install` (or leave auto-detected)

**Override:** Click **"Override"** and set:
- **Build Command:** (leave empty)
- **Output Directory:** (leave empty)

### Step 4: Set Environment Variables

Before deploying, click **"Environment Variables"** and add:

1. Click **"+ Add"** for each variable:

   ```
   ACRCLOUD_ACCESS_KEY
   Value: 6ed1ca7984d882f1f63ca42b39ebe0c5
   ```

   ```
   ACRCLOUD_ACCESS_SECRET
   Value: zwOUQMAiIspWlaAgv1bG0RhN3bDQKSJsUnVXUQEI
   ```

   ```
   ACRCLOUD_HOST
   Value: identify-us-west-2.acrcloud.com
   ```

   ```
   SOUNDCLOUD_CLIENT_ID
   Value: dN22KkvtToMSJi4ZFwgiAGSPhuTJHR45
   ```

   ```
   YT_DLP_PATH
   Value: python3 -m yt_dlp
   ```

2. Make sure to select **"Production"**, **"Preview"**, and **"Development"** for each variable

### Step 5: Deploy

1. Click **"Deploy"** button (bottom right)
2. Wait for deployment (usually 1-2 minutes)
3. You'll see build logs in real-time

### Step 6: Get Your Backend URL

1. After deployment completes, you'll see **"Congratulations!"**
2. Your backend URL will be shown, e.g.:
   ```
   https://rork-dj-set-list-creator.vercel.app
   ```
3. Click the URL to test it
4. You should see: `{"status":"ok","message":"SetList API is running"}`

### Step 7: Update Your App

1. Copy your Vercel URL
2. Update your `.env` file:
   ```bash
   EXPO_PUBLIC_RORK_API_BASE_URL=https://rork-dj-set-list-creator.vercel.app
   ```
3. Restart your Expo app

## Testing Your Deployment

1. **Health Check:**
   ```
   https://your-app.vercel.app/
   ```
   Should return: `{"status":"ok","message":"SetList API is running"}`

2. **API Endpoint:**
   ```
   https://your-app.vercel.app/api/trpc/scraper.scrapeUrl
   ```

## Automatic Deployments

Vercel automatically deploys when you push to GitHub:
- **Main branch** → Production deployment
- **Other branches** → Preview deployments

## Updating Your Backend

1. Make changes to your code
2. Commit and push:
   ```bash
   git add .
   git commit -m "Update backend"
   git push
   ```
3. Vercel automatically detects and deploys
4. Check the **Deployments** tab to see progress

## Troubleshooting

### Build Fails

- Check **Deployments** tab for error logs
- Make sure `server.ts` is in root directory
- Verify all dependencies are in `package.json`

### Environment Variables Not Working

- Make sure variables are set in Vercel dashboard
- Redeploy after adding variables
- Check variable names match exactly

### CORS Errors

- Backend already has CORS enabled
- If issues persist, check Vercel logs

## Cost

- **Free tier:** 100GB bandwidth/month, unlimited requests
- Perfect for development and small production apps
- Upgrade only if you need more resources

## Next Steps

Once deployed:
1. ✅ Copy your Vercel URL
2. ✅ Update `.env` file
3. ✅ Test the app - imports should work!
