#!/usr/bin/env python3
"""
Script to scrape all Luke Dean sets using the 1001-tracklists-api library
and add them to the app library (mocks/tracks.ts)

Usage:
    python3 scripts/add-luke-dean-with-api.py
"""

import sys
import os
import json
import re
from datetime import datetime
from pathlib import Path

# Add the 1001-tracklists-api to path
api_path = Path(__file__).parent.parent / '1001-tracklists-api'
if not api_path.exists():
    print("❌ 1001-tracklists-api not found. Cloning...")
    import subprocess
    subprocess.run(['git', 'clone', 'https://github.com/leandertolksdorf/1001-tracklists-api.git', str(api_path)], check=True)

# Add both the api_path and its parent to sys.path
sys.path.insert(0, str(api_path))
sys.path.insert(0, str(api_path.parent))

try:
    from tracklists import Tracklist, Track
except ImportError as e:
    print(f"❌ Failed to import tracklists: {e}")
    print("   Make sure dependencies are installed:")
    print("   cd 1001-tracklists-api && python3 -m pip install --target . beautifulsoup4 requests")
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

def escape_js_string(s):
    """Escape string for JavaScript/TypeScript"""
    if not s:
        return ''
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r')

def find_artist_sets(artist_name):
    """Search for artist and get their set URLs"""
    # This is a simplified approach - the API might not have direct artist search
    # We'll need to use the search functionality or known URLs
    print(f"Searching for artist: {artist_name}")
    
    # Try to find the artist's DJ page
    search_url = f"https://www.1001tracklists.com/search/result.php?search_selection=6&search_value={artist_name.replace(' ', '+')}"
    
    # For now, we'll need to manually provide URLs or use web scraping for the search
    # The API library focuses on individual tracklist pages
    return []

def scrape_set_from_url(url):
    """Scrape a single set from a 1001tracklists URL"""
    try:
        print(f"  Scraping: {url}")
        tl = Tracklist(url)
        
        set_data = {
            'title': tl.title or 'Untitled Set',
            'artist': tl.artist or 'Unknown Artist',
            'venue': getattr(tl, 'venue', None),
            'date': getattr(tl, 'date', None),
            'url': url,
            'thumbnail': getattr(tl, 'image_url', None),
            'tracks': []
        }
        
        # Extract tracks
        for track in tl.tracks:
            track_data = {
                'title': track.title or 'Unknown',
                'artist': track.artist or 'Unknown',
                'timestamp': getattr(track, 'time', '0:00') or '0:00',
            }
            set_data['tracks'].append(track_data)
        
        print(f"    ✓ Found {len(set_data['tracks'])} tracks")
        return set_data
        
    except Exception as e:
        print(f"    ✗ Error: {e}")
        return None

def get_luke_dean_set_urls():
    """Get all Luke Dean set URLs from 1001tracklists"""
    # Since the API doesn't have direct artist search, we'll use web scraping
    # to find the set URLs, then use the API to scrape each one
    
    import urllib.request
    from bs4 import BeautifulSoup
    
    artist_name = "Luke Dean"
    search_query = artist_name.replace(' ', '+')
    search_url = f"https://www.1001tracklists.com/search/result.php?search_selection=6&search_value={search_query}"
    
    print(f"Searching for {artist_name} sets...")
    
    try:
        req = urllib.request.Request(
            search_url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Try to find DJ page link
        dj_link = None
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            if '/dj/' in href and artist_name.lower().replace(' ', '') in href.lower():
                dj_link = f"https://www.1001tracklists.com{href}"
                break
        
        if not dj_link:
            # Try direct URL
            dj_link = f"https://www.1001tracklists.com/dj/{artist_name.lower().replace(' ', '')}/"
        
        print(f"Found DJ page: {dj_link}")
        
        # Get the DJ page
        req = urllib.request.Request(
            dj_link,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Find all tracklist links
        set_urls = []
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            if '/tracklist/' in href:
                full_url = f"https://www.1001tracklists.com{href}" if href.startswith('/') else href
                if full_url not in set_urls:
                    set_urls.append(full_url)
        
        print(f"Found {len(set_urls)} set URLs")
        return set_urls[:50]  # Limit to 50 sets
        
    except Exception as e:
        print(f"Error finding sets: {e}")
        return []

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
      coverUrl: {json.dumps(set_data.get('thumbnail', 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop'))},
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
    print("\n========================================")
    print("Adding Luke Dean sets using 1001-tracklists-api")
    print("========================================\n")
    
    # Get all set URLs
    set_urls = get_luke_dean_set_urls()
    
    if not set_urls:
        print("❌ No sets found. The page might use JavaScript rendering.")
        print("   Try using the UI feature in the app instead.")
        return
    
    print(f"\n✓ Found {len(set_urls)} sets to scrape\n")
    
    # Scrape each set
    all_sets = []
    for i, url in enumerate(set_urls, 1):
        print(f"[{i}/{len(set_urls)}] ", end='')
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
