# Vercel Deployment - Quick Start Guide

## No CLI Needed - Everything Through Web Interface!

### Step 1: Go to Vercel

1. Open your browser and go to: **https://vercel.com**
2. Click **"Sign Up"** (top right corner)
3. Choose **"Continue with GitHub"** (this is easiest)
4. Authorize Vercel to access your GitHub repositories

### Step 2: Import Your Project

1. After signing in, you'll see the Vercel dashboard
2. Click the **"Add New..."** button (top right)
3. Select **"Project"** from the dropdown
4. You'll see a list of your GitHub repositories
5. Find **`rork-dj-set-list-creator`** in the list
6. Click the **"Import"** button next to it

### Step 3: Configure Project Settings

Vercel will auto-detect your project. On the configuration page:

**Leave these as default (auto-detected):**
- Framework Preset: "Other" (or whatever it detects)
- Root Directory: `.` (root)
- Build Command: (leave empty)
- Output Directory: (leave empty)

**Install Command:**
- Should auto-detect as `bun install` or `npm install`
- If not, type: `bun install`

**DO NOT click "Deploy" yet!** We need to add environment variables first.

### Step 4: Add Environment Variables

**Before deploying**, click on **"Environment Variables"** section (on the same page):

Click **"+ Add"** button and add each of these (one at a time):

**Variable 1:**
- Name: `ACRCLOUD_ACCESS_KEY`
- Value: `6ed1ca7984d882f1f63ca42b39ebe0c5`
- Check all three boxes: ☑ Production ☑ Preview ☑ Development

**Variable 2:**
- Name: `ACRCLOUD_ACCESS_SECRET`
- Value: `zwOUQMAiIspWlaAgv1bG0RhN3bDQKSJsUnVXUQEI`
- Check all three boxes: ☑ Production ☑ Preview ☑ Development

**Variable 3:**
- Name: `ACRCLOUD_HOST`
- Value: `identify-us-west-2.acrcloud.com`
- Check all three boxes: ☑ Production ☑ Preview ☑ Development

**Variable 4:**
- Name: `SOUNDCLOUD_CLIENT_ID`
- Value: `dN22KkvtToMSJi4ZFwgiAGSPhuTJHR45`
- Check all three boxes: ☑ Production ☑ Preview ☑ Development

**Variable 5:**
- Name: `YT_DLP_PATH`
- Value: `python3 -m yt_dlp`
- Check all three boxes: ☑ Production ☑ Preview ☑ Development

**Important:** Make sure all three checkboxes (Production, Preview, Development) are checked for each variable!

### Step 5: Deploy!

1. Scroll down to the bottom of the page
2. Click the big **"Deploy"** button
3. Watch the build logs appear in real-time
4. Wait 1-2 minutes for deployment to complete

### Step 6: Get Your Backend URL

1. Once deployment finishes, you'll see **"Congratulations!"**
2. Your backend URL will be displayed, something like:
   ```
   https://rork-dj-set-list-creator.vercel.app
   ```
3. **Copy this URL** - you'll need it!

### Step 7: Test Your Backend

1. Click on your deployment URL (or copy it to a new tab)
2. You should see:
   ```json
   {"status":"ok","message":"SetList API is running","version":"1.0.1"}
   ```
3. If you see this, your backend is working! ✅

### Step 8: Update Your App

Once you have your Vercel URL, I'll help you update your `.env` file to use it.

## What Happens Next?

- ✅ Your backend is now live on the internet
- ✅ Every time you push to GitHub, Vercel auto-deploys
- ✅ Your iOS app can now connect to this URL
- ✅ No more "backend not found" errors!

## Troubleshooting

**If deployment fails:**
- Check the build logs in Vercel dashboard
- Make sure all environment variables are added
- Verify `api/index.ts` exists in your project

**If backend doesn't respond:**
- Check the **Functions** tab in Vercel dashboard
- Look at the **Logs** tab for error messages
- Make sure the URL is correct

## Next Steps

After you complete the deployment and get your URL, let me know and I'll:
1. Update your `.env` file with the new URL
2. Test the connection
3. Help you test importing a set in your app

---

**Ready? Start at Step 1 and work through each step. When you have your Vercel URL, let me know!**
