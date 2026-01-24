# Troubleshooting "Internet is Offline" Error

## Issue
App shows "internet is offline" error when starting.

## Possible Causes

### 1. Environment Variable Not Loaded
Expo needs to be restarted after changing `.env` file.

**Fix:**
1. Stop Expo completely (Ctrl+C)
2. Clear cache and restart:
   ```bash
   npx expo start --clear
   ```

### 2. Network Connectivity
The app can't reach the Vercel backend.

**Check:**
- Make sure your device/emulator has internet connection
- Test the backend URL in a browser: `https://rork-dj-set-list-creator-3um4.vercel.app/`
- Should return: `{"status":"ok","message":"SetList API is running"}`

### 3. Environment Variable Format
Make sure `.env` file has correct format (no quotes, no spaces):

**Correct:**
```
EXPO_PUBLIC_RORK_API_BASE_URL=https://rork-dj-set-list-creator-3um4.vercel.app
```

**Wrong:**
```
EXPO_PUBLIC_RORK_API_BASE_URL="https://rork-dj-set-list-creator-3um4.vercel.app"
EXPO_PUBLIC_RORK_API_BASE_URL = https://rork-dj-set-list-creator-3um4.vercel.app
```

### 4. App Trying to Connect on Startup
The app might be making a request immediately on startup.

**Check:**
- Look at the Expo console for error messages
- Check if any component is calling tRPC on mount

## Quick Fix Steps

1. **Verify .env file:**
   ```bash
   cat .env | grep EXPO_PUBLIC_RORK_API_BASE_URL
   ```
   Should show: `EXPO_PUBLIC_RORK_API_BASE_URL=https://rork-dj-set-list-creator-3um4.vercel.app`

2. **Stop Expo completely**

3. **Clear cache and restart:**
   ```bash
   npx expo start --clear
   ```

4. **Check Expo console** for any error messages about the API URL

5. **Test backend manually:**
   - Open browser: `https://rork-dj-set-list-creator-3um4.vercel.app/`
   - Should see JSON response

## If Still Not Working

Check the Expo console logs for:
- "EXPO_PUBLIC_RORK_API_BASE_URL is not set" - means env var not loaded
- Network errors - means can't reach backend
- CORS errors - backend configuration issue
