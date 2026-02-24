import type { Track } from '@/types';

export type PublicTrackStatus = 'released' | 'unreleased' | 'id' | 'identified';

/**
 * Product rule (public): 4 states.
 * - released    — confirmed on Spotify
 * - unreleased  — explicitly flagged as unreleased
 * - identified  — has a real title/artist but no Spotify confirmation
 * - id          — unknown / unresolved placeholder
 */
export function getPublicTrackStatus(track: Partial<Track> & { title?: string; artist?: string }): PublicTrackStatus {
  const title = (track.title || '').trim().toLowerCase();
  const artist = (track.artist || '').trim().toLowerCase();

  // A track is truly unidentified only if its title/artist are placeholders.
  // If isId is set but the track has a real name, the flag is stale — ignore it.
  const titleIsPlaceholder = !title || title === 'id' || title === 'unknown' || title === 'unknown track';
  const artistIsPlaceholder = !artist || artist === 'id' || artist === 'unknown' || artist === 'unknown artist';

  const explicitId = titleIsPlaceholder && artistIsPlaceholder;
  const inferredId = track.isId === true && titleIsPlaceholder;

  if (explicitId || inferredId) return 'id';

  // Only real Spotify signals count as "released"
  const hasReleasedSignal =
    track.isReleased === true ||
    !!track.trackLinks?.some((l) => l.platform === 'spotify');

  // A track found on Spotify is released — never show unreleased badge
  if (hasReleasedSignal) return 'released';
  if (track.isUnreleased === true) return 'unreleased';

  // Has a real title and artist but no Spotify match — identified but not confirmed
  return 'identified';
}

/** Internal-only confidence utility. Not for user-facing UI. */
export function getInternalConfidence(track: Partial<Track>): number {
  if (typeof track.confidence === 'number') return track.confidence;
  const status = getPublicTrackStatus(track);
  if (status === 'released') return 0.9;
  if (status === 'identified') return 0.8;
  if (status === 'unreleased') return 0.75;
  return 0.35;
}
