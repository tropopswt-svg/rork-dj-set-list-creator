// Import Service - Main entry point for importing sets from various platforms

import {
  importFromYouTube,
  extractVideoId,
  YouTubeVideoInfo,
  YouTubeComment,
} from './youtube';
import {
  parseComments,
  parseDescription,
  parsedTracksToTracks,
  ParsedTrack,
} from './trackParser';
import { SetList, Track, SourceLink } from '@/types';

// Backend API URL - set this in your environment
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

// Use backend API if available, otherwise fall back to direct API calls
const USE_BACKEND = !!API_BASE_URL;

export interface ImportProgress {
  step: 'detecting' | 'fetching' | 'scraping' | 'analyzing' | 'building' | 'complete' | 'error';
  message: string;
  commentsFound?: number;
  tracksFound?: number;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  setList?: SetList;
  error?: string;
  videoInfo?: YouTubeVideoInfo;
  commentsCount?: number;
  tracksCount?: number;
}

export type Platform = 'youtube' | 'soundcloud' | 'mixcloud';

export function detectPlatform(url: string): Platform | null {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('soundcloud.com')) return 'soundcloud';
  if (url.includes('mixcloud.com')) return 'mixcloud';
  return null;
}

function parseArtistFromTitle(title: string): { name: string; artist: string } {
  // Common patterns for DJ set titles:
  // "Artist @ Venue"
  // "Artist - Set Name"
  // "Artist | Venue"
  // "Artist live at Venue"

  const patterns = [
    /^(.+?)\s*[@|]\s*(.+)$/,
    /^(.+?)\s*[-–—]\s*(.+)$/,
    /^(.+?)\s+(?:live\s+)?(?:at|@)\s+(.+)$/i,
    /^(.+?)\s+(?:boiler\s+room|cercle|hor\s+berlin)/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return {
        artist: match[1].trim(),
        name: title,
      };
    }
  }

  // Fallback: use the whole title as name, extract artist from channel
  return {
    name: title,
    artist: 'Unknown Artist',
  };
}

function parseVenueFromTitle(title: string): string | undefined {
  const patterns = [
    /(?:@|at|live\s+at)\s+(.+?)(?:\s*[-–—|]|$)/i,
    /(?:boiler\s+room)\s+(.+?)(?:\s*[-–—|]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}

function parseDuration(isoDuration: string): number {
  // Parse ISO 8601 duration (PT1H30M45S)
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  return hours * 3600 + minutes * 60 + seconds;
}

export async function importSet(
  url: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const platform = detectPlatform(url);

  if (!platform) {
    return {
      success: false,
      error: 'Unsupported platform. Please use a YouTube, SoundCloud, or Mixcloud link.',
    };
  }

  onProgress?.({ step: 'detecting', message: `Detected ${platform} link...` });

  try {
    if (platform === 'youtube') {
      return await importFromYouTubeUrl(url, onProgress);
    } else if (platform === 'soundcloud') {
      return await importFromSoundCloudUrl(url, onProgress);
    } else {
      return {
        success: false,
        error: 'Mixcloud import is not yet supported.',
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    onProgress?.({ step: 'error', message, error: message });
    return {
      success: false,
      error: message,
    };
  }
}

async function importViaBackend(
  url: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  onProgress?.({ step: 'fetching', message: 'Connecting to server...' });

  const response = await fetch(`${API_BASE_URL}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  // Check content-type to ensure it's JSON before parsing
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Backend unavailable');
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Import failed');
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Import failed');
  }

  onProgress?.({
    step: 'complete',
    message: 'Import complete!',
    commentsFound: data.commentsCount,
    tracksFound: data.tracksCount,
  });

  // Convert date strings back to Date objects
  const setList: SetList = {
    ...data.setList,
    date: new Date(data.setList.date),
    tracks: data.setList.tracks.map((t: any) => ({
      ...t,
      addedAt: new Date(t.addedAt),
    })),
  };

  return {
    success: true,
    setList,
    videoInfo: data.videoInfo,
    commentsCount: data.commentsCount,
    tracksCount: data.tracksCount,
  };
}

async function importFromYouTubeUrl(
  url: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  // Try backend API if configured, fallback to client-side if it fails
  if (USE_BACKEND) {
    try {
      return await importViaBackend(url, onProgress);
    } catch (error) {
      console.warn('Backend import failed, falling back to client-side:', error);
      // Fall through to client-side parsing
    }
  }

  onProgress?.({ step: 'fetching', message: 'Fetching video metadata...' });

  const { video, comments } = await importFromYouTube(url);

  onProgress?.({
    step: 'scraping',
    message: 'Analyzing comments...',
    commentsFound: comments.length,
  });

  // Parse tracks from both description and comments
  const descriptionTracks = parseDescription(video.description);
  const commentTracks = parseComments(comments);

  onProgress?.({
    step: 'analyzing',
    message: 'Identifying tracks...',
    commentsFound: comments.length,
    tracksFound: descriptionTracks.length + commentTracks.length,
  });

  // Merge and deduplicate tracks
  const allParsedTracks = mergeTrackLists(descriptionTracks, commentTracks);

  onProgress?.({
    step: 'building',
    message: 'Building tracklist...',
    commentsFound: comments.length,
    tracksFound: allParsedTracks.length,
  });

  // Convert to Track objects
  const tracks = parsedTracksToTracks(allParsedTracks);

  // Parse set info from video title
  const { name, artist } = parseArtistFromTitle(video.title);
  const venue = parseVenueFromTitle(video.title);
  const totalDuration = parseDuration(video.duration);

  // Create the SetList
  const setList: SetList = {
    id: `yt-${video.id}-${Date.now()}`,
    name,
    artist: artist !== 'Unknown Artist' ? artist : video.channelTitle,
    venue,
    date: new Date(video.publishedAt),
    tracks,
    coverUrl: video.thumbnailUrl,
    sourceLinks: [{ platform: 'youtube', url }],
    totalDuration,
    aiProcessed: true,
    commentsScraped: comments.length,
    tracksIdentified: tracks.length,
    plays: 0,
  };

  onProgress?.({
    step: 'complete',
    message: 'Import complete!',
    commentsFound: comments.length,
    tracksFound: tracks.length,
  });

  return {
    success: true,
    setList,
    videoInfo: video,
    commentsCount: comments.length,
    tracksCount: tracks.length,
  };
}

async function importFromSoundCloudUrl(
  url: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  onProgress?.({ step: 'fetching', message: 'Fetching SoundCloud metadata...' });

  // SoundCloud oEmbed API for basic metadata
  const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`;

  try {
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch SoundCloud metadata');
    }

    const data = await response.json();

    onProgress?.({
      step: 'analyzing',
      message: 'Processing metadata...',
      commentsFound: 0,
    });

    // SoundCloud doesn't expose comments via public API
    // We can only get basic metadata from oEmbed

    const setList: SetList = {
      id: `sc-${Date.now()}`,
      name: data.title || 'SoundCloud Set',
      artist: data.author_name || 'Unknown Artist',
      venue: undefined,
      date: new Date(),
      tracks: [],
      coverUrl: data.thumbnail_url,
      sourceLinks: [{ platform: 'soundcloud', url }],
      totalDuration: 0,
      aiProcessed: false,
      commentsScraped: 0,
      tracksIdentified: 0,
      plays: 0,
    };

    onProgress?.({
      step: 'complete',
      message: 'Import complete! (Note: SoundCloud comments require API access)',
      commentsFound: 0,
      tracksFound: 0,
    });

    return {
      success: true,
      setList,
      commentsCount: 0,
      tracksCount: 0,
    };
  } catch (error) {
    throw new Error('SoundCloud import failed. The track may be private or the URL invalid.');
  }
}

function mergeTrackLists(descTracks: ParsedTrack[], commentTracks: ParsedTrack[]): ParsedTrack[] {
  const merged = new Map<number, ParsedTrack>();

  // Description tracks have higher priority
  for (const track of descTracks) {
    merged.set(track.timestamp, track);
  }

  // Add comment tracks if no description track at same timestamp
  for (const track of commentTracks) {
    // Allow some tolerance (within 30 seconds)
    const existingTimestamp = Array.from(merged.keys()).find(
      ts => Math.abs(ts - track.timestamp) < 30
    );

    if (!existingTimestamp) {
      merged.set(track.timestamp, track);
    } else {
      // If comment track has higher confidence, consider replacing
      const existing = merged.get(existingTimestamp)!;
      if (track.confidence > existing.confidence + 0.2) {
        merged.set(track.timestamp, track);
      }
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
}
