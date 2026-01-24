# Restart Your Expo App

## To Restart and Pick Up New Environment Variables:

1. **Stop the current Expo server:**
   - Press `Ctrl+C` in the terminal where Expo is running
   - Or close the terminal window

2. **Clear the cache (recommended):**
   ```bash
   npx expo start --clear
   ```
   
   Or if using your custom start command:
   ```bash
   npm start
   ```

3. **The app will reload** and pick up the new `EXPO_PUBLIC_RORK_API_BASE_URL` from `.env`

## Verify It's Working:

After restart, test the import functionality:
- Go to Discover/Submit tab
- Try importing a YouTube/SoundCloud/Mixcloud URL
- Check that it connects to your Vercel backend

## Troubleshooting:

If it still connects to localhost:
- Make sure you saved the `.env` file
- Make sure you restarted Expo (not just reloaded)
- Check that `EXPO_PUBLIC_RORK_API_BASE_URL` is set correctly in `.env`
