/**
 * Shared track utility functions for unreleased detection and title cleaning.
 * Used across all API endpoints that write track_title to set_tracks.
 */

const UNRELEASED_INDICATORS = [
  /\(unreleased\s*\??\)/i,
  /\(forthcoming\)/i,
  /\(dub\s*\??\)/i,
  /\(dubplate\)/i,
  /\(white\s*label\)/i,
  /\(VIP\)/i,
  /\bunreleased\b/i,
  /\bforthcoming\b/i,
  /\bdubplate\b/i,
  /\bwhite\s*label\b/i,
];

/**
 * Returns true if text contains unreleased indicators.
 */
export function detectUnreleasedInText(text) {
  if (!text) return false;
  return UNRELEASED_INDICATORS.some(pattern => pattern.test(text));
}

/**
 * Strip unreleased indicator text from a track title so it displays cleanly.
 * Handles both full parenthetical like "(unreleased)" and broken fragments like "(unreleased"
 */
export function stripUnreleasedFromTitle(title) {
  if (!title) return title;
  let cleaned = title;
  cleaned = cleaned.replace(/\s*\(?\s*unreleased\s*\??\s*\)?\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\(?\s*forthcoming\s*\)?\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\(\s*dub\s*\??\s*\)\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\(?\s*dubplate\s*\)?\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\(?\s*white\s*label\s*\)?\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*\(\s*VIP\s*\)\s*/gi, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/\(\s*$/, '').replace(/^\s*\)/, '').trim();
  return cleaned;
}

/**
 * Clean a track title: detect unreleased indicators and strip them.
 * Returns { title, isUnreleased } — the cleaned title and whether it was flagged.
 */
export function cleanTrackTitleUnreleased(title) {
  if (!title) return { title, isUnreleased: false };
  const isUnreleased = detectUnreleasedInText(title);
  const cleanedTitle = isUnreleased ? stripUnreleasedFromTitle(title) : title;
  return { title: cleanedTitle, isUnreleased };
}
