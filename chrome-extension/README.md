# IDentified - Chrome Extension

Scrape tracks and artists from Beatport, SoundCloud, and 1001Tracklists directly into your IDentified database.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder

## Usage

### Supported Sites

- **Beatport** - Charts, releases, artist pages, top 100
- **SoundCloud** - Tracks, playlists, artist pages
- **1001Tracklists** - Setlists

### How to Scrape

1. Navigate to a supported page
2. Click the floating "✨ IDentified" button, OR
3. Click the extension icon in your toolbar
4. Click "Scrape from [Site]"
5. Review the results
6. Click "Send to IDentified" to import

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
- Check the console for errors

**Scrape returning empty?**
- Some pages load dynamically - wait for content to load
- Try scrolling to load more items first

**Can't send to API?**
- Check that the API is running
- Verify CORS settings
