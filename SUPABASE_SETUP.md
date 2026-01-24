# Supabase Edge Functions Setup Guide

## Important Note

Supabase Edge Functions use **Deno runtime**, which means your Bun/Node.js code needs to be adapted. This is more complex than Vercel (which supports Node.js natively).

**Recommendation:** If you want the easiest setup, use **Vercel** instead. But if you're committed to Supabase, here's how to set it up.

## Step 1: Install Supabase CLI

```bash
brew install supabase/tap/supabase
```

## Step 2: Login to Supabase

```bash
supabase login
```

This will open your browser to authenticate.

## Step 3: Link Your Project

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Click on your project
3. Go to **Settings** → **API**
4. Copy your:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Anon key** (starts with `eyJ...`)

5. Link your local project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
   
   You can find your project ref in the Supabase dashboard URL or settings.

## Step 4: Deploy Edge Function

```bash
supabase functions deploy api
```

This will deploy the function in `supabase/functions/api/`

## Step 5: Get Your Function URL

Your function will be available at:
```
https://your-project-ref.supabase.co/functions/v1/api
```

## Step 6: Update Your App

Update your `.env`:
```bash
EXPO_PUBLIC_RORK_API_BASE_URL=https://your-project-ref.supabase.co/functions/v1/api
```

## Challenges with Supabase

1. **Deno Runtime**: Your code uses Bun/Node.js features that need conversion
2. **Import Paths**: Need to use Deno-compatible imports
3. **tRPC Router**: Needs adaptation for Deno
4. **Dependencies**: Some npm packages may not work in Deno

## Alternative: Use Supabase Database + Deploy Backend Separately

If you want Supabase for database/auth but keep your Hono backend on Vercel:

1. Use **Supabase** for:
   - Database (PostgreSQL)
   - Authentication
   - Storage

2. Deploy your **Hono backend to Vercel** for:
   - API endpoints
   - Scraping logic
   - tRPC routes

This gives you the best of both worlds!

## Next Steps

If you want to proceed with Supabase Edge Functions, I'll need to:
1. Convert your backend code to Deno-compatible format
2. Adapt all imports
3. Update the tRPC router for Deno

**Or** we can switch to Vercel which requires zero code changes.

What would you prefer?
