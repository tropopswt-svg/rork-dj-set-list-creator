#!/usr/bin/env python3
"""
Daily House Set Sync Script
Scrapes the top 10-15 Most Viewed House Tracklists from 1001tracklists.com
and syncs them into the Rork app's Supabase database.

Usage:
    python scripts/daily_house_sync.py [--dry-run] [--limit N]
"""

import os
import sys
import re
import json
import argparse
import logging
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import requests
from bs4 import BeautifulSoup
from fake_headers import Headers

# Add the project root and 1001-tracklists-api to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "1001-tracklists-api"))

from tracklists import Tracklist

# Try to load .env file
env_path = PROJECT_ROOT / ".env"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key.strip(), value)

from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

HOUSE_GENRE_URL = "https://www.1001tracklists.com/genre/house/index.html"
DEFAULT_LIMIT = 15

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("house_sync")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_soup(url: str) -> BeautifulSoup:
    """Fetch a page and return BeautifulSoup, with retry."""
    for attempt in range(3):
        try:
            response = requests.get(url, headers=Headers().generate(), timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            if soup.title and "Error 403" in soup.title.text:
                raise Exception("403 - possibly rate limited or captcha")
            return soup
        except Exception as e:
            log.warning(f"Attempt {attempt + 1} failed for {url}: {e}")
            if attempt == 2:
                raise
    raise Exception(f"Failed to fetch {url}")


def normalize_text(text: str) -> str:
    """Normalize text for matching (lowercase, strip special chars)."""
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def generate_slug(name: str) -> str:
    """Generate a URL-friendly slug from a name."""
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def parse_cue_to_seconds(cue: str) -> int | None:
    """Convert a cue string like '1:23:45' or '47:30' to seconds."""
    if not cue or not cue.strip():
        return None
    parts = cue.strip().split(":")
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
    except ValueError:
        return None
    return None


# ---------------------------------------------------------------------------
# Scrape Most Viewed House Tracklists
# ---------------------------------------------------------------------------

def scrape_most_viewed_house_sets(limit: int = DEFAULT_LIMIT) -> list[dict]:
    """
    Scrape the 'Most Viewed House Tracklists' section from the house genre page.
    Returns a list of dicts with 'url', 'title', 'artist_name'.
    """
    log.info(f"Fetching house genre page: {HOUSE_GENRE_URL}")
    soup = get_soup(HOUSE_GENRE_URL)

    sets = []

    # Look for the "Most Viewed" section - typically in the right sidebar or main content
    # The page has sections like "Most Viewed House Tracklists" with timeframe filters
    # We look for tracklist links in the most-viewed section

    # Strategy: find all tracklist links on the page and extract from the most-viewed section
    # The most-viewed section usually has class or id patterns we can identify

    # First try to find the specific most-viewed section
    most_viewed_section = None

    # Look for headings containing "Most Viewed"
    for heading in soup.find_all(["h2", "h3", "h4", "div", "span"]):
        if heading.text and "most viewed" in heading.text.lower():
            most_viewed_section = heading.find_parent("div")
            break

    # Also try finding by section IDs or classes commonly used
    if not most_viewed_section:
        for div in soup.find_all("div", class_=re.compile(r"most.?viewed|top.?tracklists|chart", re.I)):
            most_viewed_section = div
            break

    # If we found the section, extract links from it
    search_area = most_viewed_section if most_viewed_section else soup

    # Find all tracklist links
    tracklist_links = search_area.find_all("a", href=re.compile(r"/tracklist/"))

    seen_urls = set()
    for link in tracklist_links:
        href = link.get("href", "")
        if not href or href in seen_urls:
            continue

        # Build full URL
        full_url = href if href.startswith("http") else f"https://www.1001tracklists.com{href}"
        seen_urls.add(href)

        # Extract title text
        title_text = link.text.strip()
        if not title_text or len(title_text) < 3:
            continue

        # Try to extract artist name from the link context
        artist_name = ""
        parent = link.find_parent("div") or link.find_parent("td")
        if parent:
            artist_link = parent.find("a", href=re.compile(r"/dj/"))
            if artist_link:
                artist_name = artist_link.text.strip()

        sets.append({
            "url": full_url,
            "title": title_text,
            "artist_name": artist_name,
        })

        if len(sets) >= limit:
            break

    log.info(f"Found {len(sets)} tracklist links from house genre page")
    return sets[:limit]


# ---------------------------------------------------------------------------
# Database Operations
# ---------------------------------------------------------------------------

def get_supabase_client() -> Client:
    """Create and return a Supabase client using service role key."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def set_exists_in_db(supabase: Client, tracklist_url: str, set_name: str) -> bool:
    """Check if a set already exists in the database by URL or name match."""
    # Check by external URL patterns
    tracklist_id = ""
    match = re.search(r"/tracklist/([^/]+)/", tracklist_url)
    if match:
        tracklist_id = match.group(1)

    # Check by external_id first (most reliable)
    if tracklist_id:
        result = supabase.table("sets").select("id").eq("external_id", tracklist_id).execute()
        if result.data:
            return True

    # Check by name match (fuzzy)
    if set_name:
        normalized = normalize_text(set_name)
        result = supabase.table("sets").select("id, name").execute()
        for row in result.data:
            if normalize_text(row.get("name", "")) == normalized:
                return True

    return False


def find_or_create_artist(supabase: Client, artist_name: str, artist_1001tl_url: str = None) -> str:
    """Find an existing artist by name/alias or create a new one. Returns artist ID."""
    if not artist_name:
        return None

    normalized = normalize_text(artist_name)
    slug = generate_slug(artist_name)

    # Check by slug
    result = supabase.table("artists").select("id").eq("slug", slug).execute()
    if result.data:
        return result.data[0]["id"]

    # Check by name (case-insensitive via normalize)
    result = supabase.table("artists").select("id, name").execute()
    for row in result.data:
        if normalize_text(row.get("name", "")) == normalized:
            return row["id"]

    # Check aliases
    result = supabase.table("artist_aliases").select("artist_id, alias_lower").eq("alias_lower", normalized).execute()
    if result.data:
        return result.data[0]["artist_id"]

    # Create new artist
    artist_id = str(uuid4())
    new_artist = {
        "id": artist_id,
        "name": artist_name,
        "slug": slug,
        "genres": ["House"],
    }
    supabase.table("artists").insert(new_artist).execute()
    log.info(f"  Created new artist: {artist_name} ({artist_id})")
    return artist_id


def find_or_create_track(supabase: Client, title: str, artist_name: str, artist_id: str = None,
                         genre: str = None, label_name: str = None, duration: str = None) -> str:
    """Find an existing track or create a new one. Returns track ID."""
    if not title:
        return None

    title_normalized = normalize_text(title)

    # Try exact match on normalized title + artist
    result = supabase.table("tracks").select("id, title_normalized, artist_name").eq("title_normalized", title_normalized).execute()
    for row in result.data:
        if normalize_text(row.get("artist_name", "")) == normalize_text(artist_name or ""):
            return row["id"]

    # Check track aliases
    result = supabase.table("track_aliases").select("track_id, title_alias_normalized").eq("title_alias_normalized", title_normalized).execute()
    if result.data:
        return result.data[0]["track_id"]

    # Create new track
    track_id = str(uuid4())
    new_track = {
        "id": track_id,
        "title": title,
        "title_normalized": title_normalized,
        "artist_id": artist_id,
        "artist_name": artist_name or "Unknown",
    }
    if genre:
        new_track["genre"] = genre if isinstance(genre, str) else None
    if label_name:
        new_track["label"] = label_name

    supabase.table("tracks").insert(new_track).execute()
    log.info(f"  Created new track: {artist_name} - {title} ({track_id})")
    return track_id


def import_set_to_db(supabase: Client, tracklist: Tracklist, tracklist_url: str, dry_run: bool = False) -> dict:
    """
    Import a scraped Tracklist into the database.
    Returns a summary dict of what was created.
    """
    summary = {"set": None, "tracks_created": 0, "tracks_existing": 0, "artists_created": 0}

    # Extract tracklist ID from URL
    tracklist_id = ""
    match = re.search(r"/tracklist/([^/]+)/", tracklist_url)
    if match:
        tracklist_id = match.group(1)

    # Determine the main DJ/artist
    dj_names = tracklist.DJs if hasattr(tracklist, "DJs") and tracklist.DJs else []
    main_artist_name = dj_names[0] if dj_names else "Unknown Artist"

    # Determine event info from sources
    event_name = ""
    venue = ""
    if hasattr(tracklist, "sources"):
        for key, val in tracklist.sources.items():
            if "festival" in key.lower() or "open air" in key.lower():
                event_name = val
            elif "club" in key.lower() or "venue" in key.lower():
                venue = val
            elif not event_name:
                event_name = val

    if dry_run:
        log.info(f"  [DRY RUN] Would import: {tracklist.title}")
        log.info(f"  Artist: {main_artist_name}, Event: {event_name}, Tracks: {len(tracklist.tracks)}")
        return summary

    # Find or create main artist
    main_artist_id = find_or_create_artist(supabase, main_artist_name)

    # Create the set
    set_id = str(uuid4())
    set_date = tracklist.date_recorded if hasattr(tracklist, "date_recorded") else None

    new_set = {
        "id": set_id,
        "external_id": tracklist_id,
        "name": tracklist.title or f"{main_artist_name} Set",
        "artist_id": main_artist_id,
        "artist_name": main_artist_name,
        "event_name": event_name or None,
        "venue": venue or None,
        "set_date": set_date,
        "tracks_count": len(tracklist.tracks),
    }

    supabase.table("sets").insert(new_set).execute()
    summary["set"] = set_id
    log.info(f"  Created set: {new_set['name']} ({set_id})")

    # Import each track
    cues = tracklist.cues if hasattr(tracklist, "cues") else []

    for i, track in enumerate(tracklist.tracks):
        try:
            # Find or create the track's artist
            track_artist_name = str(track.artist) if track.artist else track.full_artist
            track_artist_id = find_or_create_artist(supabase, track_artist_name)

            # Get label name
            label_name = str(track.labels[0]) if track.labels else None

            # Find or create the track
            track_id = find_or_create_track(
                supabase,
                title=track.title,
                artist_name=track_artist_name,
                artist_id=track_artist_id,
                genre=track.genre,
                label_name=label_name,
            )

            # Get timestamp from cues
            timestamp_seconds = None
            if i < len(cues):
                timestamp_seconds = parse_cue_to_seconds(cues[i])

            # Create set_track entry
            set_track = {
                "id": str(uuid4()),
                "set_id": set_id,
                "track_id": track_id,
                "position": i + 1,
                "timestamp_seconds": timestamp_seconds,
                "raw_title": track.title,
                "raw_artist": track_artist_name,
                "confidence": 0.9,  # High confidence from 1001tracklists
                "source": "1001tracklists",
            }

            supabase.table("set_tracks").insert(set_track).execute()
            summary["tracks_created"] += 1

        except Exception as e:
            log.error(f"  Error importing track {i + 1} ({track.full_title}): {e}")
            continue

    # Update the set's tracks_count with actual imported count
    supabase.table("sets").update({"tracks_count": summary["tracks_created"]}).eq("id", set_id).execute()

    log.info(f"  Imported {summary['tracks_created']} tracks for set {new_set['name']}")
    return summary


# ---------------------------------------------------------------------------
# Main Sync Flow
# ---------------------------------------------------------------------------

def sync_house_sets(limit: int = DEFAULT_LIMIT, dry_run: bool = False):
    """Main sync: scrape top house sets, check DB, import missing ones."""
    log.info("=" * 60)
    log.info(f"Starting daily house set sync at {datetime.now().isoformat()}")
    log.info(f"Limit: {limit}, Dry run: {dry_run}")
    log.info("=" * 60)

    # Step 1: Scrape the most-viewed house sets
    top_sets = scrape_most_viewed_house_sets(limit=limit)

    if not top_sets:
        log.warning("No sets found on the house genre page. Possible scraping issue.")
        return

    log.info(f"Found {len(top_sets)} top house sets to check")

    # Step 2: Connect to Supabase
    supabase = get_supabase_client()

    # Step 3: Check each set and import if missing
    imported = 0
    skipped = 0
    errors = 0

    for i, set_info in enumerate(top_sets, 1):
        url = set_info["url"]
        title = set_info["title"]

        log.info(f"\n[{i}/{len(top_sets)}] Checking: {title}")
        log.info(f"  URL: {url}")

        try:
            # Check if already in DB
            if set_exists_in_db(supabase, url, title):
                log.info(f"  SKIP - Already in database")
                skipped += 1
                continue

            # Not in DB -> scrape the full tracklist
            log.info(f"  NEW - Scraping full tracklist...")
            tracklist = Tracklist(url)

            log.info(f"  Found {len(tracklist.tracks)} tracks, "
                     f"DJs: {', '.join(tracklist.DJs) if hasattr(tracklist, 'DJs') and tracklist.DJs else 'Unknown'}")

            # Import to database
            summary = import_set_to_db(supabase, tracklist, url, dry_run=dry_run)
            imported += 1

        except Exception as e:
            log.error(f"  ERROR processing {url}: {e}")
            errors += 1
            continue

    # Summary
    log.info("\n" + "=" * 60)
    log.info("SYNC COMPLETE")
    log.info(f"  Total checked: {len(top_sets)}")
    log.info(f"  Imported: {imported}")
    log.info(f"  Skipped (already in DB): {skipped}")
    log.info(f"  Errors: {errors}")
    log.info("=" * 60)


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Daily house set sync from 1001tracklists")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to database")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help=f"Max sets to check (default: {DEFAULT_LIMIT})")
    parser.add_argument("--no-report", action="store_true", help="Skip the post-sync report")
    args = parser.parse_args()

    sync_house_sets(limit=args.limit, dry_run=args.dry_run)

    # Run database cleanup after sync
    if not args.dry_run:
        log.info("Running database cleanup...")
        from daily_db_cleanup import run_cleanup
        run_cleanup(dry_run=False)

    # Run the report automatically after sync + cleanup
    if not args.no_report and not args.dry_run:
        log.info("Generating post-sync report...")
        from daily_sync_report import generate_report
        generate_report()
