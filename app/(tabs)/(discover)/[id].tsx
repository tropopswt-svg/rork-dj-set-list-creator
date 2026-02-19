import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Play,
  Share2,
  Plus,
  ExternalLink,
  Youtube,
  Music2,
  ListMusic,
  MessageSquare,
  Sparkles,
  Users,
  Clock,
  CheckCircle,
  Bookmark,
  BookmarkCheck,
  AlertCircle,
  Radio,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import TrackCard from '@/components/TrackCard';
import AddTrackModal from '@/components/AddTrackModal';
import FillGapModal from '@/components/FillGapModal';
import ArtistLink from '@/components/ArtistLink';
import TrackdLogo from '@/components/TrackdLogo';
import ContributorModal from '@/components/ContributorModal';
import AddSourceModal from '@/components/AddSourceModal';
import InlineConflictOptions from '@/components/InlineConflictOptions';
import PointsBadge from '@/components/PointsBadge';
import YouTubePlayer, { extractYouTubeId } from '@/components/YouTubePlayer';
import TrackDetailModal from '@/components/TrackDetailModal';
import AudioPreviewModal from '@/components/AudioPreviewModal';
import IdentifyTrackModal from '@/components/IdentifyTrackModal';
import CommentsSection from '@/components/CommentsSection';
import WaveformTimeline from '@/components/WaveformTimeline';
import SimilarSets from '@/components/SimilarSets';
import IDThisModal from '@/components/IDThisModal';
import { Track, SourceLink, TrackConflict, SetList } from '@/types';
import { isSetSaved, saveSetToLibrary, removeSetFromLibrary } from '@/utils/storage';
import { useSets } from '@/contexts/SetsContext';
import { useUser } from '@/contexts/UserContext';

// API base URL
const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

export default function SetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sets, addSourceToSet, voteOnConflict, getActiveConflicts, addTracksToSet } = useSets();
  const { userId, addPoints } = useUser();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showFillGapModal, setShowFillGapModal] = useState(false);
  const [fillGapTimestamp, setFillGapTimestamp] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);

  // Database set state
  const [dbSet, setDbSet] = useState<SetList | null>(null);
  const [isLoadingSet, setIsLoadingSet] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add Source Modal state
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<'youtube' | 'soundcloud'>('youtube');

  // Track Detail Modal state
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [pendingTimestamp, setPendingTimestamp] = useState<number | null>(null);

  // Audio Preview Modal state (for identifying unknown tracks)
  const [audioPreviewTrack, setAudioPreviewTrack] = useState<Track | null>(null);

  // Identify Track Modal state (for ACRCloud identification)
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [identifyTimestamp, setIdentifyTimestamp] = useState(0);

  // ID This Modal state
  const [showIDThisModal, setShowIDThisModal] = useState(false);
  const [idThisTrack, setIdThisTrack] = useState<Track | null>(null);

  // Track votes on timestamp conflicts (conflictTimestamp -> selected track)
  const [timestampVotes, setTimestampVotes] = useState<Record<number, Track>>({});

  // Pick-and-place: tap an unplaced track to pick it, then tap a gap to place it
  const [pickedTrack, setPickedTrack] = useState<Track | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // YouTube Player state
  const [showPlayer, setShowPlayer] = useState(false);
  const [playerMinimized, setPlayerMinimized] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);

  // Fetch set from API — reset all state when id changes
  useEffect(() => {
    // Reset state for new set navigation (e.g., clicking a similar set)
    setDbSet(null);
    setIsLoadingSet(true);
    setLoadError(null);
    setTimestampVotes({});
    setSelectedTrack(null);
    setShowPlayer(false);
    setPlayerMinimized(false);

    const fetchSet = async () => {
      if (!id) return;

      try {
        const response = await fetch(`${API_BASE_URL}/api/sets/${id}`);
        const data = await response.json();

        if (data.success && data.set) {
          // Transform API response to match SetList type
          const transformedSet: SetList = {
            id: data.set.id,
            name: data.set.name,
            artist: data.set.artist,
            venue: data.set.venue,
            date: new Date(data.set.date),
            totalDuration: data.set.totalDuration || 0,
            coverUrl: data.set.coverUrl || undefined,
            plays: data.set.trackCount * 10,
            sourceLinks: data.set.sourceLinks || [],
            tracks: data.set.tracks?.map((t: any) => ({
              id: t.id,
              title: t.title,
              artist: t.artist,
              duration: 0,
              coverUrl: t.coverUrl || '',
              addedAt: new Date(t.addedAt || Date.now()),
              source: t.source || 'database',
              timestamp: t.timestamp || 0,
              timestampStr: t.timestampStr,
              verified: t.verified || !t.isId,
              confidence: t.isId ? 0 : 1,
              isId: t.isId,
              isReleased: t.isReleased || false,
              previewUrl: t.previewUrl || undefined,
              isrc: t.isrc || undefined,
              releaseDate: t.releaseDate || undefined,
              popularity: t.popularity || undefined,
              trackLinks: t.trackLinks || [],
              album: t.album || undefined,
            })) || [],
            hasGaps: data.set.hasGaps,
            gapCount: data.set.gapCount,
          };
          setDbSet(transformedSet);
          if (__DEV__) console.log('[SetDetail] Loaded set from API:', transformedSet.name, 'with', transformedSet.tracks?.length, 'tracks');
        } else {
          setLoadError('Set not found.');
        }
      } catch (error) {
        setLoadError('Failed to load set. Check your connection and try again.');
      } finally {
        setIsLoadingSet(false);
      }
    };

    fetchSet();
  }, [id]);

  // Look up set from API first, then context, then mock data
  const setList = useMemo(() => {
    // First try database set
    if (dbSet) {
      return dbSet;
    }
    // Then try real sets from context
    const realSet = sets.find(s => s.id === id);
    if (realSet) {
      return realSet;
    }
    return undefined;
  }, [id, sets, dbSet]); // Re-run when sets or id changes
  
  // Tracks come directly from setList (no separate state needed for reactivity)
  const tracks = useMemo(() => {
    return setList?.tracks || [];
  }, [setList]);

  // Get conflicts for this set
  const conflicts = useMemo(() => {
    if (!id) return [];
    return getActiveConflicts(id);
  }, [id, getActiveConflicts]);

  // Helper: check if a track is low quality (garbage, placeholder, or noise)
  // Defined here so it can be used for both timeline and unplaced filtering
  const isLowQualityTrack = useCallback((track: Track): boolean => {
    const title = (track.title || '').trim();
    const artist = (track.artist || '').trim();
    const titleLower = title.toLowerCase();
    const artistLower = artist.toLowerCase();

    // 1. Pure ID/unknown placeholders
    const idValues = ['id', '', 'unknown', 'unknown track', 'unknown artist', 'tba', 'tbc'];
    if (idValues.includes(titleLower) && idValues.includes(artistLower)) return true;

    // 2. ID - ID patterns (catch "ID - ID", "ID ID", "ID?", etc.)
    if (/^id\s*[-–—]?\s*id$/i.test(`${titleLower} ${artistLower}`.trim())) return true;
    if (/^id\s*[-–—]\s*id$/i.test(title)) return true;
    if (/^id\?*$/i.test(titleLower) && /^id\?*$/i.test(artistLower)) return true;
    if (/\bid\b.*\bid\b/i.test(title)) return true;

    // 3. Very short content (< 3 alpha chars in title)
    const titleAlpha = (title.match(/[a-zA-Z]/g) || []).length;
    const artistAlpha = (artist.match(/[a-zA-Z]/g) || []).length;
    if (titleAlpha < 3 && artistAlpha < 3) return true;

    // 4. Title is a reaction/comment, not a track name
    const garbagePatterns = [
      /^(love|loving|loved)\s/i, /^(this|that)\s+(is|was|set)/i,
      /^(so|very|really)\s+(good|fire|sick|crazy)/i,
      /^(banger|fire|heater|sick|insane|crazy|absolute|unreal)!*$/i,
      /^anyone\s+(know|got)/i, /^what\s+(is|was|a)\s/i,
      /^(can|does)\s+(someone|anyone)/i, /^not\s+sure/i,
      /^i\s+(love|need|remember|think)/i, /^(ooph|grimy|dark|sheez|oooi)/i,
      /^listen\s+to/i, /^check\s+(out|it)/i,
      /^(the|this|that)\s+\w+\s+(is|was)\s/i,
      /^(amazing|incredible)\s/i, /starting\s+at/i,
    ];
    if (garbagePatterns.some(p => p.test(title))) return true;

    // 5. Title equals artist (parsing error — same text landed in both fields)
    if (titleLower === artistLower && titleLower !== '') return true;

    // 6. Confidence below threshold
    if (track.confidence !== undefined && track.confidence < 0.35) return true;

    return false;
  }, []);

  // Separate tracks into those with timestamps (timeline) and those without (unplaced)
  const { timedTracks, unplacedTracks } = useMemo(() => {
    const timed: Track[] = [];
    const unplaced: Track[] = [];

    for (const track of tracks) {
      // Filter out low quality tracks from BOTH lists
      if (isLowQualityTrack(track)) continue;

      if (track.timestamp && track.timestamp > 0) {
        timed.push(track);
      } else {
        unplaced.push(track);
      }
    }

    // Deduplicate unplaced tracks (same title+artist appearing multiple times)
    const normalizeStr = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const dedupedUnplaced: Track[] = [];
    for (const track of unplaced) {
      const isDupe = dedupedUnplaced.some(existing => {
        const existTitle = normalizeStr(existing.title);
        const existArtist = normalizeStr(existing.artist);
        const newTitle = normalizeStr(track.title);
        const newArtist = normalizeStr(track.artist);
        // Exact match
        if (existTitle === newTitle && existArtist === newArtist) return true;
        // Title substring match (one contains the other)
        if (existTitle && newTitle && (existTitle.includes(newTitle) || newTitle.includes(existTitle))) {
          if (!existArtist || !newArtist || existArtist === newArtist) return true;
        }
        return false;
      });
      if (!isDupe) {
        dedupedUnplaced.push(track);
      }
    }

    // Sort timed tracks by timestamp
    timed.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    return { timedTracks: timed, unplacedTracks: dedupedUnplaced };
  }, [tracks, isLowQualityTrack]);

  // For backward compatibility
  const sortedTracks = timedTracks;

  // Create a combined list of tracks and inline conflicts, sorted by timestamp
  type TracklistItem =
    | { type: 'track'; data: Track }
    | { type: 'gap'; timestamp: number; duration: number; gapId: string }
    | { type: 'conflict'; data: TrackConflict }
    | { type: 'timestamp-conflict'; tracks: Track[]; timestamp: number };

  // Smart timestamp conflict detection and tracklist building
  const { tracklistItems, estimatedMissingTracks } = useMemo<{
    tracklistItems: TracklistItem[];
    estimatedMissingTracks: number;
  }>(() => {
    // Get max valid timestamp from set duration (use totalDuration or fallback to 2 hours)
    const maxValidTimestamp = (setList?.totalDuration && setList.totalDuration > 0)
      ? setList.totalDuration + 60 // Add 1 min buffer for tracks that might start near the end
      : 7200; // Default 2 hour max if no duration

    // Helper: normalize string for comparison (remove special chars, lowercase)
    const normalizeStr = (s: string | undefined): string => {
      if (!s) return '';
      return s.toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
        .replace(/feat|ft|featuring/g, '') // Remove featuring indicators
        .trim();
    };

    // Helper: check if two tracks are essentially the same song
    const isSameTrack = (a: Track, b: Track): boolean => {
      const titleA = normalizeStr(a.title);
      const titleB = normalizeStr(b.title);
      const artistA = normalizeStr(a.artist);
      const artistB = normalizeStr(b.artist);

      // Exact match
      if (titleA === titleB && artistA === artistB) return true;

      // Title contains the other (e.g., "The One" vs "You are the one")
      const titleMatch = titleA.includes(titleB) || titleB.includes(titleA);
      // Artist contains the other (e.g., "Chloe Caillet" vs "Unreleased Chloe Caillet")
      const artistMatch = artistA.includes(artistB) || artistB.includes(artistA);

      // If both title and artist partially match, likely same track
      if (titleMatch && artistMatch) return true;

      // Check for very similar titles with same artist base
      if (artistMatch && (
        titleA.length > 5 && titleB.length > 5 &&
        (titleA.includes(titleB.slice(0, 6)) || titleB.includes(titleA.slice(0, 6)))
      )) {
        return true;
      }

      // Check for swapped title/artist (common parsing error)
      const titleInOtherArtist = titleA.length > 5 && artistB.includes(titleA.slice(0, Math.min(8, titleA.length)));
      const artistInOtherTitle = artistA.length > 5 && titleB.includes(artistA.slice(0, Math.min(8, artistA.length)));
      const otherTitleInArtist = titleB.length > 5 && artistA.includes(titleB.slice(0, Math.min(8, titleB.length)));
      const otherArtistInTitle = artistB.length > 5 && titleA.includes(artistB.slice(0, Math.min(8, artistB.length)));

      if ((titleInOtherArtist || otherArtistInTitle) && (artistInOtherTitle || otherTitleInArtist)) {
        return true;
      }

      // Check if title contains mix/remix info that matches
      if (titleA.length > titleB.length && titleA.includes(titleB) && titleB.length > 5) return true;
      if (titleB.length > titleA.length && titleB.includes(titleA) && titleA.length > 5) return true;

      // Word overlap check for longer titles (Jaccard similarity)
      if (titleA.length > 10 && titleB.length > 10) {
        const wordsA = new Set(titleA.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
        const wordsB = new Set(titleB.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
        if (wordsA.size > 0 && wordsB.size > 0) {
          const intersection = [...wordsA].filter(w => wordsB.has(w));
          const smaller = Math.min(wordsA.size, wordsB.size);
          if (intersection.length / smaller >= 0.6) return true;
        }
      }

      // Check if one title appears in the other's combined title+artist
      const combinedA = titleA + artistA;
      const combinedB = titleB + artistB;
      if (titleA.length > 8 && combinedB.includes(titleA)) return true;
      if (titleB.length > 8 && combinedA.includes(titleB)) return true;

      return false;
    };

    // Helper: check if title has metadata noise
    const hasMetadataNoise = (title: string | undefined): boolean => {
      if (!title) return false;
      return /\[.*\d{4}.*\]|\(.*\d{4}.*\)|release|unreleased|out soon|coming soon/i.test(title);
    };

    // Helper: pick the "best" track from duplicates (prefer verified, database source, clean titles)
    const pickBestTrack = (tracks: Track[]): Track => {
      return tracks.reduce((best, current) => {
        if (current.verified && !best.verified) return current;
        if (best.verified && !current.verified) return best;
        if (current.source === 'database' || current.source === '1001tracklists') return current;
        if (best.source === 'database' || best.source === '1001tracklists') return best;
        const currentHasNoise = hasMetadataNoise(current.title);
        const bestHasNoise = hasMetadataNoise(best.title);
        if (!currentHasNoise && bestHasNoise) return current;
        if (currentHasNoise && !bestHasNoise) return best;
        const currentArtistClean = !hasMetadataNoise(current.artist) && current.artist?.toLowerCase() !== 'unknown';
        const bestArtistClean = !hasMetadataNoise(best.artist) && best.artist?.toLowerCase() !== 'unknown';
        if (currentArtistClean && !bestArtistClean) return current;
        if (bestArtistClean && !currentArtistClean) return best;
        if ((current.title?.length || 0) > (best.title?.length || 0)) return current;
        return best;
      });
    };

    // Score a track's quality (higher = more trustworthy)
    const trackQualityScore = (t: Track): number => {
      let score = 0;
      const title = (t.title || '').toLowerCase();
      const artist = (t.artist || '').toLowerCase();
      if (artist && artist !== 'unknown' && artist !== 'unknown artist' && artist !== 'id') score += 3;
      if (title && title !== 'unknown' && title !== 'unknown track' && title !== 'id') score += 3;
      if (t.source === 'database' || t.source === '1001tracklists') score += 4;
      if (t.source === 'youtube' || t.source === 'soundcloud') score += 1;
      if (t.verified) score += 3;
      if (t.confidence && t.confidence > 0.7) score += 2;
      if (t.confidence && t.confidence > 0.5) score += 1;
      if (!hasMetadataNoise(t.title)) score += 1;
      return score;
    };

    // Filter out tracks that have active conflicts, invalid timestamps, or are pure ID placeholders
    const filteredTracks = sortedTracks.filter(track => {
      if (isLowQualityTrack(track)) return false;
      if (track.hasConflict && track.conflictId) {
        if (conflicts.some(c => c.id === track.conflictId)) return false;
      }
      const timestamp = track.timestamp || 0;
      if (timestamp > maxValidTimestamp) return false;
      return true;
    });

    // GLOBAL DEDUP: Same track appearing at different timestamps across the whole set
    // e.g., "Won't Stop" at 20:00 and "Won't Stop" at 55:00 — keep the best one
    const tracksWithoutConflicts: Track[] = [];
    for (const track of filteredTracks) {
      const existingIdx = tracksWithoutConflicts.findIndex(existing => isSameTrack(existing, track));
      if (existingIdx !== -1) {
        // Same track found at a different timestamp — keep the better version
        const existing = tracksWithoutConflicts[existingIdx];
        const better = pickBestTrack([existing, track]);
        tracksWithoutConflicts[existingIdx] = better;
      } else {
        tracksWithoutConflicts.push(track);
      }
    }

    const items: TracklistItem[] = [];
    const avgTrackDuration = 210; // ~3.5 min average track length in DJ sets
    const minTrackGap = 75; // Tracks < 1.25 min apart are suspicious (likely same track or conflict)
    const gapThreshold = 270; // 4.5+ min gap suggests missing track(s)
    let missingCount = 0;
    let gapCounter = 0;

    // Check for gap at the START of the set (before first track)
    if (tracksWithoutConflicts.length > 0) {
      const firstTrackTimestamp = tracksWithoutConflicts[0].timestamp || 0;
      // If first track starts after gapThreshold (4.5 min), there's likely missing tracks at the start
      if (firstTrackTimestamp >= gapThreshold) {
        const estimatedMissing = Math.max(1, Math.round(firstTrackTimestamp / avgTrackDuration));
        missingCount += estimatedMissing;
        gapCounter++;
        items.push({
          type: 'gap' as const,
          timestamp: 0,
          duration: firstTrackTimestamp,
          gapId: `gap-${gapCounter}`,
        });
      }
    }

    // Group tracks that are too close together (timestamp conflicts)
    let i = 0;
    while (i < tracksWithoutConflicts.length) {
      const track = tracksWithoutConflicts[i];
      const trackTimestamp = track.timestamp || 0;

      // Look ahead to find all tracks within minTrackGap of this one
      const closeGroup: Track[] = [track];
      let j = i + 1;
      while (j < tracksWithoutConflicts.length) {
        const nextTrack = tracksWithoutConflicts[j];
        const nextTimestamp = nextTrack.timestamp || 0;
        // Check if this track is within minTrackGap of ANY track in the group
        const isClose = closeGroup.some(t =>
          Math.abs(nextTimestamp - (t.timestamp || 0)) < minTrackGap
        );
        if (isClose) {
          closeGroup.push(nextTrack);
          j++;
        } else {
          break;
        }
      }

      // Check for gap before this track/group (only if within valid duration)
      if (items.length > 0 && trackTimestamp <= maxValidTimestamp) {
        const lastItem = items[items.length - 1];
        let lastTimestamp = 0;
        if (lastItem.type === 'track') {
          lastTimestamp = lastItem.data.timestamp || 0;
        } else if (lastItem.type === 'timestamp-conflict') {
          // Use the latest timestamp from the conflict group
          lastTimestamp = Math.max(...lastItem.tracks.map(t => t.timestamp || 0));
        } else if (lastItem.type === 'gap') {
          lastTimestamp = lastItem.timestamp + lastItem.duration;
        }

        const gap = trackTimestamp - lastTimestamp;
        // Only add gap if it's within valid duration bounds
        if (gap >= gapThreshold && (lastTimestamp + avgTrackDuration) <= maxValidTimestamp) {
          const estimatedMissing = Math.max(1, Math.round((gap - avgTrackDuration) / avgTrackDuration));
          missingCount += estimatedMissing;
          gapCounter++;
          items.push({
            type: 'gap' as const,
            timestamp: lastTimestamp + avgTrackDuration,
            duration: gap - avgTrackDuration,
            gapId: `gap-${gapCounter}`,
          });
        }
      }

      // If multiple tracks are grouped together, check if they're actually different
      if (closeGroup.length > 1) {
        // Group truly unique tracks (not same song with different metadata)
        const uniqueGroups: Track[][] = [];
        for (const t of closeGroup) {
          const existingGroup = uniqueGroups.find(group =>
            group.some(existing => isSameTrack(existing, t))
          );
          if (existingGroup) {
            existingGroup.push(t);
          } else {
            uniqueGroups.push([t]);
          }
        }

        // Pick best track from each group of duplicates
        let uniqueTracks = uniqueGroups.map(group => pickBestTrack(group));

        // Filter out low-quality tracks (ID placeholders, garbage, reactions) from conflict options
        const realTracks = uniqueTracks.filter(t => !isLowQualityTrack(t));
        if (realTracks.length > 0) {
          uniqueTracks = realTracks;
        }

        if (uniqueTracks.length > 1) {
          // Score each track — if there's a clear winner, don't show conflict
          const scored = uniqueTracks
            .map(t => ({ track: t, score: trackQualityScore(t) }))
            .sort((a, b) => b.score - a.score);

          const topScore = scored[0].score;
          const runnerUpScore = scored[1].score;

          // If top track is significantly better (3+ point gap), just show it
          if (topScore - runnerUpScore >= 3) {
            items.push({ type: 'track' as const, data: scored[0].track });
          } else {
            // Genuine conflict — filter out any low-quality entries before showing
            const worthyTracks = scored.filter(s => s.score >= 3).map(s => s.track);
            if (worthyTracks.length > 1) {
              items.push({
                type: 'timestamp-conflict' as const,
                tracks: worthyTracks,
                timestamp: Math.min(...worthyTracks.map(t => t.timestamp || 0)),
              });
            } else {
              items.push({ type: 'track' as const, data: scored[0].track });
            }
          }
        } else {
          // Same track identified multiple times OR only one real track - just show the best one
          items.push({
            type: 'track' as const,
            data: uniqueTracks[0],
          });
        }
      } else {
        items.push({
          type: 'track' as const,
          data: track,
        });
      }

      i = j; // Skip past all grouped tracks
    }

    // Add existing conflicts
    const conflictItems: TracklistItem[] = conflicts.map(conflict => ({
      type: 'conflict' as const,
      data: conflict,
    }));

    // Combine and sort by timestamp
    const combined = [...items, ...conflictItems];
    combined.sort((a, b) => {
      const getTimestamp = (item: TracklistItem) => {
        if (item.type === 'track') return item.data.timestamp || 0;
        if (item.type === 'gap') return item.timestamp;
        if (item.type === 'timestamp-conflict') return item.timestamp;
        return item.data.timestamp;
      };
      return getTimestamp(a) - getTimestamp(b);
    });

    return { tracklistItems: combined, estimatedMissingTracks: missingCount };
  }, [sortedTracks, conflicts, isLowQualityTrack]);

  const handleSave = useCallback(async () => {
    if (!setList) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (isSaved) {
        await removeSetFromLibrary(setList.id);
        setIsSaved(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await saveSetToLibrary(setList);
        setIsSaved(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      if (__DEV__) console.error('Error saving/removing set:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [setList, isSaved]);

  useEffect(() => {
    const checkSavedStatus = async () => {
      if (id) {
        try {
          const saved = await isSetSaved(id);
          setIsSaved(saved);
        } catch (error) {
          if (__DEV__) console.error('Error checking saved status:', error);
        } finally {
          setLoadingSaved(false);
        }
      }
    };
    checkSavedStatus();
  }, [id]);

  // Show loading / error / not found state
  if (isLoadingSet || !setList) {
    return (
      <View style={styles.loadingContainer}>
        <TrackdLogo size="large" />
        {!isLoadingSet && loadError && (
          <View style={{ alignItems: 'center', marginTop: 16, paddingHorizontal: 32 }}>
            <Text style={styles.loadingText}>{loadError}</Text>
            <Pressable
              style={{ marginTop: 12, backgroundColor: Colors.dark.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
              onPress={() => {
                setLoadError(null);
                setIsLoadingSet(true);
                fetch(`${API_BASE_URL}/api/sets/${id}`)
                  .then(r => r.json())
                  .then(data => {
                    if (data.success && data.set) {
                      const transformedSet: SetList = {
                        id: data.set.id, name: data.set.name, artist: data.set.artist,
                        venue: data.set.venue, date: new Date(data.set.date),
                        totalDuration: data.set.totalDuration || 0, coverUrl: data.set.coverUrl || undefined,
                        plays: data.set.trackCount * 10, sourceLinks: data.set.sourceLinks || [],
                        tracks: data.set.tracks?.map((t: any) => ({
                          id: t.id, title: t.title, artist: t.artist, duration: 0, coverUrl: t.coverUrl || '',
                          addedAt: new Date(t.addedAt || Date.now()), source: t.source || 'database',
                          timestamp: t.timestamp || 0, timestampStr: t.timestampStr,
                          verified: t.verified || !t.isId, confidence: t.isId ? 0 : 1, isId: t.isId,
                          isReleased: t.isReleased || false, previewUrl: t.previewUrl || undefined,
                          trackLinks: t.trackLinks || [], album: t.album || undefined,
                        })) || [],
                        hasGaps: data.set.hasGaps, gapCount: data.set.gapCount,
                      };
                      setDbSet(transformedSet);
                    }
                  })
                  .catch(() => setLoadError('Failed to load set. Check your connection and try again.'))
                  .finally(() => setIsLoadingSet(false));
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Retry</Text>
            </Pressable>
          </View>
        )}
        {!isLoadingSet && !loadError && !setList && (
          <Text style={styles.loadingText}>Set not found</Text>
        )}
      </View>
    );
  }

  const verifiedCount = sortedTracks.filter(t => t.verified).length;
  const communityCount = sortedTracks.filter(t => t.source === 'social' || t.source === 'manual').length;

  // Parse multiple artists from name (handles &, and, vs, b2b, b3b patterns)
  const parseArtists = (artistString: string): string[] => {
    const separatorPattern = /\s*(?:&|,|\s+and\s+|\s+vs\.?\s+|\s+[bB]2[bB]\s+|\s+[bB]3[bB]\s+)\s*/;
    return artistString.split(separatorPattern).map(a => a.trim()).filter(a => a.length > 0);
  };

  // Extract artists - check if set name contains more artists than the artist field
  const getArtists = (): string[] => {
    if (!setList) return [];
    // First check if the set name starts with multiple artists before " - " or " @ "
    const nameMatch = setList.name.match(/^(.+?)\s*[-–@]\s*/);
    if (nameMatch) {
      const potentialArtists = parseArtists(nameMatch[1]);
      // If set name has more artists than the artist field, use those
      if (potentialArtists.length > 1) {
        return potentialArtists;
      }
    }
    // Otherwise parse the artist field
    return parseArtists(setList.artist);
  };

  const artists = getArtists();

  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins} min`;
  };

  const formatPlays = (plays: number) => {
    if (plays >= 1000000) return `${(plays / 1000000).toFixed(1)}M`;
    if (plays >= 1000) return `${(plays / 1000).toFixed(0)}K`;
    return plays.toString();
  };

  const handleOpenSource = (link: SourceLink) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(link.url);
  };

  const handleAddTrack = (trackData: Partial<Track>) => {
    if (!setList) return;
    
    const newTrack: Track = {
      id: trackData.id || Date.now().toString(),
      title: trackData.title || '',
      artist: trackData.artist || '',
      album: trackData.album,
      duration: trackData.duration || 0,
      bpm: trackData.bpm,
      key: trackData.key,
      coverUrl: trackData.coverUrl || undefined,
      addedAt: new Date(),
      source: 'manual',
      timestamp: trackData.timestamp,
      contributedBy: 'You',
      verified: false,
    };
    
    // Add track to set via context (persists to storage)
    addTracksToSet(setList.id, [newTrack]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Handle selecting a track from FillGapModal
  const handleFillGapSelectTrack = (track: Track, timestamp: number) => {
    if (!setList) return;

    // Update the track's timestamp to place it in the gap
    const updatedTrack: Track = {
      ...track,
      timestamp,
      addedAt: new Date(),
    };

    // Add track to set via context
    addTracksToSet(setList.id, [updatedTrack]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Handle placing a picked track into a gap
  const handlePlaceTrack = (timestamp: number) => {
    if (!pickedTrack || !setList) return;
    const placedTrack: Track = {
      ...pickedTrack,
      id: `placed-${Date.now()}`,
      timestamp,
      source: 'manual',
      contributedBy: 'You',
    };
    addTracksToSet(setList.id, [placedTrack]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPickedTrack(null);
  };

  // Format timestamp helper
  const formatTimestamp = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  // Handle identification submission from audio preview modal
  const handleIdentifyTrack = async (artist: string, title: string) => {
    if (!audioPreviewTrack || !setList) return;

    try {
      // Update the track in the database
      const response = await fetch(`${API_BASE_URL}/api/sets/identify-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId: setList.id,
          trackId: audioPreviewTrack.id,
          artist,
          title,
          contributedBy: 'Community', // Could use actual username
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh set data to show updated track
        const refreshResponse = await fetch(`${API_BASE_URL}/api/sets/${setList.id}`);
        const refreshData = await refreshResponse.json();

        if (refreshData.success && refreshData.set) {
          const refreshedSet: SetList = {
            id: refreshData.set.id,
            name: refreshData.set.name,
            artist: refreshData.set.artist,
            venue: refreshData.set.venue,
            date: new Date(refreshData.set.date),
            totalDuration: refreshData.set.totalDuration || 0,
            coverUrl: refreshData.set.coverUrl,
            plays: refreshData.set.trackCount * 10,
            sourceLinks: refreshData.set.sourceLinks || [],
            tracks: refreshData.set.tracks?.map((t: any) => ({
              id: t.id,
              title: t.title,
              artist: t.artist,
              duration: 0,
              coverUrl: t.coverUrl || '',
              addedAt: new Date(t.addedAt || Date.now()),
              source: t.source || 'database',
              timestamp: t.timestamp || 0,
              verified: t.verified || !t.isId,
              isId: t.isId,
              isReleased: t.isReleased || false,
              previewUrl: t.previewUrl || undefined,
              trackLinks: t.trackLinks || [],
            })) || [],
          };
          setDbSet(refreshedSet);
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await addPoints('track_confirmed', setList.id);
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to identify track:', error);
    }
  };

  // Handle ACRCloud identification result from IdentifyTrackModal
  const handleACRCloudIdentified = async (
    track: { title: string; artist: string; album?: string; label?: string; confidence: number },
    timestamp: number
  ) => {
    if (!setList) return;

    // Create a new track object from the ACRCloud result
    const newTrack: Track = {
      id: `acrcloud-${Date.now()}`,
      title: track.title,
      artist: track.artist,
      duration: 0,
      coverUrl: '',
      addedAt: new Date(),
      source: 'database',
      timestamp,
      verified: true,
      confidence: track.confidence / 100, // Convert percentage to 0-1
      isId: false,
    };

    // Add track to set via context
    addTracksToSet(setList.id, [newTrack]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Award points for using ACRCloud to identify a track
    await addPoints('track_confirmed', setList.id);
  };

  // Get the source URL and platform for audio preview
  const getAudioSource = (): { url: string; platform: 'youtube' | 'soundcloud' } | null => {
    if (!setList?.sourceLinks?.length) return null;

    // Prefer YouTube, then SoundCloud
    const ytLink = (setList.sourceLinks || []).find(l => l.platform === 'youtube');
    if (ytLink) return { url: ytLink.url, platform: 'youtube' };

    const scLink = (setList.sourceLinks || []).find(l => l.platform === 'soundcloud');
    if (scLink) return { url: scLink.url, platform: 'soundcloud' };

    return null;
  };

  const audioSource = getAudioSource();

  const getPlatformIcon = (platform: string, size: number = 18) => {
    switch (platform) {
      case 'youtube':
        return <Youtube size={size} color="#FF0000" />;
      case 'soundcloud':
        return <Music2 size={size} color="#FF5500" />;
      default:
        return <ExternalLink size={size} color={Colors.dark.textSecondary} />;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'youtube': return 'YouTube';
      case 'soundcloud': return 'SoundCloud';
      case '1001tracklists': return 'Tracklist';
      default: return 'Link';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerImage}>
          <Image
            key={setList.coverUrl || 'default-cover'}
            source={{ uri: setList.coverUrl || undefined }}
            style={styles.coverImage}
            cachePolicy="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)', Colors.dark.background]}
            style={styles.headerGradient}
          />
          <Pressable
            style={styles.backButton}
            onPress={() => {
              // Try router.back() first, fallback to discover tab if no history
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/(discover)');
              }
            }}
          >
            <ArrowLeft size={24} color={Colors.dark.text} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <View style={styles.titleInfo}>
                <View style={styles.artistsRow}>
                  {artists.map((artist, index) => (
                    <View key={index} style={styles.artistItem}>
                      <ArtistLink
                        name={artist}
                        style={styles.artist}
                        size="large"
                        showBadge={true}
                      />
                      {index < artists.length - 1 && (
                        <Text style={styles.artistSeparator}>|</Text>
                      )}
                    </View>
                  ))}
                </View>
                <Text style={styles.title}>{setList.name}</Text>
              </View>
              <Pressable style={styles.saveButton} onPress={handleSave}>
                {isSaved ? (
                  <BookmarkCheck size={24} color={Colors.dark.primary} fill={Colors.dark.primary} />
                ) : (
                  <Bookmark size={24} color={Colors.dark.text} />
                )}
              </Pressable>
            </View>
            
            <View style={styles.quickStats}>
              {setList.venue && (
                <>
                  <Text style={styles.quickStatText}>{setList.venue}</Text>
                  <Text style={styles.quickStatDot}>•</Text>
                </>
              )}
              {setList.date && (
                <>
                  <Text style={styles.quickStatText}>
                    {new Date(setList.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Text style={styles.quickStatDot}>•</Text>
                </>
              )}
              {(setList.totalDuration || 0) > 0 ? (
                <>
                  <Text style={styles.quickStatText}>{formatTotalDuration(setList.totalDuration || 0)}</Text>
                  <Text style={styles.quickStatDot}>•</Text>
                </>
              ) : null}
              <Text style={styles.quickStatText}>{sortedTracks.length} tracks</Text>
            </View>
            
            {/* IDentified Matching Progress Banner */}
            {setList.isMatchingInProgress && (
              <View style={styles.matchingBanner}>
                <ActivityIndicator size="small" color={Colors.dark.primary} />
                <View style={styles.matchingBannerContent}>
                  <Text style={styles.matchingBannerTitle}>Identifying tracks...</Text>
                  <Text style={styles.matchingBannerSubtext}>
                    Matching tracks to database
                  </Text>
                </View>
                <Sparkles size={18} color={Colors.dark.primary} />
              </View>
            )}
            
            {/* Matching Complete Banner */}
            {!setList.isMatchingInProgress && setList.matchingStats && (
              <View style={styles.matchingCompleteBanner}>
                <CheckCircle size={16} color={Colors.dark.success} />
                <Text style={styles.matchingCompleteText}>
                  {setList.matchingStats.matched} matched
                  {setList.matchingStats.unreleased > 0 && (
                    <Text style={styles.matchingUnreleasedText}>
                      {' '}• {setList.matchingStats.unreleased} unreleased
                    </Text>
                  )}
                </Text>
              </View>
            )}
          </View>

          {/* Needs Source Banner - show when no YouTube/SoundCloud for analysis */}
          {(() => {
            const ytLink = (setList.sourceLinks || []).find(l => l.platform === 'youtube');
            const scLink = (setList.sourceLinks || []).find(l => l.platform === 'soundcloud');
            const hasAnalyzableSource = ytLink || scLink;

            // Check if analysis has been run by looking for tracks with timestamps > 0
            const hasTimestamps = setList.tracks?.some(t => t.timestamp && t.timestamp > 0);

            // Needs analysis if we have a source but no timestamps yet
            const anyNeedsAnalysis = hasAnalyzableSource && !hasTimestamps;

            if (!hasAnalyzableSource) {
              return (
                <View style={styles.needsSourceBanner}>
                  <View style={styles.needsSourceIconContainer}>
                    <AlertCircle size={20} color={Colors.dark.primary} />
                  </View>
                  <View style={styles.needsSourceContent}>
                    <Text style={styles.needsSourceTitle}>Source Needed for Analysis</Text>
                    <Text style={styles.needsSourceText}>
                      Add a YouTube or SoundCloud link to enable trakd identification
                    </Text>
                  </View>
                </View>
              );
            }

            // Show "Needs Analysis" banner if sources exist but haven't been analyzed
            if (anyNeedsAnalysis) {
              return (
                <View style={[styles.needsSourceBanner, { backgroundColor: 'rgba(251, 146, 60, 0.1)', borderColor: 'rgba(251, 146, 60, 0.3)' }]}>
                  <View style={[styles.needsSourceIconContainer, { backgroundColor: 'rgba(251, 146, 60, 0.2)' }]}>
                    <Sparkles size={20} color="#FB923C" />
                  </View>
                  <View style={styles.needsSourceContent}>
                    <Text style={styles.needsSourceTitle}>Ready for Analysis</Text>
                    <Text style={styles.needsSourceText}>
                      Source links detected. Tap "Analyze" to run trakd identification.
                    </Text>
                  </View>
                </View>
              );
            }
            return null;
          })()}

          <View style={styles.linksSection}>
            <Text style={styles.sectionLabel}>Sources</Text>
            <View style={styles.linksGrid}>
              {/* YouTube */}
              {(() => {
                const ytLink = (setList.sourceLinks || []).find(l => l.platform === 'youtube');
                // Check if analysis has been run by looking for tracks with timestamps > 0
                const hasTimestamps = setList.tracks?.some(t => t.timestamp && t.timestamp > 0);
                const needsAnalysis = ytLink && !hasTimestamps;

                // Debug logging
                if (__DEV__) console.log('[YT Analysis Check] ytLink:', !!ytLink, 'hasTimestamps:', hasTimestamps, 'needsAnalysis:', needsAnalysis);

                return ytLink ? (
                  <View style={styles.linkCardWrapper}>
                    <Pressable
                      style={[styles.linkCard, styles.linkCardFilled]}
                      onPress={() => handleOpenSource(ytLink)}
                    >
                      <View style={[styles.linkIconContainer, { backgroundColor: 'rgba(255, 0, 0, 0.1)' }]}>
                        <Youtube size={16} color="#FF0000" />
                      </View>
                      <Text style={styles.linkPlatform}>YouTube</Text>
                      <ExternalLink size={12} color={Colors.dark.textMuted} style={styles.linkExternal} />
                    </Pressable>
                    {needsAnalysis ? (
                      <Pressable
                        style={styles.analyzeButton}
                        onPress={async () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setSelectedPlatform('youtube');
                          // Trigger analysis directly without showing modal
                          try {
                            setAnalyzing(true);
                            const importResponse = await fetch(`${API_BASE_URL}/api/import`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ url: ytLink.url }),
                            });
                            const importResult = await importResponse.json();

                            if (importResult.success && importResult.setList?.tracks?.length > 0) {
                              // Update tracks with timestamps and coverUrl
                              await fetch(`${API_BASE_URL}/api/sets/update-tracks`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  setId: setList.id,
                                  tracks: importResult.setList.tracks,
                                  source: 'youtube',
                                  coverUrl: importResult.setList.coverUrl,
                                }),
                              });

                              // Immediately update coverUrl for quick visual feedback
                              if (importResult.setList?.coverUrl) {
                                setDbSet(prev => prev ? { ...prev, coverUrl: importResult.setList.coverUrl } : prev);
                              }

                              // Refresh set data
                              const refreshResponse = await fetch(`${API_BASE_URL}/api/sets/${setList.id}`);
                              const refreshData = await refreshResponse.json();
                              if (refreshData.success && refreshData.set) {
                                const refreshedSet: SetList = {
                                  id: refreshData.set.id,
                                  name: refreshData.set.name,
                                  artist: refreshData.set.artist,
                                  venue: refreshData.set.venue,
                                  date: new Date(refreshData.set.date),
                                  totalDuration: refreshData.set.totalDuration || 0,
                                  coverUrl: refreshData.set.coverUrl || importResult.setList?.coverUrl || undefined,
                                  plays: refreshData.set.trackCount * 10,
                                  sourceLinks: refreshData.set.sourceLinks || [],
                                  tracks: refreshData.set.tracks?.map((t: any) => ({
                                    id: t.id,
                                    title: t.title,
                                    artist: t.artist,
                                    duration: 0,
                                    coverUrl: t.coverUrl || '',
                                    addedAt: new Date(t.addedAt || Date.now()),
                                    source: t.source || 'database',
                                    timestamp: t.timestamp || 0,
                                    timestampStr: t.timestampStr,
                                    verified: t.verified || !t.isId,
                                    confidence: t.isId ? 0 : 1,
                                    isId: t.isId,
                                    isReleased: t.isReleased || false,
                                    previewUrl: t.previewUrl || undefined,
                                    trackLinks: t.trackLinks || [],
                                  })) || [],
                                  hasGaps: refreshData.set.hasGaps,
                                  gapCount: refreshData.set.gapCount,
                                };
                                setDbSet(refreshedSet);
                              }

                              Alert.alert('Success', `trakd ${importResult.setList.tracks.length} tracks from this source`);
                            } else {
                              Alert.alert('No Results', 'No tracks could be identified from this source');
                            }
                          } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to analyze');
                          } finally {
                            setAnalyzing(false);
                          }
                        }}
                      >
                        <Sparkles size={12} color="#FFF" />
                        <Text style={styles.analyzeButtonText}>Analyze</Text>
                      </Pressable>
                    ) : hasTimestamps ? (
                      <View style={styles.identifiedBadge}>
                        <Text style={styles.identifiedBadgeId}>trakd</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Pressable
                    style={[styles.linkCard, styles.linkCardEmpty]}
                    onPress={() => {
                      setSelectedPlatform('youtube');
                      setShowSourceModal(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <View style={[styles.linkIconContainer, styles.linkIconEmpty]}>
                      <Youtube size={16} color={Colors.dark.textMuted} />
                    </View>
                    <Text style={styles.linkPlatformEmpty}>Add YouTube</Text>
                    <Plus size={14} color={Colors.dark.primary} style={styles.linkExternal} />
                  </Pressable>
                );
              })()}

              {/* SoundCloud */}
              {(() => {
                const scLink = (setList.sourceLinks || []).find(l => l.platform === 'soundcloud');
                // Check if analysis has been run by looking for tracks with timestamps > 0
                const hasTimestamps = setList.tracks?.some(t => t.timestamp && t.timestamp > 0);
                const needsAnalysis = scLink && !hasTimestamps;

                return scLink ? (
                  <View style={styles.linkCardWrapper}>
                    <Pressable
                      style={[styles.linkCard, styles.linkCardFilled]}
                      onPress={() => handleOpenSource(scLink)}
                    >
                      <View style={[styles.linkIconContainer, { backgroundColor: 'rgba(255, 85, 0, 0.1)' }]}>
                        <Music2 size={16} color="#FF5500" />
                      </View>
                      <Text style={styles.linkPlatform}>SoundCloud</Text>
                      <ExternalLink size={12} color={Colors.dark.textMuted} style={styles.linkExternal} />
                    </Pressable>
                    {needsAnalysis ? (
                      <Pressable
                        style={[styles.analyzeButton, { backgroundColor: '#FF5500' }]}
                        onPress={async () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setSelectedPlatform('soundcloud');
                          try {
                            setAnalyzing(true);
                            const importResponse = await fetch(`${API_BASE_URL}/api/import`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ url: scLink.url }),
                            });
                            const importResult = await importResponse.json();

                            if (importResult.success && importResult.setList?.tracks?.length > 0) {
                              await fetch(`${API_BASE_URL}/api/sets/update-tracks`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  setId: setList.id,
                                  tracks: importResult.setList.tracks,
                                  source: 'soundcloud',
                                  coverUrl: importResult.setList.coverUrl,
                                }),
                              });

                              // Immediately update coverUrl for quick visual feedback
                              if (importResult.setList?.coverUrl) {
                                setDbSet(prev => prev ? { ...prev, coverUrl: importResult.setList.coverUrl } : prev);
                              }

                              // Refresh set data
                              const refreshResponse = await fetch(`${API_BASE_URL}/api/sets/${setList.id}`);
                              const refreshData = await refreshResponse.json();
                              if (refreshData.success && refreshData.set) {
                                const refreshedSet: SetList = {
                                  id: refreshData.set.id,
                                  name: refreshData.set.name,
                                  artist: refreshData.set.artist,
                                  venue: refreshData.set.venue,
                                  date: new Date(refreshData.set.date),
                                  totalDuration: refreshData.set.totalDuration || 0,
                                  coverUrl: refreshData.set.coverUrl || importResult.setList?.coverUrl || undefined,
                                  plays: refreshData.set.trackCount * 10,
                                  sourceLinks: refreshData.set.sourceLinks || [],
                                  tracks: refreshData.set.tracks?.map((t: any) => ({
                                    id: t.id,
                                    title: t.title,
                                    artist: t.artist,
                                    duration: 0,
                                    coverUrl: t.coverUrl || '',
                                    addedAt: new Date(t.addedAt || Date.now()),
                                    source: t.source || 'database',
                                    timestamp: t.timestamp || 0,
                                    timestampStr: t.timestampStr,
                                    verified: t.verified || !t.isId,
                                    confidence: t.isId ? 0 : 1,
                                    isId: t.isId,
                                    isReleased: t.isReleased || false,
                                    previewUrl: t.previewUrl || undefined,
                                    trackLinks: t.trackLinks || [],
                                  })) || [],
                                  hasGaps: refreshData.set.hasGaps,
                                  gapCount: refreshData.set.gapCount,
                                };
                                setDbSet(refreshedSet);
                              }

                              Alert.alert('Success', `trakd ${importResult.setList.tracks.length} tracks from this source`);
                            } else {
                              Alert.alert('No Results', 'No tracks could be identified from this source');
                            }
                          } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to analyze');
                          } finally {
                            setAnalyzing(false);
                          }
                        }}
                      >
                        <Sparkles size={12} color="#FFF" />
                        <Text style={styles.analyzeButtonText}>Analyze</Text>
                      </Pressable>
                    ) : hasTimestamps ? (
                      <View style={styles.identifiedBadge}>
                        <Text style={styles.identifiedBadgeId}>trakd</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Pressable
                    style={[styles.linkCard, styles.linkCardEmpty]}
                    onPress={() => {
                      setSelectedPlatform('soundcloud');
                      setShowSourceModal(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <View style={[styles.linkIconContainer, styles.linkIconEmpty]}>
                      <Music2 size={16} color={Colors.dark.textMuted} />
                    </View>
                    <Text style={styles.linkPlatformEmpty}>Add SoundCloud</Text>
                    <Plus size={14} color={Colors.dark.primary} style={styles.linkExternal} />
                  </Pressable>
                );
              })()}
            </View>
          </View>

          <View style={styles.statsSection}>
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(0, 212, 170, 0.15)' }]}>
                <Sparkles size={14} color={Colors.dark.primary} />
              </View>
              <Text style={styles.statValue}>{setList.tracksIdentified || sortedTracks.length}</Text>
              <Text style={styles.statLabel}>trakd</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                <CheckCircle size={14} color={Colors.dark.success} />
              </View>
              <Text style={styles.statValue}>{verifiedCount}</Text>
              <Text style={styles.statLabel}>Verified</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <Users size={14} color="#8B5CF6" />
              </View>
              <Text style={styles.statValue}>{communityCount}</Text>
              <Text style={styles.statLabel}>Comm.</Text>
            </View>

            {/* Released / ID Status Card */}
            {(() => {
              const releasedTracks = tracks.filter(t =>
                t.verified && !t.isId && t.title?.toLowerCase() !== 'id'
              );
              const unreleasedTracks = tracks.filter(t =>
                t.isId || t.title?.toLowerCase() === 'id' || !t.verified
              );
              const releasedCount = releasedTracks.length;
              const unreleasedCount = unreleasedTracks.length;

              return (
                <View style={styles.statCardWide}>
                  <View style={styles.releaseStatusRow}>
                    <View style={styles.releaseStatusItem}>
                      <CheckCircle size={10} color="#22C55E" />
                      <Text style={styles.releaseStatusValue}>{releasedCount}</Text>
                      <Text style={styles.releaseStatusLabel}>Rel</Text>
                    </View>
                    <View style={styles.releaseStatusDivider} />
                    <View style={styles.releaseStatusItem}>
                      <Sparkles size={10} color={Colors.dark.primary} />
                      <Text style={styles.releaseStatusValue}>{unreleasedCount}</Text>
                      <Text style={styles.releaseStatusLabel}>ID</Text>
                    </View>
                  </View>
                  <View style={styles.releaseStatusBarContainer}>
                    <View
                      style={[
                        styles.releaseStatusBar,
                        styles.releaseStatusBarReleased,
                        { flex: releasedCount || 0.1 }
                      ]}
                    />
                    <View
                      style={[
                        styles.releaseStatusBar,
                        styles.releaseStatusBarUnreleased,
                        { flex: unreleasedCount || 0.1 }
                      ]}
                    />
                  </View>
                </View>
              );
            })()}
          </View>

          {/* Estimated Missing Tracks Banner */}
          {estimatedMissingTracks > 0 && (
            <View style={styles.missingTracksBanner}>
              <View style={styles.missingTracksIcon}>
                <AlertCircle size={14} color="#FB923C" />
              </View>
              <Text style={styles.missingTracksText}>
                ~{estimatedMissingTracks} track{estimatedMissingTracks !== 1 ? 's' : ''} estimated missing
              </Text>
              {unplacedTracks.length > 0 && (
                <Text style={styles.missingTracksHint}>
                  Drag from unplaced to fill
                </Text>
              )}
            </View>
          )}

          {setList.aiProcessed && (setList.commentsScraped || 0) > 0 && (
            <View style={styles.aiInfoBanner}>
              <Sparkles size={14} color={Colors.dark.primary} />
              <Text style={styles.aiInfoText}>
                trakd • {setList.commentsScraped?.toLocaleString()} data points analyzed
              </Text>
            </View>
          )}

          {/* Embedded YouTube Player */}
          {(() => {
            const ytLink = (setList.sourceLinks || []).find(l => l.platform === 'youtube');
            const videoId = ytLink ? extractYouTubeId(ytLink.url) : null;
            
            if (!showPlayer || !videoId) {
              // Show "Play In App" button when player is hidden
              if (ytLink && videoId) {
                return (
                  <Pressable
                    style={styles.playInAppButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowPlayer(true);
                      setPlayerMinimized(false);
                    }}
                  >
                    <View style={styles.playInAppIcon}>
                      <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
                    </View>
                    <View style={styles.playInAppInfo}>
                      <Text style={styles.playInAppTitle}>Play Set</Text>
                      <Text style={styles.playInAppSubtitle}>Listen while browsing tracklist</Text>
                    </View>
                    <Youtube size={20} color="#FF0000" />
                  </Pressable>
                );
              }
              return null;
            }
            
            return (
              <YouTubePlayer
                videoId={videoId}
                initialTimestamp={currentTimestamp}
                onTimestampChange={setCurrentTimestamp}
                onClose={() => setShowPlayer(false)}
                minimized={playerMinimized}
                onToggleMinimize={() => setPlayerMinimized(!playerMinimized)}
              />
            );
          })()}

          {/* Waveform Timeline */}
          {(setList.totalDuration || 0) > 0 && tracks.length > 0 && (
            <WaveformTimeline
              tracks={tracks}
              totalDuration={setList.totalDuration || 0}
              onGapPress={(timestamp) => {
                setIdentifyTimestamp(timestamp);
                setShowIdentifyModal(true);
              }}
            />
          )}

          {/* Inline conflict indicator */}
          {conflicts.length > 0 && (
            <View style={styles.conflictHintBanner}>
              <Text style={styles.conflictHintText}>
                {conflicts.length} track{conflicts.length !== 1 ? 's need' : ' needs'} identification - swipe right to select
              </Text>
            </View>
          )}

          <View style={styles.tracksSection}>
            <View style={styles.tracksSectionHeader}>
              <Text style={styles.sectionTitle}>Tracklist</Text>
              <Pressable
                style={styles.addTrackButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowAddModal(true);
                }}
              >
                <Plus size={16} color={Colors.dark.primary} />
                <Text style={styles.addTrackText}>Add Track</Text>
              </Pressable>
            </View>

            {tracklistItems.map((item, index) => {
              if (item.type === 'conflict') {
                const conflict = item.data;
                const youtubeLink = (setList.sourceLinks || []).find(l => l.platform === 'youtube');
                const soundcloudLink = (setList.sourceLinks || []).find(l => l.platform === 'soundcloud');

                return (
                  <InlineConflictOptions
                    key={conflict.id}
                    conflict={conflict}
                    onSelect={async (optionId) => {
                      const result = await voteOnConflict(conflict.id, optionId, userId);
                      if (result.success) {
                        await addPoints('vote_cast', conflict.id);
                        if (result.resolved && result.winnerId === optionId) {
                          await addPoints('vote_correct', conflict.id);
                        }
                      }
                      return result;
                    }}
                    youtubeUrl={youtubeLink?.url}
                    soundcloudUrl={soundcloudLink?.url}
                  />
                );
              }

              // Gap indicator - missing track(s)
              if (item.type === 'gap') {
                const formatTime = (secs: number) => {
                  const mins = Math.floor(secs / 60);
                  const s = secs % 60;
                  return `${mins}:${s.toString().padStart(2, '0')}`;
                };
                const estimatedTracks = Math.max(1, Math.round(item.duration / 180));
                const hasAudioSource = !!audioSource;
                const isPickMode = !!pickedTrack;

                return (
                  <Pressable
                    key={item.gapId}
                    style={[
                      styles.gapIndicator,
                      isPickMode && styles.gapIndicatorDropTarget,
                    ]}
                    onPress={isPickMode ? () => handlePlaceTrack(item.timestamp) : undefined}
                    disabled={!isPickMode}
                  >
                    <View style={styles.gapTimestamp}>
                      <Text style={styles.gapTimestampText}>{formatTime(item.timestamp)}</Text>
                    </View>
                    <View style={styles.gapContent}>
                      <View style={[styles.gapLine, isPickMode && styles.gapLineActive]} />
                      <Text style={[styles.gapText, isPickMode && styles.gapTextActive]}>
                        {isPickMode ? 'Place here' : `~${estimatedTracks} track${estimatedTracks > 1 ? 's' : ''} missing`}
                      </Text>
                      <View style={[styles.gapLine, isPickMode && styles.gapLineActive]} />
                    </View>
                    <View style={styles.gapActions}>
                      {!isPickMode && hasAudioSource && (
                        <Pressable
                          style={styles.gapIdentifyButton}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setIdentifyTimestamp(item.timestamp);
                            setShowIdentifyModal(true);
                          }}
                          hitSlop={8}
                        >
                          <Radio size={14} color={Colors.dark.primary} />
                          <Text style={styles.gapIdentifyText}>Identify</Text>
                        </Pressable>
                      )}
                      {!isPickMode && (
                        <Pressable
                          style={styles.gapAddButton}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setFillGapTimestamp(item.timestamp);
                            setShowFillGapModal(true);
                          }}
                          hitSlop={8}
                        >
                          <Plus size={16} color={Colors.dark.primary} />
                        </Pressable>
                      )}
                    </View>
                  </Pressable>
                );
              }

              // Timestamp conflict - multiple tracks at similar timestamps
              if (item.type === 'timestamp-conflict') {
                const formatTime = (secs: number) => {
                  const mins = Math.floor(secs / 60);
                  const s = secs % 60;
                  return `${mins}:${s.toString().padStart(2, '0')}`;
                };

                // Check if user has already voted on this conflict
                const votedTrack = timestampVotes[item.timestamp];
                if (votedTrack) {
                  // Show the voted track with pending indicator
                  const isUnidentified = votedTrack.isId || votedTrack.title?.toLowerCase() === 'id';
                  return (
                    <View key={`ts-voted-${item.timestamp}`} style={styles.votedTrackContainer}>
                      <TrackCard
                        track={votedTrack}
                        showTimestamp
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedTrack(votedTrack);
                          if (votedTrack.timestamp !== undefined) {
                            setPendingTimestamp(votedTrack.timestamp);
                          }
                        }}
                        onContributorPress={(username) => setSelectedContributor(username)}
                        onListen={isUnidentified && audioSource ? () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setAudioPreviewTrack(votedTrack);
                        } : undefined}
                      />
                      <View style={styles.votedTrackBadge}>
                        <CheckCircle size={10} color={Colors.dark.primary} />
                        <Text style={styles.votedTrackBadgeText}>Your vote • Pending</Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={`ts-conflict-${item.timestamp}`} style={styles.timestampConflict}>
                    <View style={styles.timestampConflictHeader}>
                      <View style={styles.timestampConflictBadge}>
                        <AlertCircle size={12} color="#FB923C" />
                        <Text style={styles.timestampConflictBadgeText}>Vote: Which track plays here?</Text>
                      </View>
                      <Text style={styles.timestampConflictTime}>~{formatTime(item.timestamp)}</Text>
                    </View>
                    <Text style={styles.timestampConflictSubtext}>
                      These tracks were identified at similar timestamps. Help us determine the correct order.
                    </Text>
                    {item.tracks.map((track, trackIndex) => {
                      return (
                        <Pressable
                          key={track.id}
                          style={styles.timestampConflictOption}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            // Record the vote and collapse the conflict
                            setTimestampVotes(prev => ({
                              ...prev,
                              [item.timestamp]: track,
                            }));
                          }}
                        >
                          <View style={styles.timestampConflictVoteBtn}>
                            <Text style={styles.timestampConflictVoteBtnText}>{trackIndex + 1}</Text>
                          </View>
                          <View style={styles.timestampConflictTrackInfo}>
                            <Text style={styles.timestampConflictTrackTitle} numberOfLines={1}>
                              {track.title || 'Unknown'}
                            </Text>
                            <Text style={styles.timestampConflictTrackArtist} numberOfLines={1}>
                              {track.artist || 'Unknown Artist'}
                            </Text>
                          </View>
                          <Text style={styles.timestampConflictTrackTime}>
                            {formatTime(track.timestamp || 0)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              }

              // Regular track
              if (item.type === 'track') {
                const track = item.data;
                const isUnidentified = track.isId || track.title?.toLowerCase() === 'id';
                return (
                  <TrackCard
                    key={track.id}
                    track={track}
                    showTimestamp
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      // Show track detail modal
                      setSelectedTrack(track);
                      // Store the timestamp for when user clicks play
                      if (track.timestamp !== undefined) {
                        setPendingTimestamp(track.timestamp);
                      }
                    }}
                    onContributorPress={(username) => setSelectedContributor(username)}
                    onListen={isUnidentified && audioSource ? () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setAudioPreviewTrack(track);
                    } : undefined}
                    onIDThis={isUnidentified ? () => {
                      setIdThisTrack(track);
                      setShowIDThisModal(true);
                    } : undefined}
                  />
                );
              }

              return null;
            })}
            
            {tracklistItems.length === 0 && unplacedTracks.length === 0 && (
              <View style={styles.emptyTracks}>
                <Sparkles size={32} color={Colors.dark.textMuted} />
                <Text style={styles.emptyText}>No tracks identified yet</Text>
                <Text style={styles.emptySubtext}>
                  Be the first to contribute! Add a track you recognize.
                </Text>
                <Pressable
                  style={styles.emptyAddButton}
                  onPress={() => setShowAddModal(true)}
                >
                  <Plus size={16} color={Colors.dark.background} />
                  <Text style={styles.emptyAddButtonText}>Add First Track</Text>
                </Pressable>
              </View>
            )}

            {/* Unplaced Tracks Section - tracks without timestamps */}
            {unplacedTracks.length > 0 && (
              <View style={styles.unplacedSection}>
                <View style={styles.unplacedHeader}>
                  <View style={styles.unplacedTitleRow}>
                    <ListMusic size={16} color={Colors.dark.textSecondary} />
                    <Text style={styles.unplacedTitle}>
                      {tracklistItems.length > 0 ? 'Unplaced Tracks' : 'Track List'}
                    </Text>
                  </View>
                  <Text style={styles.unplacedSubtitle}>
                    {tracklistItems.length > 0 && estimatedMissingTracks > 0
                      ? 'Tap a track, then tap a gap to place it'
                      : tracklistItems.length > 0
                      ? 'Add a YouTube or SoundCloud source to place these in the timeline'
                      : 'Add a source to get timestamps'}
                  </Text>
                </View>
                {unplacedTracks.map((track, index) => {
                  const isPicked = pickedTrack?.id === track.id;
                  return (
                    <Pressable
                      key={track.id}
                      style={[
                        styles.unplacedTrackCard,
                        isPicked && styles.unplacedTrackCardPicked,
                      ]}
                      onPress={() => {
                        if (isPicked) {
                          setPickedTrack(null);
                        } else if (estimatedMissingTracks > 0) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setPickedTrack(track);
                        } else {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedTrack(track);
                        }
                      }}
                      onLongPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedTrack(track);
                      }}
                    >
                      <View style={styles.unplacedTrackIndex}>
                        <Text style={styles.unplacedTrackIndexText}>{index + 1}</Text>
                      </View>
                      <View style={styles.unplacedTrackInfo}>
                        <Text style={styles.unplacedTrackTitle} numberOfLines={1}>{track.title}</Text>
                        <Text style={styles.unplacedTrackArtist} numberOfLines={1}>{track.artist}</Text>
                      </View>
                      {isPicked && (
                        <View style={styles.pickedBadge}>
                          <Text style={styles.pickedBadgeText}>Selected</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {(tracklistItems.length > 0 || unplacedTracks.length > 0) && (
              <View style={styles.missingTrackCta}>
                <Text style={styles.missingTrackText}>Know a track we missed?</Text>
                <Pressable
                  style={styles.contributeButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowAddModal(true);
                  }}
                >
                  <Text style={styles.contributeButtonText}>Contribute</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Comments Section */}
          {/* Similar Sets */}
          {id && <SimilarSets setId={id} />}

          {id && <CommentsSection setId={id} />}
        </View>
      </ScrollView>

      {/* Floating banner when a track is picked for placement */}
      {pickedTrack && (
        <View style={styles.pickedBanner}>
          <View style={styles.pickedBannerContent}>
            <View style={styles.pickedBannerInfo}>
              <Text style={styles.pickedBannerTitle} numberOfLines={1}>
                {pickedTrack.artist} - {pickedTrack.title}
              </Text>
              <Text style={styles.pickedBannerHint}>Tap a gap above to place</Text>
            </View>
            <Pressable
              style={styles.pickedBannerClose}
              onPress={() => setPickedTrack(null)}
              hitSlop={8}
            >
              <Text style={styles.pickedBannerCloseText}>✕</Text>
            </Pressable>
          </View>
        </View>
      )}

      <AddTrackModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddTrack}
        totalDuration={setList.totalDuration}
      />

      <FillGapModal
        visible={showFillGapModal}
        timestamp={fillGapTimestamp}
        unplacedTracks={unplacedTracks}
        onClose={() => setShowFillGapModal(false)}
        onSelectTrack={handleFillGapSelectTrack}
        onAddNew={() => setShowAddModal(true)}
      />

      <ContributorModal
        visible={selectedContributor !== null}
        username={selectedContributor || ''}
        onClose={() => setSelectedContributor(null)}
      />

      <AddSourceModal
        visible={showSourceModal}
        platform={selectedPlatform}
        setName={setList?.name || 'this set'}
        setArtist={setList?.artist}
        onClose={() => setShowSourceModal(false)}
        onImport={async (url) => {
          if (!setList) return { success: false, error: 'Set not found' };

          // For database sets, scrape comments and update the set
          if (dbSet) {
            try {
              // First, scrape the URL for track IDs
              const importResponse = await fetch(`${API_BASE_URL}/api/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
              });
              const importResult = await importResponse.json();

              if (!importResult.success) {
                return { success: false, error: importResult.error || 'Failed to scrape comments' };
              }

              // Update set tracks with timestamps from the scraped data
              const scrapedTracks = importResult.setList?.tracks || [];
              if (scrapedTracks.length > 0) {
                const updateResponse = await fetch(`${API_BASE_URL}/api/sets/update-tracks`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    setId: setList.id,
                    tracks: scrapedTracks,
                    source: selectedPlatform,
                    coverUrl: importResult.setList?.coverUrl,
                  }),
                });
                const updateResult = await updateResponse.json();
                if (__DEV__) console.log('[AddSource] Updated tracks:', updateResult);
              }

              // Save the source URL to the database
              const addSourceResponse = await fetch(`${API_BASE_URL}/api/sets/add-source`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  setId: setList.id,
                  url,
                  platform: selectedPlatform,
                }),
              });
              const addSourceResult = await addSourceResponse.json();

              if (!addSourceResult.success) {
                // URL might already exist, but scraping worked
                if (__DEV__) console.log('Add source warning:', addSourceResult.error);
              }

              // Update local state to reflect the new source and coverUrl immediately
              const newCoverUrl = importResult.setList?.coverUrl;
              setDbSet(prev => prev ? {
                ...prev,
                sourceLinks: [...(prev.sourceLinks || []), { platform: selectedPlatform, url }],
                ...(newCoverUrl && { coverUrl: newCoverUrl }),
              } : prev);

              // Refresh the set data to get updated tracks with timestamps
              const refreshResponse = await fetch(`${API_BASE_URL}/api/sets/${setList.id}`);
              const refreshData = await refreshResponse.json();
              if (refreshData.success && refreshData.set) {
                const refreshedSet: SetList = {
                  id: refreshData.set.id,
                  name: refreshData.set.name,
                  artist: refreshData.set.artist,
                  venue: refreshData.set.venue,
                  date: new Date(refreshData.set.date),
                  totalDuration: refreshData.set.totalDuration || 0,
                  coverUrl: refreshData.set.coverUrl || undefined,
                  plays: refreshData.set.trackCount * 10,
                  sourceLinks: refreshData.set.sourceLinks || [],
                  tracks: refreshData.set.tracks?.map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    artist: t.artist,
                    duration: 0,
                    coverUrl: t.coverUrl || '',
                    addedAt: new Date(t.addedAt || Date.now()),
                    source: t.source || 'database',
                    timestamp: t.timestamp || 0,
                    timestampStr: t.timestampStr,
                    verified: t.verified || !t.isId,
                    confidence: t.isId ? 0 : 1,
                    isId: t.isId,
                    isReleased: t.isReleased || false,
                    previewUrl: t.previewUrl || undefined,
                    trackLinks: t.trackLinks || [],
                  })) || [],
                  hasGaps: refreshData.set.hasGaps,
                  gapCount: refreshData.set.gapCount,
                };
                setDbSet(refreshedSet);
              }

              await addPoints('source_added', setList.id);

              // Return stats from the import
              return {
                success: true,
                stats: {
                  matched: importResult.tracksCount || 0,
                  newFromSecondary: scrapedTracks.length,
                  commentsScraped: importResult.commentsCount || 0,
                },
              };
            } catch (error: any) {
              return { success: false, error: error.message || 'Network error' };
            }
          }

          // For local sets, use the context
          const result = await addSourceToSet(setList.id, url, selectedPlatform);
          if (result.success) {
            await addPoints('source_added', setList.id);
          }
          return result;
        }}
      />

      <TrackDetailModal
        visible={selectedTrack !== null}
        track={selectedTrack}
        onClose={() => {
          setSelectedTrack(null);
          setPendingTimestamp(null);
        }}
        onPlayTimestamp={() => {
          if (pendingTimestamp !== null) {
            // If player is showing, seek to timestamp
            if (showPlayer) {
              setCurrentTimestamp(pendingTimestamp);
              if (playerMinimized) {
                setPlayerMinimized(false);
              }
            } else {
              // Start the player at the timestamp
              const youtubeLink = (setList.sourceLinks || []).find(l => l.platform === 'youtube');
              if (youtubeLink) {
                setCurrentTimestamp(pendingTimestamp);
                setShowPlayer(true);
                setPlayerMinimized(false);
              }
            }
          }
          setPendingTimestamp(null);
        }}
      />

      <AudioPreviewModal
        visible={audioPreviewTrack !== null}
        onClose={() => setAudioPreviewTrack(null)}
        onSubmitIdentification={handleIdentifyTrack}
        sourceUrl={audioSource?.url || null}
        sourcePlatform={audioSource?.platform || null}
        timestamp={audioPreviewTrack?.timestamp || 0}
        trackArtist={
          audioPreviewTrack?.artist &&
          audioPreviewTrack.artist.toLowerCase() !== 'id' &&
          audioPreviewTrack.artist.toLowerCase() !== 'unknown'
            ? audioPreviewTrack.artist
            : undefined
        }
      />

      <IdentifyTrackModal
        visible={showIdentifyModal}
        onClose={() => setShowIdentifyModal(false)}
        onIdentified={handleACRCloudIdentified}
        timestamp={identifyTimestamp}
        setTitle={setList?.name}
        audioUrl={audioSource?.url}
      />

      <IDThisModal
        visible={showIDThisModal}
        onClose={() => {
          setShowIDThisModal(false);
          setIdThisTrack(null);
        }}
        track={idThisTrack}
        setId={id || ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerImage: {
    height: 300,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  headerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    marginTop: -60,
  },
  titleSection: {
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleInfo: {
    flex: 1,
    marginRight: 16,
  },
  artistsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 4,
  },
  artistItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artist: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  artistSeparator: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: Colors.dark.primary,
    opacity: 0.4,
    marginHorizontal: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    lineHeight: 30,
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venue: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 6,
  },
  quickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  quickStatText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  quickStatDot: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginHorizontal: 8,
  },
  linksSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    flex: 1,
  },
  linkCardFilled: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  linkCardEmpty: {
    borderWidth: 1,
    borderColor: Colors.dark.surfaceLight,
    borderStyle: 'dashed',
  },
  linkIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkIconEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.dark.surfaceLight,
  },
  linkPlatform: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  linkPlatformEmpty: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.dark.textMuted,
  },
  linkLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  linkExternal: {
    marginLeft: 'auto',
  },
  linkCardWrapper: {
    flex: 1,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FF0000',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  analyzeButtonText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  analyzedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  analyzedBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#22C55E',
  },
  identifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 6,
    paddingVertical: 5,
    paddingRight: 8,
    paddingLeft: 4,
    marginTop: 6,
  },
  identifiedBadgeIdContainer: {
    backgroundColor: '#22C55E',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginRight: 1,
  },
  identifiedBadgeId: {
    fontSize: 10,
    fontWeight: '900' as const,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  identifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#22C55E',
  },
  conflictHintBanner: {
    backgroundColor: 'rgba(206, 138, 75, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(206, 138, 75, 0.2)',
  },
  conflictHintText: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsSection: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 1,
  },
  statLabel: {
    fontSize: 8,
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  statCardWide: {
    flex: 1.2,
    minWidth: 85,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 8,
    overflow: 'hidden',
  },
  releaseStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    flexWrap: 'nowrap',
  },
  releaseStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  releaseStatusDivider: {
    width: 1,
    height: 10,
    backgroundColor: Colors.dark.border,
    marginHorizontal: 4,
  },
  releaseStatusValue: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  releaseStatusLabel: {
    fontSize: 7,
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
  },
  releaseStatusBarContainer: {
    flexDirection: 'row',
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    gap: 1,
  },
  releaseStatusBar: {
    height: '100%',
    borderRadius: 1.5,
  },
  releaseStatusBarReleased: {
    backgroundColor: '#22C55E',
  },
  releaseStatusBarUnreleased: {
    backgroundColor: Colors.dark.primary,
  },
  // Missing tracks banner
  missingTracksBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 146, 60, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.2)',
  },
  missingTracksIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingTracksText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FB923C',
  },
  missingTracksHint: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  // Timestamp conflict styles
  timestampConflict: {
    backgroundColor: 'rgba(251, 146, 60, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.2)',
  },
  timestampConflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  timestampConflictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timestampConflictBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FB923C',
  },
  timestampConflictTime: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.textMuted,
    fontVariant: ['tabular-nums'] as any,
  },
  timestampConflictSubtext: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: 12,
    lineHeight: 16,
  },
  timestampConflictOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    gap: 10,
  },
  timestampConflictVoteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.3)',
  },
  timestampConflictVoteBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FB923C',
  },
  timestampConflictTrackInfo: {
    flex: 1,
  },
  timestampConflictTrackTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  timestampConflictTrackArtist: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  timestampConflictTrackTime: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.dark.textMuted,
    fontVariant: ['tabular-nums'] as any,
  },
  // Voted track with pending indicator
  votedTrackContainer: {
    position: 'relative',
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 170, 0.3)',
    backgroundColor: 'rgba(0, 212, 170, 0.05)',
  },
  votedTrackBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  votedTrackBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  aiInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  playInAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 0, 0.2)',
  },
  playInAppIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playInAppInfo: {
    flex: 1,
  },
  playInAppTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  playInAppSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  aiInfoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  tracksSection: {},
  tracksSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  addTrackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
  },
  addTrackText: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: '500' as const,
  },
  emptyTracks: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyAddButtonText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  gapIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.06)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 4,
    marginTop: -2,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.15)',
    borderStyle: 'dashed',
    minHeight: 32,
  },
  gapTimestamp: {
    width: 38,
    marginRight: 8,
  },
  gapTimestampText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
    fontVariant: ['tabular-nums'],
  },
  gapContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gapLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 107, 53, 0.25)',
  },
  gapText: {
    fontSize: 10,
    color: Colors.dark.primary,
    fontWeight: '500' as const,
  },
  gapIndicatorDropTarget: {
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    borderColor: Colors.dark.primary,
    borderStyle: 'dashed',
    minHeight: 44,
  },
  gapLineActive: {
    backgroundColor: Colors.dark.primary,
    height: 2,
  },
  gapTextActive: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.dark.primary,
  },
  gapActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  gapIdentifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gapIdentifyText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  gapAddButton: {
    padding: 4,
  },
  unplacedIdsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  unplacedIdsText: {
    flex: 1,
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  unplacedSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  unplacedHeader: {
    marginBottom: 12,
  },
  unplacedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  unplacedTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  unplacedSubtitle: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  missingTrackCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  missingTrackText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  contributeButton: {
    backgroundColor: Colors.dark.surfaceLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  contributeButtonText: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: '600' as const,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    marginTop: 20,
  },
  errorText: {
    color: Colors.dark.text,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  // IDentified matching progress banners
  matchingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  matchingBannerContent: {
    flex: 1,
  },
  matchingBannerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  matchingBannerSubtext: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  matchingCompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
    gap: 8,
  },
  matchingCompleteText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.success,
  },
  matchingUnreleasedText: {
    color: Colors.dark.primary,
  },
  // Needs Source Banner styles
  needsSourceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
  },
  needsSourceIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  needsSourceContent: {
    flex: 1,
  },
  needsSourceTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
    marginBottom: 4,
  },
  needsSourceText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  // Pick-and-place styles
  unplacedTrackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  unplacedTrackCardPicked: {
    borderColor: Colors.dark.primary,
    borderWidth: 2,
    backgroundColor: 'rgba(196, 30, 58, 0.08)',
  },
  unplacedTrackIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  unplacedTrackIndexText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.dark.textSecondary,
  },
  unplacedTrackInfo: {
    flex: 1,
  },
  unplacedTrackTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  unplacedTrackArtist: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  pickedBadge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  pickedBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },
  // Floating banner
  pickedBanner: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pickedBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  pickedBannerInfo: {
    flex: 1,
  },
  pickedBannerTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 2,
  },
  pickedBannerHint: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  pickedBannerClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  pickedBannerCloseText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600' as const,
  },
});
