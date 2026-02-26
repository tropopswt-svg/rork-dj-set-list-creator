#!/usr/bin/env python3
"""
Daily House Sync Report
Checks Supabase for sets added in the last 24 hours by the daily sync,
and generates a summary report including the top 3 sets.

Usage:
    python scripts/daily_sync_report.py
"""

import os
import sys
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Load .env
PROJECT_ROOT = Path(__file__).resolve().parent.parent
env_path = PROJECT_ROOT / ".env"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

from supabase import create_client

SUPABASE_URL = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
REPORT_DIR = PROJECT_ROOT / "logs"
REPORT_DIR.mkdir(exist_ok=True)


def generate_report():
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Look for sets created in the last 24 hours
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    result = (
        supabase.table("sets")
        .select("id, name, artist_name, event_name, venue, set_date, tracks_count, created_at")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .execute()
    )

    new_sets = result.data or []
    today = datetime.now().strftime("%A, %B %d, %Y")

    # Build the report
    lines = []
    lines.append(f"{'=' * 50}")
    lines.append(f"  RORK DAILY HOUSE SYNC REPORT")
    lines.append(f"  {today}")
    lines.append(f"{'=' * 50}")
    lines.append("")

    if not new_sets:
        lines.append("No new sets were added in the last 24 hours.")
        lines.append("")
        lines.append("This could mean:")
        lines.append("  - All top sets were already in the database")
        lines.append("  - The sync script didn't run or encountered an error")
        lines.append(f"  - Check logs at: {REPORT_DIR / 'house_sync.log'}")
    else:
        lines.append(f"NEW SETS ADDED: {len(new_sets)}")
        lines.append("")

        # Top 3 sets (by tracks_count as a proxy for quality/completeness)
        top3 = sorted(new_sets, key=lambda s: s.get("tracks_count", 0) or 0, reverse=True)[:3]

        lines.append("--- TOP 3 SETS ---")
        lines.append("")
        for i, s in enumerate(top3, 1):
            name = s.get("name", "Unknown Set")
            artist = s.get("artist_name", "Unknown Artist")
            event = s.get("event_name", "")
            venue = s.get("venue", "")
            tracks = s.get("tracks_count", 0)
            set_date = s.get("set_date", "")

            lines.append(f"  #{i}  {artist}")
            lines.append(f"      {name}")
            if event:
                lines.append(f"      Event: {event}")
            if venue:
                lines.append(f"      Venue: {venue}")
            if set_date:
                lines.append(f"      Date: {set_date}")
            lines.append(f"      Tracks: {tracks}")
            lines.append("")

        # Full list
        if len(new_sets) > 3:
            lines.append("--- ALL NEW SETS ---")
            lines.append("")
            for s in new_sets:
                artist = s.get("artist_name", "Unknown")
                name = s.get("name", "Unknown")
                tracks = s.get("tracks_count", 0)
                lines.append(f"  - {artist} | {name} ({tracks} tracks)")
            lines.append("")

    lines.append(f"{'=' * 50}")

    report_text = "\n".join(lines)

    # Print to stdout
    print(report_text)

    # Save to file
    report_file = REPORT_DIR / f"sync_report_{datetime.now().strftime('%Y-%m-%d')}.txt"
    with open(report_file, "w") as f:
        f.write(report_text)

    print(f"\nReport saved to: {report_file}")


if __name__ == "__main__":
    generate_report()
