# Fix Vercel Peer Dependency Error

## The Issue
Vercel is encountering peer dependency conflicts during `npm install`. This is common with React Native/Expo projects.

## The Solution

### Update Install Command in Vercel Dashboard

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **General** → **Build & Development Settings**
3. Find **"Install Command"** section
4. Click the **Override** toggle to ON (if not already on)
5. Change the value from:
   ```
   npm install
   ```
   To:
   ```
   npm install --legacy-peer-deps
   ```
6. Click **Save**

### Keep Build Command Empty

**Important:** Make sure your **Build Command** is still **EMPTY** (not `npm run build`). Serverless functions don't need a build step.

### Settings Summary

Your Framework Settings should look like this:

- **Framework Preset:** `Other`
- **Build Command:** (empty) ← Override ON, field empty
- **Output Directory:** (empty) ← Override ON, field empty  
- **Install Command:** `npm install --legacy-peer-deps` ← Override ON
- **Development Command:** `None`

## After Saving

1. Go to **Deployments** tab
2. Click **"Redeploy"** on your latest deployment
3. Or push a new commit to trigger auto-deploy

## Why This Works

The `--legacy-peer-deps` flag tells npm to use the legacy (npm v6) peer dependency resolution algorithm, which is more lenient and works better with React Native/Expo projects that have complex dependency trees.

## Alternative: Use .npmrc

If you prefer, you can also create a `.npmrc` file in your project root:

```
legacy-peer-deps=true
```

Then commit and push it. This way you don't need to set it in Vercel settings.
