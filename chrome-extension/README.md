# TRACK'D - Chrome Extension

Scrape tracks and artists from Beatport, SoundCloud, and 1001Tracklists directly into your TRACK'D database.

## Installation

### Step 1: Create Icons

Before loading the extension, you need PNG icons:

```bash
cd chrome-extension/icons
node create-icons.js
```

Then convert the SVG files to PNG:
- Use an online tool like [svgtopng.com](https://svgtopng.com/)
- Or use ImageMagick: `convert icon16.svg icon16.png`
- Create files: `icon16.png`, `icon48.png`, `icon128.png`

### Step 2: Load Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder

### Step 3: Configure API URL

1. Click the TRACK'D extension icon
2. Click the ⚙️ settings icon
3. Enter your API URL (e.g., `https://your-app.vercel.app`)
4. Click "Test Connection" to verify
5. Click "Save Settings"

## Usage

### Supported Sites

- **Beatport** - Charts, releases, artist pages, top 100
- **SoundCloud** - Tracks, playlists, artist pages
- **1001Tracklists** - Setlists

### How to Scrape

1. Navigate to a supported page
2. Click the floating "✨ TRACK'D" button, OR
3. Click the extension icon in your toolbar
4. Click "Scrape from [Site]"
5. Review the results
6. Click "Send to TRACK'D" to import

## What Gets Scraped

### Beatport
- Track title, artists, remixer
- Label, BPM, key, genre
- Duration, release year
- Beatport URLs

### SoundCloud
- Track title, artist
- Play counts, likes
- Tags/genres
- Duration
- Artwork URLs

### 1001Tracklists
- Full tracklist with timestamps
- Artist names
- Set info (DJ, venue, date)
- Unreleased/ID detection

## API Endpoint

The extension sends data to:
```
POST /api/chrome-import
```

Data format:
```json
{
  "source": "beatport|soundcloud|1001tracklists",
  "sourceUrl": "https://...",
  "pageType": "chart|track|artist|...",
  "tracks": [...],
  "artists": [...]
}
```

## Icons

Create your own icons or use placeholder:
- `icons/icon16.png` - 16x16
- `icons/icon48.png` - 48x48  
- `icons/icon128.png` - 128x128

## Troubleshooting

**Button not appearing?**
- Refresh the page
- Check the console for errors (F12 → Console)
- Make sure the extension is enabled in `chrome://extensions/`

**Scrape returning empty?**
- Some pages load dynamically - wait for content to load
- Try scrolling to load more items first
- On Beatport, make sure tracks are visible on the page

**Can't send to API?**
- Click ⚙️ and use "Test Connection" to check API status
- Verify your API URL is correct (include `https://`)
- Check that your Vercel deployment is running
- Look at the browser console for detailed error messages

**Extension not loading?**
- Make sure icon PNG files exist in `icons/` folder
- Check `chrome://extensions/` for error messages
- Try removing and re-adding the extension

## Data Flow

1. **Scrape** - Extension extracts track/artist data from the page DOM
2. **Store** - Data is temporarily stored in Chrome local storage
3. **Send** - Data is POSTed to `/api/import` with `chromeExtension: true` flag
4. **Import** - API saves artists and tracks to Supabase database

## Verifying Data in Database

After importing, you can verify data was saved:
- Check your Supabase dashboard → Table Editor → `artists` and `tracks` tables
- Use the app's search/browse features to find imported content
