#!/usr/bin/env python3
"""
Script to add sets to the app library from a list of 1001tracklists URLs
Uses the 1001-tracklists-api library

Usage:
    python3 scripts/add-sets-from-urls.py <url1> <url2> ...
    OR
    python3 scripts/add-sets-from-urls.py --file urls.txt
"""

import sys
import json
import re
from datetime import datetime
from pathlib import Path

# Add the 1001-tracklists-api to path
api_path = Path(__file__).parent.parent / '1001-tracklists-api'
sys.path.insert(0, str(api_path))
sys.path.insert(0, str(api_path.parent))

try:
    from tracklists import Tracklist, Track
except ImportError as e:
    print(f"❌ Failed to import tracklists: {e}")
    print("   Make sure dependencies are installed:")
    print("   cd 1001-tracklists-api && python3 -m pip install --target . beautifulsoup4 requests fake-headers")
    sys.exit(1)

def parse_timestamp(timestamp_str):
    """Parse timestamp string (e.g., '1:23:45' or '23:45') to seconds"""
    if not timestamp_str:
        return 0
    
    parts = timestamp_str.split(':')
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    elif len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    return 0

def scrape_set_from_url(url):
    """Scrape a single set from a 1001tracklists URL"""
    try:
        print(f"  Scraping: {url}")
        tl = Tracklist(url)
        
        # Extract artist (DJ)
        artist = 'Unknown Artist'
        if hasattr(tl, 'DJs') and tl.DJs:
            artist = tl.DJs[0]
        
        # Extract date
        date_str = None
        if hasattr(tl, 'date_recorded') and tl.date_recorded:
            date_str = str(tl.date_recorded)
        
        set_data = {
            'title': tl.title if hasattr(tl, 'title') else 'Untitled Set',
            'artist': artist,
            'venue': None,  # API doesn't provide venue directly
            'date': date_str,
            'url': url,
            'thumbnail': None,  # API doesn't provide thumbnail
            'tracks': []
        }
        
        # Extract tracks
        if hasattr(tl, 'tracks') and tl.tracks:
            for i, track in enumerate(tl.tracks):
                track_title = track.title if hasattr(track, 'title') else 'Unknown'
                track_artist = track.artist if hasattr(track, 'artist') else 'Unknown'
                
                # Get timestamp from cues if available
                timestamp = '0:00'
                if hasattr(tl, 'cues') and i < len(tl.cues):
                    timestamp = tl.cues[i] if tl.cues[i] else '0:00'
                
                track_data = {
                    'title': track_title,
                    'artist': track_artist,
                    'timestamp': timestamp,
                }
                set_data['tracks'].append(track_data)
        
        print(f"    ✓ Found {len(set_data['tracks'])} tracks")
        return set_data
        
    except Exception as e:
        print(f"    ✗ Error: {e}")
        return None

def convert_to_typescript_format(sets_data):
    """Convert scraped sets to TypeScript format for mocks/tracks.ts"""
    
    sets_code = []
    base_time = int(datetime.now().timestamp() * 1000)
    
    for i, set_data in enumerate(sets_data):
        if not set_data or not set_data.get('tracks'):
            continue
        
        # Format tracks
        tracks_code = []
        for j, track in enumerate(set_data['tracks']):
            timestamp_seconds = parse_timestamp(track['timestamp'])
            track_code = f"""    {{
      id: "luke-dean-{base_time}-{i}-{j}",
      title: {json.dumps(track['title'])},
      artist: {json.dumps(track['artist'])},
      timestamp: {timestamp_seconds},
      duration: 0,
      coverUrl: {json.dumps('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop')},
      addedAt: new Date("{datetime.now().isoformat()}"),
      source: "link",
      verified: false,
    }}"""
            tracks_code.append(track_code)
        
        # Format set
        set_code = f"""  {{
    id: "luke-dean-{base_time}-{i}",
    name: {json.dumps(set_data['title'])},
    artist: {json.dumps(set_data['artist'])},
    {f'venue: {json.dumps(set_data["venue"])},' if set_data.get("venue") else ''}
    date: new Date("{set_data.get('date', datetime.now().isoformat())}"),
    tracks: [
{chr(10).join(tracks_code)}
    ],
    {f'coverUrl: {json.dumps(set_data["thumbnail"])},' if set_data.get("thumbnail") else ''}
    sourceLinks: [{json.dumps({'platform': '1001tracklists', 'url': set_data['url']})}],
    totalDuration: 0,
    aiProcessed: false,
    commentsScraped: 0,
    tracksIdentified: {len(set_data['tracks'])},
    plays: 0,
  }}"""
        sets_code.append(set_code)
    
    return ',\n'.join(sets_code)

def add_to_mocks_file(sets_code):
    """Add the sets to mocks/tracks.ts"""
    mocks_path = Path(__file__).parent.parent / 'mocks' / 'tracks.ts'
    
    if not mocks_path.exists():
        print(f"❌ mocks/tracks.ts not found at {mocks_path}")
        return False
    
    content = mocks_path.read_text(encoding='utf-8')
    
    # Find the mockSetLists array
    pattern = r'(export const mockSetLists[^=]*=\s*\[)'
    match = re.search(pattern, content)
    
    if not match:
        print("❌ Could not find mockSetLists export")
        return False
    
    array_start = match.end()
    
    # Find the closing bracket
    bracket_count = 0
    array_end = array_start
    for i in range(array_start, len(content)):
        if content[i] == '[':
            bracket_count += 1
        elif content[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                array_end = i
                break
    
    # Insert new sets at the beginning
    before = content[:array_start + 1]
    after = content[array_start + 1:array_end]
    new_content = before + '\n' + sets_code + (',\n' + after if after.strip() else '') + content[array_end:]
    
    mocks_path.write_text(new_content, encoding='utf-8')
    return True

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 scripts/add-sets-from-urls.py <url1> <url2> ...")
        print("  python3 scripts/add-sets-from-urls.py --file urls.txt")
        print("\nExample:")
        print('  python3 scripts/add-sets-from-urls.py "https://www.1001tracklists.com/tracklist/..."')
        sys.exit(1)
    
    # Get URLs
    urls = []
    if sys.argv[1] == '--file':
        if len(sys.argv) < 3:
            print("❌ Please provide a file path")
            sys.exit(1)
        file_path = Path(sys.argv[2])
        if not file_path.exists():
            print(f"❌ File not found: {file_path}")
            sys.exit(1)
        urls = [line.strip() for line in file_path.read_text().splitlines() if line.strip()]
    else:
        urls = sys.argv[1:]
    
    print(f"\n========================================")
    print(f"Adding {len(urls)} sets using 1001-tracklists-api")
    print(f"========================================\n")
    
    # Scrape each set
    all_sets = []
    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}] ", end='')
        set_data = scrape_set_from_url(url)
        if set_data:
            all_sets.append(set_data)
    
    if not all_sets:
        print("\n❌ No sets were successfully scraped")
        return
    
    print(f"\n✓ Successfully scraped {len(all_sets)} sets")
    print(f"  Total tracks: {sum(len(s['tracks']) for s in all_sets)}\n")
    
    # Convert to TypeScript format
    sets_code = convert_to_typescript_format(all_sets)
    
    # Add to mocks file
    if add_to_mocks_file(sets_code):
        print("✓ Added sets to mocks/tracks.ts")
        print("\n========================================")
        print("Complete!")
        print("========================================\n")
    else:
        print("❌ Failed to add sets to mocks file")

if __name__ == '__main__':
    main()
