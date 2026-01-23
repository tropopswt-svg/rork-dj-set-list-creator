#!/usr/bin/env python3
"""
Python script to scrape 1001tracklists using the 1001-tracklists-api library
Can be called from Node.js/Bun to scrape sets

Usage:
    python scripts/scrape_1001_python.py <url>
    python scripts/scrape_1001_python.py --artist "Max Dean" --max-sets 5
"""

import sys
import json
import argparse
from pathlib import Path

try:
    # Try to import the library
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from tracklists import Tracklist
except ImportError:
    print(json.dumps({
        "error": "1001-tracklists-api library not found. Install with: pip install -e /path/to/1001-tracklists-api",
        "success": False
    }), file=sys.stderr)
    sys.exit(1)


def scrape_url(url):
    """Scrape a single tracklist URL"""
    try:
        tl = Tracklist(url)
        
        tracks = []
        for track in tl.tracks:
            tracks.append({
                "title": track.title if hasattr(track, 'title') else '',
                "artist": track.artist if hasattr(track, 'artist') else '',
                "timestamp": track.time if hasattr(track, 'time') else '0:00',
            })
        
        result = {
            "success": True,
            "title": tl.title if hasattr(tl, 'title') else '',
            "artist": tl.artist if hasattr(tl, 'artist') else '',
            "venue": getattr(tl, 'venue', None),
            "date": str(getattr(tl, 'date', '')) if hasattr(tl, 'date') else None,
            "url": url,
            "tracks": tracks,
        }
        
        return result
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "url": url,
        }


def scrape_artist(artist_name, max_sets=10):
    """Scrape all sets for an artist"""
    # This would need to be implemented based on the library's capabilities
    # For now, return error
    return {
        "success": False,
        "error": "Artist scraping not yet implemented. Use individual URLs.",
    }


def main():
    parser = argparse.ArgumentParser(description='Scrape 1001tracklists')
    parser.add_argument('url', nargs='?', help='Tracklist URL to scrape')
    parser.add_argument('--artist', help='Artist name to search for')
    parser.add_argument('--max-sets', type=int, default=10, help='Max sets to scrape')
    parser.add_argument('--format', choices=['json', 'csv'], default='json', help='Output format')
    
    args = parser.parse_args()
    
    if args.url:
        result = scrape_url(args.url)
        print(json.dumps(result, indent=2))
    elif args.artist:
        result = scrape_artist(args.artist, args.max_sets)
        print(json.dumps(result, indent=2))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()
