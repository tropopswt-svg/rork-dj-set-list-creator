# Backend Setup Guide

## Current Backend Architecture

Your app uses a **custom Hono + tRPC backend** that runs separately from your React Native/Expo app.

### Architecture Overview

```
┌─────────────────┐         HTTP/tRPC         ┌──────────────────┐
│                 │ ────────────────────────> │                  │
│  iOS/Expo App   │                           │  Backend Server  │
│  (Frontend)      │ <──────────────────────── │  (Hono + tRPC)   │
│                 │                            │                  │
└─────────────────┘                            └──────────────────┘
```

**Frontend (iOS App):**
- Location: This React Native/Expo project
- Connects to backend via: `EXPO_PUBLIC_RORK_API_BASE_URL` environment variable
- Uses tRPC client for type-safe API calls

**Backend Server:**
- Location: `backend/` directory in this project
- Framework: Hono (lightweight web framework)
- API: tRPC (type-safe RPC)
- Runs on: Port 3001 (configurable via `PORT` env var)
- Entry point: `server.ts`

## Current Configuration

### Local Development (Current Setup)

**Backend URL:** `http://localhost:3001`

**Configuration File:** `.env`
```bash
EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:3001
```

**Why this doesn't work for iOS:**
- `localhost` only works when the app and backend are on the same machine
- iOS Simulator can access `localhost` on your Mac
- Physical iOS devices **cannot** access `localhost` - they need a network-accessible URL

## Development Workflow

### Option 1: iOS Simulator (Easiest for Testing)

1. **Start the backend:**
   ```bash
   bun run server
   ```
   This starts the backend on `http://localhost:3001`

2. **Start the Expo app:**
   ```bash
   bun run start
   ```

3. **Open in iOS Simulator:**
   - Press `i` in the Expo terminal
   - The simulator can access `localhost:3001` because it runs on your Mac

### Option 2: Physical iOS Device (Requires Network URL)

For testing on a real iPhone/iPad, you need to expose your local backend:

#### Option 2A: Use Your Mac's Local IP Address

1. **Find your Mac's local IP:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Example output: `inet 192.168.1.100`

2. **Update `.env`:**
   ```bash
   EXPO_PUBLIC_RORK_API_BASE_URL=http://192.168.1.100:3001
   ```

3. **Make sure your Mac's firewall allows connections:**
   ```bash
   # Allow incoming connections on port 3001
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/bun
   ```

4. **Start backend and app:**
   ```bash
   bun run server
   bun run start
   ```

5. **Connect device to same WiFi network as your Mac**

#### Option 2B: Use ngrok (Recommended for Testing)

1. **Install ngrok:**
   ```bash
   brew install ngrok
   # Or download from https://ngrok.com/
   ```

2. **Start your backend:**
   ```bash
   bun run server
   ```

3. **In another terminal, expose port 3001:**
   ```bash
   ngrok http 3001
   ```
   This gives you a public URL like: `https://abc123.ngrok.io`

4. **Update `.env`:**
   ```bash
   EXPO_PUBLIC_RORK_API_BASE_URL=https://abc123.ngrok.io
   ```

5. **Restart your Expo app** (environment variables are loaded at build time)

## Production Deployment for iOS App

For a **production iOS app** that you want to control from a backend, you need:

### 1. Deploy Backend to a Cloud Service

**Recommended Options:**

#### Option A: Railway (Easiest)
1. Sign up at https://railway.app
2. Connect your GitHub repo
3. Deploy the `backend/` directory
4. Set environment variables (ACRCloud keys, etc.)
5. Get your public URL: `https://your-app.railway.app`

#### Option B: Fly.io
1. Sign up at https://fly.io
2. Install flyctl: `brew install flyctl`
3. Create `fly.toml` in project root:
   ```toml
   app = "your-app-name"
   primary_region = "iad"
   
   [build]
   
   [http_service]
     internal_port = 3001
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true
     min_machines_running = 0
   
   [[services]]
     protocol = "tcp"
     internal_port = 3001
   ```
4. Deploy: `fly deploy`
5. Get URL: `https://your-app.fly.dev`

#### Option C: Render
1. Sign up at https://render.com
2. Create new Web Service
3. Connect GitHub repo
4. Build command: `cd backend && bun install`
5. Start command: `bun run server.ts`
6. Get URL: `https://your-app.onrender.com`

#### Option D: Vercel (Serverless)
1. Sign up at https://vercel.com
2. Install Vercel CLI: `npm i -g vercel`
3. Create `vercel.json`:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "server.ts",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "server.ts"
       }
     ]
   }
   ```
4. Deploy: `vercel`

### 2. Update App Configuration

Once you have a production backend URL:

1. **Update `.env` for production:**
   ```bash
   EXPO_PUBLIC_RORK_API_BASE_URL=https://your-backend.railway.app
   ```

2. **Or use environment-specific configs:**
   - Create `.env.production` for production builds
   - Keep `.env` for local development

3. **Build your iOS app:**
   ```bash
   # For development build
   eas build --profile development --platform ios
   
   # For production build
   eas build --profile production --platform ios
   ```

### 3. Environment Variables in Production

Make sure your deployed backend has these environment variables set:

```bash
# Required
ACRCLOUD_ACCESS_KEY=your_key
ACRCLOUD_ACCESS_SECRET=your_secret
ACRCLOUD_HOST=identify-us-west-2.acrcloud.com

# Optional but recommended
SOUNDCLOUD_CLIENT_ID=your_client_id
YT_DLP_PATH=/usr/local/bin/yt-dlp
```

## Quick Start Scripts

### Start Backend + Frontend Together

Create `scripts/dev.sh`:
```bash
#!/bin/bash
# Start backend in background
bun run server &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
bun run start

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT
```

### Check Backend Status

```bash
curl http://localhost:3001/
# Should return: {"status":"ok","message":"SetList API is running"}
```

## Troubleshooting

### "Cannot connect to backend server"

1. **Check if backend is running:**
   ```bash
   lsof -ti:3001
   # Should return a process ID
   ```

2. **Check backend logs:**
   Look at the terminal where you ran `bun run server`

3. **Verify environment variable:**
   ```bash
   echo $EXPO_PUBLIC_RORK_API_BASE_URL
   # Or check .env file
   ```

4. **For physical devices:**
   - Make sure device and Mac are on same WiFi
   - Use Mac's IP address, not `localhost`
   - Or use ngrok for public URL

### Backend starts but requests fail

1. **Check CORS settings** - Backend has CORS enabled, should be fine
2. **Check backend logs** for error messages
3. **Test backend directly:**
   ```bash
   curl -X POST http://localhost:3001/api/trpc/scraper.scrapeUrl \
     -H "Content-Type: application/json" \
     -d '{"json":{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}}'
   ```

## Summary

- **Local Development (Simulator):** Use `localhost:3001`
- **Local Development (Physical Device):** Use Mac's IP or ngrok
- **Production iOS App:** Deploy backend to Railway/Fly.io/Render, use production URL
- **Backend Location:** Deploy `backend/` directory to cloud service
- **Control from Backend:** Once deployed, you can update backend code and redeploy without rebuilding the iOS app
