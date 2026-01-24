# Railway Deployment Guide

## Step-by-Step Instructions

### Step 1: Sign Up for Railway

1. Go to https://railway.app
2. Click "Start a New Project"
3. Sign up with GitHub (recommended) or email

### Step 2: Create a New Project

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Authorize Railway to access your GitHub
4. Select your repository: `rork-dj-set-list-creator`
5. Click "Deploy Now"

### Step 3: Configure the Service

Railway will auto-detect your project. You need to configure it:

1. **Click on your service** (the deployed project)
2. Go to **Settings** tab
3. Under **Build & Deploy**:
   - **Root Directory**: Leave empty (deploys from root)
   - **Build Command**: `bun install` (or leave auto-detected)
   - **Start Command**: `bun run server.ts`

### Step 4: Set Environment Variables

1. In Railway dashboard, go to **Variables** tab
2. Click **+ New Variable** for each:

   ```
   PORT=3001
   ```

   ```
   ACRCLOUD_ACCESS_KEY=6ed1ca7984d882f1f63ca42b39ebe0c5
   ```

   ```
   ACRCLOUD_ACCESS_SECRET=zwOUQMAiIspWlaAgv1bG0RhN3bDQKSJsUnVXUQEI
   ```

   ```
   ACRCLOUD_HOST=identify-us-west-2.acrcloud.com
   ```

   ```
   SOUNDCLOUD_CLIENT_ID=dN22KkvtToMSJi4ZFwgiAGSPhuTJHR45
   ```

   ```
   YT_DLP_PATH=python3 -m yt_dlp
   ```

3. Railway will automatically redeploy when you add variables

### Step 5: Get Your Backend URL

1. Go to **Settings** tab
2. Scroll to **Domains**
3. Click **Generate Domain** (or use the default one)
4. Copy the URL (e.g., `https://your-app.up.railway.app`)

### Step 6: Update Your App Configuration

1. Update your `.env` file with the Railway URL:

   ```bash
   EXPO_PUBLIC_RORK_API_BASE_URL=https://your-app.up.railway.app
   ```

2. **Important**: Restart your Expo app for the new URL to take effect

### Step 7: Test the Deployment

1. Visit your Railway URL in a browser:
   ```
   https://your-app.up.railway.app/
   ```
   Should return: `{"status":"ok","message":"SetList API is running"}`

2. Test the API endpoint:
   ```
   https://your-app.up.railway.app/api/trpc/scraper.scrapeUrl
   ```

3. Try importing a set in your app - it should now connect to Railway!

## Troubleshooting

### Deployment Fails

- Check **Deployments** tab for error logs
- Make sure `bun` is available (Railway should auto-detect)
- Verify `server.ts` is in the root directory

### Backend Not Responding

- Check **Metrics** tab to see if service is running
- Check **Logs** tab for error messages
- Verify all environment variables are set correctly

### CORS Errors

- The backend already has CORS enabled in `backend/hono.ts`
- If you still get CORS errors, check the logs

### Environment Variables Not Working

- Make sure variables are set in Railway dashboard (not just `.env`)
- Redeploy after adding variables
- Check variable names match exactly (case-sensitive)

## Updating the Backend

1. Make changes to your code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update backend"
   git push
   ```
3. Railway will automatically detect the push and redeploy
4. Check **Deployments** tab to see deployment progress

## Cost

- Railway offers a **free tier** with $5 credit/month
- Perfect for development and testing
- Upgrade if you need more resources

## Next Steps

Once deployed:
1. Update your `.env` with the Railway URL
2. Test the app - imports should work!
3. For production iOS app, use this Railway URL in your build
