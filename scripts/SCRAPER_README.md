# 1001tracklists Scraper

## Current Status

1001tracklists uses JavaScript rendering and bot detection, which makes scraping challenging. The site shows a "Please wait, you will be forwarded" page for headless browsers.

## Solutions

### Option 1: Use Python Library (Recommended)

The Python library at https://github.com/leandertolksdorf/1001-tracklists-api uses BeautifulSoup and may work better. You can:

1. Install the Python library:
```bash
pip install 1001-tracklists-api
# or
git clone https://github.com/leandertolksdorf/1001-tracklists-api.git
```

2. Create a Python script to scrape and output JSON:
```python
from tracklists import Tracklist

# Scrape a set
tl = Tracklist("https://www.1001tracklists.com/tracklist/14wrxfdt/...")
print(json.dumps({
    "title": tl.title,
    "artist": tl.artist,
    "tracks": [{"title": t.title, "artist": t.artist, "timestamp": t.time} for t in tl.tracks]
}))
```

3. Call it from Node.js/Bun:
```typescript
import { exec } from 'child_process';
const result = await exec('python scrape_1001.py "Max Dean"');
```

### Option 2: Use Backend Scraper (Current Implementation)

The backend scraper (`backend/trpc/routes/scraper.ts`) has improved 1001tracklists support:

- `scrapeUrl` - Scrapes a single URL
- `scrapeAllArtistSets` - Scrapes all sets for an artist (uses Puppeteer)

**Usage from your app:**
```typescript
const mutation = trpc.scraper.scrapeAllArtistSets.useMutation({
  onSuccess: (result) => {
    if (result.success) {
      // result.sets contains all scraped sets
      result.sets.forEach(set => {
        // Import each set
        addSet(set);
      });
    }
  }
});

mutation.mutate({ artistName: "Max Dean", maxSets: 10 });
```

### Option 3: Manual CSV Import

Use the existing CSV import feature:
1. Manually copy tracklist data
2. Format as CSV using the template
3. Import via the dev tools in your app

## Notes

- 1001tracklists may require cookies/session handling
- The site may rate-limit or block automated requests
- Consider using a proxy or rotating user agents
- The Python library might handle these challenges better

## Testing

To test the current implementation:
```bash
# Test single URL scraping
bun run scripts/scrape-1001tracklists.ts "https://www.1001tracklists.com/tracklist/..."

# Test artist scraping (may be blocked)
bun run scripts/scrape-artist-all-sets.ts "Max Dean" 5
```
