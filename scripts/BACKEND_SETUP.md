# Backend Server Setup

## Problem
The Rork deployment URL (`https://72roq2v56c1t8ob04sop2.rork.app/`) returns "404 Snapshot not found", meaning the backend isn't being served.

## Solution: Run Backend Locally

Since Rork doesn't automatically serve your Hono backend, you need to run it separately.

### Step 1: Start the Backend Server

In a **separate terminal**, run:

```bash
bun run server
```

This will start the backend on `http://localhost:3000`

### Step 2: Update Your .env for Local Development

Change your `.env` file to use localhost:

```env
EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:3000
```

### Step 3: Start Your Frontend

In another terminal, run:

```bash
bun run start-web
```

### Step 4: Test

1. Visit `http://localhost:3000/` - should see `{"status":"ok","message":"SetList API is running"}`
2. Try identification in your app - it should now connect to the local backend

## Alternative: Use Rork's Backend (If Available)

If Rork supports backend deployment, you may need to:
1. Check Rork documentation for backend deployment
2. Or configure Rork to serve your `backend/hono.ts` file
3. Or deploy the backend separately (e.g., Vercel, Railway, etc.)

## Current Status

✅ **Backend code is fixed** - Route is now `/api/trpc/*`
✅ **Server script created** - `server.ts` can run the backend locally
❌ **Rork deployment** - Backend not being served by Rork URL

## Next Steps

1. **For local development**: Run `bun run server` in a separate terminal
2. **For production**: Deploy backend separately or configure Rork to serve it
