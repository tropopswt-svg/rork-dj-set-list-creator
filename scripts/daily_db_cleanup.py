#!/usr/bin/env python3
"""
Daily Database Cleanup Script
Deduplicates artists, tracks, and sets; normalizes data; fixes broken references.

Runs after the daily sync to keep the database clean.

Usage:
    python scripts/daily_db_cleanup.py [--dry-run]
"""

import os
import sys
import re
import logging
import argparse
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

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

from supabase import create_client, Client

SUPABASE_URL = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("db_cleanup")


# ---------------------------------------------------------------------------
# Text Normalization (mirrors the app's normalizeText)
# ---------------------------------------------------------------------------

def normalize_text(text: str) -> str:
    """Normalize text for matching - mirrors lib/supabase/artistService.ts"""
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def generate_slug(name: str) -> str:
    """Generate URL-friendly slug."""
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def levenshtein_similarity(s1: str, s2: str) -> float:
    """Calculate similarity between two strings (0-1)."""
    s1 = normalize_text(s1)
    s2 = normalize_text(s2)
    if s1 == s2:
        return 1.0
    len1, len2 = len(s1), len(s2)
    if len1 == 0 or len2 == 0:
        return 0.0
    matrix = [[0] * (len2 + 1) for _ in range(len1 + 1)]
    for i in range(len1 + 1):
        matrix[i][0] = i
    for j in range(len2 + 1):
        matrix[0][j] = j
    for i in range(1, len1 + 1):
        for j in range(1, len2 + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            matrix[i][j] = min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost,
            )
    distance = matrix[len1][len2]
    return 1 - distance / max(len1, len2)


# ---------------------------------------------------------------------------
# Fetch helpers (paginated for large tables)
# ---------------------------------------------------------------------------

def fetch_all(supabase: Client, table: str, columns: str, page_size: int = 1000) -> list:
    """Fetch all rows from a table, handling pagination."""
    all_rows = []
    offset = 0
    while True:
        result = (
            supabase.table(table)
            .select(columns)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = result.data or []
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size
    return all_rows


# ---------------------------------------------------------------------------
# 1. Artist Deduplication
# ---------------------------------------------------------------------------

def dedup_artists(supabase: Client, dry_run: bool = False) -> dict:
    """
    Find and merge duplicate artists.
    Keeps the artist with the most data (sets_count + tracks_count) as canonical.
    Re-points tracks, sets, and set_tracks to the canonical artist.
    Creates aliases for the merged names.
    """
    stats = {"duplicates_found": 0, "artists_merged": 0}

    log.info("--- Artist Deduplication ---")
    artists = fetch_all(supabase, "artists", "id, name, slug, sets_count, tracks_count, spotify_url, verified")

    # Group by normalized name
    name_groups = defaultdict(list)
    for a in artists:
        key = normalize_text(a["name"])
        if key:
            name_groups[key].append(a)

    for norm_name, group in name_groups.items():
        if len(group) <= 1:
            continue

        stats["duplicates_found"] += len(group) - 1

        # Pick canonical: prefer verified, then most data, then has spotify
        def score(a):
            s = (a.get("sets_count") or 0) + (a.get("tracks_count") or 0)
            if a.get("verified"):
                s += 10000
            if a.get("spotify_url"):
                s += 100
            return s

        group.sort(key=score, reverse=True)
        canonical = group[0]
        duplicates = group[1:]

        log.info(f"  Merging '{norm_name}': keeping '{canonical['name']}' (id={canonical['id'][:8]}), "
                 f"merging {len(duplicates)} duplicate(s)")

        if dry_run:
            continue

        for dup in duplicates:
            dup_id = dup["id"]
            canonical_id = canonical["id"]

            # Re-point tracks to canonical artist
            supabase.table("tracks").update(
                {"artist_id": canonical_id, "artist_name": canonical["name"]}
            ).eq("artist_id", dup_id).execute()

            # Re-point sets to canonical artist
            supabase.table("sets").update(
                {"artist_id": canonical_id, "artist_name": canonical["name"]}
            ).eq("artist_id", dup_id).execute()

            # Re-point set_tracks raw_artist
            supabase.table("set_tracks").update(
                {"raw_artist": canonical["name"]}
            ).eq("raw_artist", dup["name"]).execute()

            # Create alias for the duplicate name if different
            if dup["name"] != canonical["name"]:
                alias_lower = normalize_text(dup["name"])
                # Check if alias already exists
                existing = (
                    supabase.table("artist_aliases")
                    .select("id")
                    .eq("artist_id", canonical_id)
                    .eq("alias_lower", alias_lower)
                    .execute()
                )
                if not existing.data:
                    supabase.table("artist_aliases").insert({
                        "artist_id": canonical_id,
                        "alias": dup["name"],
                        "alias_lower": alias_lower,
                    }).execute()

            # Move any aliases from the dup to canonical
            supabase.table("artist_aliases").update(
                {"artist_id": canonical_id}
            ).eq("artist_id", dup_id).execute()

            # Delete the duplicate artist
            supabase.table("artists").delete().eq("id", dup_id).execute()
            stats["artists_merged"] += 1

    log.info(f"  Artist dedup: {stats['duplicates_found']} duplicates found, {stats['artists_merged']} merged")
    return stats


# ---------------------------------------------------------------------------
# 2. Track Deduplication
# ---------------------------------------------------------------------------

def dedup_tracks(supabase: Client, dry_run: bool = False) -> dict:
    """
    Find and merge duplicate tracks (same normalized title + artist).
    Keeps the track with the most metadata as canonical.
    Re-points set_tracks to the canonical track.
    """
    stats = {"duplicates_found": 0, "tracks_merged": 0}

    log.info("--- Track Deduplication ---")
    tracks = fetch_all(
        supabase, "tracks",
        "id, title, title_normalized, artist_id, artist_name, label, bpm, spotify_url, "
        "beatport_url, soundcloud_url, times_played, verified, enriched_at"
    )

    # Group by (title_normalized, artist_name normalized)
    track_groups = defaultdict(list)
    for t in tracks:
        title_norm = (t.get("title_normalized") or normalize_text(t.get("title", ""))).strip()
        artist_norm = normalize_text(t.get("artist_name") or "")
        key = (title_norm, artist_norm)
        if title_norm:
            track_groups[key].append(t)

    for (title_norm, artist_norm), group in track_groups.items():
        if len(group) <= 1:
            continue

        stats["duplicates_found"] += len(group) - 1

        # Pick canonical: prefer verified, then enriched, then most metadata
        def score(t):
            s = 0
            if t.get("verified"):
                s += 10000
            if t.get("enriched_at"):
                s += 1000
            if t.get("spotify_url"):
                s += 100
            if t.get("bpm"):
                s += 50
            if t.get("label"):
                s += 25
            if t.get("beatport_url"):
                s += 25
            s += (t.get("times_played") or 0)
            return s

        group.sort(key=score, reverse=True)
        canonical = group[0]
        duplicates = group[1:]

        log.info(f"  Merging track '{artist_norm} - {title_norm}': "
                 f"keeping id={canonical['id'][:8]}, merging {len(duplicates)} dup(s)")

        if dry_run:
            continue

        for dup in duplicates:
            dup_id = dup["id"]
            canonical_id = canonical["id"]

            # Re-point set_tracks to canonical
            supabase.table("set_tracks").update(
                {"track_id": canonical_id}
            ).eq("track_id", dup_id).execute()

            # Create track alias if titles differ
            if dup.get("title") and dup["title"] != canonical.get("title"):
                alias_norm = normalize_text(dup["title"])
                existing = (
                    supabase.table("track_aliases")
                    .select("id")
                    .eq("track_id", canonical_id)
                    .eq("title_alias_normalized", alias_norm)
                    .execute()
                )
                if not existing.data:
                    supabase.table("track_aliases").insert({
                        "track_id": canonical_id,
                        "title_alias": dup["title"],
                        "title_alias_normalized": alias_norm,
                    }).execute()

            # Move aliases from dup to canonical
            supabase.table("track_aliases").update(
                {"track_id": canonical_id}
            ).eq("track_id", dup_id).execute()

            # Merge metadata: fill in blanks on canonical from the dup
            updates = {}
            for field in ["label", "bpm", "key", "spotify_url", "beatport_url",
                          "soundcloud_url", "youtube_url", "release_year", "isrc",
                          "artwork_url", "duration_seconds"]:
                if not canonical.get(field) and dup.get(field):
                    updates[field] = dup[field]
            if updates:
                supabase.table("tracks").update(updates).eq("id", canonical_id).execute()

            # Aggregate times_played
            combined_plays = (canonical.get("times_played") or 0) + (dup.get("times_played") or 0)
            supabase.table("tracks").update(
                {"times_played": combined_plays}
            ).eq("id", canonical_id).execute()

            # Delete the duplicate
            supabase.table("tracks").delete().eq("id", dup_id).execute()
            stats["tracks_merged"] += 1

    log.info(f"  Track dedup: {stats['duplicates_found']} duplicates found, {stats['tracks_merged']} merged")
    return stats


# ---------------------------------------------------------------------------
# 3. Set Deduplication
# ---------------------------------------------------------------------------

def dedup_sets(supabase: Client, dry_run: bool = False) -> dict:
    """Find and merge duplicate sets (same external_id or same name+artist)."""
    stats = {"duplicates_found": 0, "sets_merged": 0}

    log.info("--- Set Deduplication ---")
    sets = fetch_all(supabase, "sets", "id, name, artist_name, external_id, tracks_count, created_at")

    # Group by external_id first (most reliable)
    ext_id_groups = defaultdict(list)
    for s in sets:
        if s.get("external_id"):
            ext_id_groups[s["external_id"]].append(s)

    # Also group by normalized name + artist
    name_groups = defaultdict(list)
    for s in sets:
        key = (normalize_text(s.get("name", "")), normalize_text(s.get("artist_name", "")))
        if key[0]:
            name_groups[key].append(s)

    # Merge both group sources, dedup by set id
    all_groups = []
    seen_set_ids = set()

    for group in list(ext_id_groups.values()) + list(name_groups.values()):
        if len(group) <= 1:
            continue
        group_ids = frozenset(s["id"] for s in group)
        if group_ids not in seen_set_ids:
            seen_set_ids.add(group_ids)
            all_groups.append(group)

    for group in all_groups:
        stats["duplicates_found"] += len(group) - 1

        # Keep the one with more tracks
        group.sort(key=lambda s: (s.get("tracks_count") or 0), reverse=True)
        canonical = group[0]
        duplicates = group[1:]

        log.info(f"  Merging set '{canonical.get('name', 'Unknown')}': "
                 f"keeping id={canonical['id'][:8]} ({canonical.get('tracks_count', 0)} tracks), "
                 f"merging {len(duplicates)} dup(s)")

        if dry_run:
            continue

        for dup in duplicates:
            # Delete set_tracks for the dup (cascade should handle this,
            # but be explicit to avoid orphans)
            supabase.table("set_tracks").delete().eq("set_id", dup["id"]).execute()
            supabase.table("sets").delete().eq("id", dup["id"]).execute()
            stats["sets_merged"] += 1

    log.info(f"  Set dedup: {stats['duplicates_found']} duplicates found, {stats['sets_merged']} merged")
    return stats


# ---------------------------------------------------------------------------
# 4. Data Normalization Fixes
# ---------------------------------------------------------------------------

def fix_normalization(supabase: Client, dry_run: bool = False) -> dict:
    """Fix missing normalized fields, slugs, and broken references."""
    stats = {"tracks_fixed": 0, "artists_fixed": 0, "orphans_cleaned": 0}

    log.info("--- Data Normalization ---")

    # Fix tracks missing title_normalized
    tracks = fetch_all(supabase, "tracks", "id, title, title_normalized")
    for t in tracks:
        expected_norm = normalize_text(t.get("title", ""))
        current_norm = (t.get("title_normalized") or "").strip()
        if expected_norm and expected_norm != current_norm:
            if not dry_run:
                supabase.table("tracks").update(
                    {"title_normalized": expected_norm}
                ).eq("id", t["id"]).execute()
            stats["tracks_fixed"] += 1

    if stats["tracks_fixed"]:
        log.info(f"  Fixed {stats['tracks_fixed']} tracks with missing/incorrect title_normalized")

    # Fix artists missing slugs
    artists = fetch_all(supabase, "artists", "id, name, slug")
    for a in artists:
        expected_slug = generate_slug(a.get("name", ""))
        if expected_slug and not a.get("slug"):
            if not dry_run:
                supabase.table("artists").update(
                    {"slug": expected_slug}
                ).eq("id", a["id"]).execute()
            stats["artists_fixed"] += 1

    if stats["artists_fixed"]:
        log.info(f"  Fixed {stats['artists_fixed']} artists with missing slugs")

    # Clean up orphaned set_tracks (pointing to deleted tracks or sets)
    set_tracks = fetch_all(supabase, "set_tracks", "id, set_id, track_id")
    set_ids = {s["id"] for s in fetch_all(supabase, "sets", "id")}
    track_ids = {t["id"] for t in tracks}

    orphaned = []
    for st in set_tracks:
        if st["set_id"] not in set_ids:
            orphaned.append(st["id"])
        elif st.get("track_id") and st["track_id"] not in track_ids:
            # Track was deleted - null out the reference rather than deleting
            if not dry_run:
                supabase.table("set_tracks").update({"track_id": None}).eq("id", st["id"]).execute()
            stats["orphans_cleaned"] += 1

    # Delete set_tracks pointing to deleted sets
    for orphan_id in orphaned:
        if not dry_run:
            supabase.table("set_tracks").delete().eq("id", orphan_id).execute()
        stats["orphans_cleaned"] += 1

    if stats["orphans_cleaned"]:
        log.info(f"  Cleaned {stats['orphans_cleaned']} orphaned set_track references")

    return stats


# ---------------------------------------------------------------------------
# 5. Artist Name Normalization
# ---------------------------------------------------------------------------

def normalize_artist_names(supabase: Client, dry_run: bool = False) -> dict:
    """
    Fix common artist name issues:
    - Extra whitespace
    - Inconsistent casing (e.g., "CHRIS STUSSY" vs "Chris Stussy")
    - Trailing/leading special characters
    """
    stats = {"names_fixed": 0}

    log.info("--- Artist Name Normalization ---")
    artists = fetch_all(supabase, "artists", "id, name, slug")

    for a in artists:
        name = a.get("name", "")
        if not name:
            continue

        # Fix extra whitespace
        cleaned = re.sub(r"\s+", " ", name).strip()

        # Fix names that are ALL CAPS (convert to title case)
        if cleaned == cleaned.upper() and len(cleaned) > 3:
            # But keep short names like "DJ" or "MK" as-is
            words = cleaned.split()
            title_words = []
            for w in words:
                if len(w) <= 3 or w in ("DJ", "MC", "MK", "GW", "ZHU", "CID"):
                    title_words.append(w)
                else:
                    title_words.append(w.title())
            cleaned = " ".join(title_words)

        # Remove trailing/leading special chars (but keep & in names like "Above & Beyond")
        cleaned = re.sub(r"^[,.\-:;]+", "", cleaned).strip()
        cleaned = re.sub(r"[,.\-:;]+$", "", cleaned).strip()

        if cleaned != name:
            log.info(f"  Name fix: '{name}' -> '{cleaned}'")
            if not dry_run:
                new_slug = generate_slug(cleaned)
                supabase.table("artists").update(
                    {"name": cleaned, "slug": new_slug}
                ).eq("id", a["id"]).execute()
            stats["names_fixed"] += 1

    if stats["names_fixed"]:
        log.info(f"  Fixed {stats['names_fixed']} artist names")

    return stats


# ---------------------------------------------------------------------------
# 6. Update Denormalized Counts
# ---------------------------------------------------------------------------

def update_counts(supabase: Client, dry_run: bool = False) -> dict:
    """Recalculate denormalized counts (tracks_count, sets_count on artists)."""
    stats = {"counts_updated": 0}

    log.info("--- Updating Denormalized Counts ---")

    artists = fetch_all(supabase, "artists", "id, tracks_count, sets_count")
    tracks = fetch_all(supabase, "tracks", "id, artist_id")
    sets_data = fetch_all(supabase, "sets", "id, artist_id")

    # Count tracks per artist
    artist_track_counts = defaultdict(int)
    for t in tracks:
        if t.get("artist_id"):
            artist_track_counts[t["artist_id"]] += 1

    # Count sets per artist
    artist_set_counts = defaultdict(int)
    for s in sets_data:
        if s.get("artist_id"):
            artist_set_counts[s["artist_id"]] += 1

    for a in artists:
        aid = a["id"]
        expected_tracks = artist_track_counts.get(aid, 0)
        expected_sets = artist_set_counts.get(aid, 0)
        current_tracks = a.get("tracks_count") or 0
        current_sets = a.get("sets_count") or 0

        if expected_tracks != current_tracks or expected_sets != current_sets:
            if not dry_run:
                supabase.table("artists").update({
                    "tracks_count": expected_tracks,
                    "sets_count": expected_sets,
                }).eq("id", aid).execute()
            stats["counts_updated"] += 1

    if stats["counts_updated"]:
        log.info(f"  Updated counts for {stats['counts_updated']} artists")

    return stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run_cleanup(dry_run: bool = False):
    """Run all cleanup tasks."""
    log.info("=" * 60)
    log.info(f"Starting database cleanup at {datetime.now().isoformat()}")
    log.info(f"Dry run: {dry_run}")
    log.info("=" * 60)

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    all_stats = {}
    all_stats["artist_dedup"] = dedup_artists(supabase, dry_run)
    all_stats["track_dedup"] = dedup_tracks(supabase, dry_run)
    all_stats["set_dedup"] = dedup_sets(supabase, dry_run)
    all_stats["normalization"] = fix_normalization(supabase, dry_run)
    all_stats["name_fixes"] = normalize_artist_names(supabase, dry_run)
    all_stats["counts"] = update_counts(supabase, dry_run)

    log.info("\n" + "=" * 60)
    log.info("CLEANUP COMPLETE")
    log.info(f"  Artists merged: {all_stats['artist_dedup']['artists_merged']}")
    log.info(f"  Tracks merged: {all_stats['track_dedup']['tracks_merged']}")
    log.info(f"  Sets merged: {all_stats['set_dedup']['sets_merged']}")
    log.info(f"  Normalization fixes: {all_stats['normalization']['tracks_fixed'] + all_stats['normalization']['artists_fixed']}")
    log.info(f"  Name fixes: {all_stats['name_fixes']['names_fixed']}")
    log.info(f"  Count updates: {all_stats['counts']['counts_updated']}")
    log.info("=" * 60)

    return all_stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Daily database cleanup & deduplication")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()

    run_cleanup(dry_run=args.dry_run)
