import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import TrackCard from '@/components/TrackCard';
import AddTrackModal from '@/components/AddTrackModal';
import ArtistLink from '@/components/ArtistLink';
import IDentifiedLogo from '@/components/IDentifiedLogo';
import ContributorModal from '@/components/ContributorModal';
import AddSourceModal from '@/components/AddSourceModal';
import InlineConflictOptions from '@/components/InlineConflictOptions';
import PointsBadge from '@/components/PointsBadge';
import YouTubePlayer, { extractYouTubeId } from '@/components/YouTubePlayer';
import TrackDetailModal from '@/components/TrackDetailModal';
import AudioPreviewModal from '@/components/AudioPreviewModal';
import { mockSetLists } from '@/mocks/tracks';
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
  const [isSaved, setIsSaved] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);

  // Database set state
  const [dbSet, setDbSet] = useState<SetList | null>(null);
  const [isLoadingSet, setIsLoadingSet] = useState(true);

  // Add Source Modal state
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<'youtube' | 'soundcloud'>('youtube');

  // Track Detail Modal state
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [pendingTimestamp, setPendingTimestamp] = useState<number | null>(null);

  // Audio Preview Modal state (for identifying unknown tracks)
  const [audioPreviewTrack, setAudioPreviewTrack] = useState<Track | null>(null);

  // YouTube Player state
  const [showPlayer, setShowPlayer] = useState(false);
  const [playerMinimized, setPlayerMinimized] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);

  // Fetch set from API
  useEffect(() => {
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
            coverUrl: data.set.coverUrl || 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400',
            plays: data.set.trackCount * 10,
            sourceLinks: data.set.sourceLinks || [],
            tracks: data.set.tracks?.map((t: any) => ({
              id: t.id,
              title: t.title,
              artist: t.artist,
              duration: 0,
              coverUrl: '',
              addedAt: new Date(t.addedAt || Date.now()),
              source: t.source || 'database',
              timestamp: t.timestamp || 0,
              timestampStr: t.timestampStr,
              verified: t.verified || !t.isId,
              confidence: t.isId ? 0 : 1,
              isId: t.isId,
            })) || [],
            hasGaps: data.set.hasGaps,
            gapCount: data.set.gapCount,
          };
          setDbSet(transformedSet);
          console.log('[SetDetail] Loaded set from API:', transformedSet.name, 'with', transformedSet.tracks?.length, 'tracks');
        }
      } catch (error) {
        console.error('[SetDetail] Failed to fetch set:', error);
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
      console.log('[SetDetail] Found real set:', realSet.name, 'with', realSet.tracks?.length, 'tracks');
      return realSet;
    }
    // Fallback to mock data for demo
    const mockSet = mockSetLists.find(s => s.id === id);
    if (mockSet) {
      console.log('[SetDetail] Using mock set:', mockSet.name);
    }
    return mockSet;
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

  // Filter and sort tracks - only show tracks with actual timestamps (> 0)
  // Tracks without timestamps are not useful - users need to know WHEN a track plays
  const sortedTracks = useMemo(() => {
    return [...tracks]
      .filter(track => {
        // Only show tracks with a real timestamp (> 0)
        // Timestamp 0 means "unknown position" - not useful for the timeline
        return track.timestamp && track.timestamp > 0;
      })
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [tracks]);

  // Count tracks that were filtered out (tracks without timestamps)
  const unplacedTrackCount = useMemo(() => {
    return tracks.filter(track => !track.timestamp || track.timestamp === 0).length;
  }, [tracks]);

  // Create a combined list of tracks and inline conflicts, sorted by timestamp
  type TracklistItem =
    | { type: 'track'; data: Track }
    | { type: 'gap'; timestamp: number; duration: number }
    | { type: 'conflict'; data: TrackConflict };

  const tracklistItems = useMemo<TracklistItem[]>(() => {
    // Filter out tracks that have active conflicts (they'll be shown as conflict options instead)
    const tracksWithoutConflicts = sortedTracks.filter(track => {
      // If this track has a conflict, don't show it separately
      if (track.hasConflict && track.conflictId) {
        return !conflicts.some(c => c.id === track.conflictId);
      }
      return true;
    });

    // Create track items and detect gaps
    const items: TracklistItem[] = [];
    const avgTrackDuration = 180; // Assume ~3 min average track length
    const gapThreshold = 240; // 4+ minutes gap suggests missing track(s)

    for (let i = 0; i < tracksWithoutConflicts.length; i++) {
      const track = tracksWithoutConflicts[i];
      const prevTrack = i > 0 ? tracksWithoutConflicts[i - 1] : null;

      // Check for gap before this track
      if (prevTrack) {
        const gap = (track.timestamp || 0) - (prevTrack.timestamp || 0);
        if (gap >= gapThreshold) {
          // There's a significant gap - likely missing track(s)
          items.push({
            type: 'gap' as const,
            timestamp: (prevTrack.timestamp || 0) + avgTrackDuration,
            duration: gap - avgTrackDuration,
          });
        }
      }

      items.push({
        type: 'track' as const,
        data: track,
      });
    }

    // Create conflict items
    const conflictItems: TracklistItem[] = conflicts.map(conflict => ({
      type: 'conflict' as const,
      data: conflict,
    }));

    // Combine and sort by timestamp
    const combined = [...items, ...conflictItems];
    combined.sort((a, b) => {
      const timestampA = a.type === 'track' ? (a.data.timestamp || 0) :
                         a.type === 'gap' ? a.timestamp : a.data.timestamp;
      const timestampB = b.type === 'track' ? (b.data.timestamp || 0) :
                         b.type === 'gap' ? b.timestamp : b.data.timestamp;
      return timestampA - timestampB;
    });

    return combined;
  }, [sortedTracks, conflicts]);

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
      console.error('Error saving/removing set:', error);
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
          console.error('Error checking saved status:', error);
        } finally {
          setLoadingSaved(false);
        }
      }
    };
    checkSavedStatus();
  }, [id]);

  // Show loading state with ID badge while fetching
  if (isLoadingSet || !setList) {
    return (
      <View style={styles.loadingContainer}>
        <IDentifiedLogo size="large" />
        {!isLoadingSet && !setList && (
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
      coverUrl: trackData.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
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
              coverUrl: '',
              addedAt: new Date(t.addedAt || Date.now()),
              source: t.source || 'database',
              timestamp: t.timestamp || 0,
              verified: t.verified || !t.isId,
              isId: t.isId,
            })) || [],
          };
          setDbSet(refreshedSet);
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await addPoints('track_confirmed', setList.id);
      }
    } catch (error) {
      console.error('Failed to identify track:', error);
    }
  };

  // Get the source URL and platform for audio preview
  const getAudioSource = (): { url: string; platform: 'youtube' | 'soundcloud' } | null => {
    if (!setList?.sourceLinks) return null;

    // Prefer YouTube, then SoundCloud
    const ytLink = setList.sourceLinks.find(l => l.platform === 'youtube');
    if (ytLink) return { url: ytLink.url, platform: 'youtube' };

    const scLink = setList.sourceLinks.find(l => l.platform === 'soundcloud');
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
      case '1001tracklists':
        return <ListMusic size={size} color="#00D4AA" />;
      default:
        return <ExternalLink size={size} color={Colors.dark.textSecondary} />;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'youtube': return 'YouTube';
      case 'soundcloud': return 'SoundCloud';
      case '1001tracklists': return '1001Tracklists';
      default: return 'Link';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerImage}>
          <Image
            key={setList.coverUrl || 'default-cover'}
            source={{ uri: setList.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop' }}
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
            
            {setList.venue && (
              <Text style={styles.venue}>{setList.venue}</Text>
            )}

            <View style={styles.quickStats}>
              {setList.plays ? (
                <>
                  <Text style={styles.quickStatText}>{formatPlays(setList.plays)} plays</Text>
                  <Text style={styles.quickStatDot}>•</Text>
                </>
              ) : null}
              {(setList.totalDuration || 0) > 0 ? (
                <>
                  <Text style={styles.quickStatText}>{formatTotalDuration(setList.totalDuration)}</Text>
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
                  <Text style={styles.matchingBannerTitle}>IDentifying tracks...</Text>
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
            const ytLink = setList.sourceLinks.find(l => l.platform === 'youtube');
            const scLink = setList.sourceLinks.find(l => l.platform === 'soundcloud');
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
                      Add a YouTube or SoundCloud link to enable our IDentification engine
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
                      Source links detected. Tap "Analyze" to run our IDentification engine.
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
                const ytLink = setList.sourceLinks.find(l => l.platform === 'youtube');
                // Check if analysis has been run by looking for tracks with timestamps > 0
                const hasTimestamps = setList.tracks?.some(t => t.timestamp && t.timestamp > 0);
                const needsAnalysis = ytLink && !hasTimestamps;

                // Debug logging
                console.log('[YT Analysis Check] ytLink:', !!ytLink, 'hasTimestamps:', hasTimestamps, 'needsAnalysis:', needsAnalysis);

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
                                  coverUrl: refreshData.set.coverUrl || importResult.setList?.coverUrl || 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400',
                                  plays: refreshData.set.trackCount * 10,
                                  sourceLinks: refreshData.set.sourceLinks || [],
                                  tracks: refreshData.set.tracks?.map((t: any) => ({
                                    id: t.id,
                                    title: t.title,
                                    artist: t.artist,
                                    duration: 0,
                                    coverUrl: '',
                                    addedAt: new Date(t.addedAt || Date.now()),
                                    source: t.source || 'database',
                                    timestamp: t.timestamp || 0,
                                    timestampStr: t.timestampStr,
                                    verified: t.verified || !t.isId,
                                    confidence: t.isId ? 0 : 1,
                                    isId: t.isId,
                                  })) || [],
                                  hasGaps: refreshData.set.hasGaps,
                                  gapCount: refreshData.set.gapCount,
                                };
                                setDbSet(refreshedSet);
                              }

                              Alert.alert('Success', `IDentified ${importResult.setList.tracks.length} tracks from this source`);
                            } else {
                              Alert.alert('No Results', 'No tracks could be IDentified from this source');
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
                      <View style={styles.analyzedBadge}>
                        <CheckCircle size={10} color="#22C55E" />
                        <Text style={styles.analyzedBadgeText}>Analyzed</Text>
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
                const scLink = setList.sourceLinks.find(l => l.platform === 'soundcloud');
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
                                  coverUrl: refreshData.set.coverUrl || importResult.setList?.coverUrl || 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400',
                                  plays: refreshData.set.trackCount * 10,
                                  sourceLinks: refreshData.set.sourceLinks || [],
                                  tracks: refreshData.set.tracks?.map((t: any) => ({
                                    id: t.id,
                                    title: t.title,
                                    artist: t.artist,
                                    duration: 0,
                                    coverUrl: '',
                                    addedAt: new Date(t.addedAt || Date.now()),
                                    source: t.source || 'database',
                                    timestamp: t.timestamp || 0,
                                    timestampStr: t.timestampStr,
                                    verified: t.verified || !t.isId,
                                    confidence: t.isId ? 0 : 1,
                                    isId: t.isId,
                                  })) || [],
                                  hasGaps: refreshData.set.hasGaps,
                                  gapCount: refreshData.set.gapCount,
                                };
                                setDbSet(refreshedSet);
                              }

                              Alert.alert('Success', `IDentified ${importResult.setList.tracks.length} tracks from this source`);
                            } else {
                              Alert.alert('No Results', 'No tracks could be IDentified from this source');
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
                      <View style={[styles.analyzedBadge, { backgroundColor: 'rgba(255, 85, 0, 0.1)' }]}>
                        <CheckCircle size={10} color="#FF5500" />
                        <Text style={[styles.analyzedBadgeText, { color: '#FF5500' }]}>Analyzed</Text>
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
              <Text style={styles.statLabel}>ID&apos;d</Text>
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
            
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(251, 146, 60, 0.15)' }]}>
                <MessageSquare size={14} color="#FB923C" />
              </View>
              <Text style={styles.statValue}>{setList.commentsScraped || 0}</Text>
              <Text style={styles.statLabel}>Sources</Text>
            </View>
          </View>

          {setList.aiProcessed && (setList.commentsScraped || 0) > 0 && (
            <View style={styles.aiInfoBanner}>
              <Sparkles size={14} color={Colors.dark.primary} />
              <Text style={styles.aiInfoText}>
                IDentified • {setList.commentsScraped?.toLocaleString()} data points analyzed
              </Text>
            </View>
          )}

          {/* Embedded YouTube Player */}
          {(() => {
            const ytLink = setList.sourceLinks.find(l => l.platform === 'youtube');
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

          {/* Inline conflict indicator */}
          {conflicts.length > 0 && (
            <View style={styles.conflictHintBanner}>
              <Text style={styles.conflictHintText}>
                {conflicts.length} track{conflicts.length !== 1 ? 's need' : ' needs'} identification - swipe right to select
              </Text>
            </View>
          )}

          {/* Unplaced tracks info - tracks detected without timestamps */}
          {unplacedTrackCount > 0 && (
            <View style={styles.unplacedIdsBanner}>
              <AlertCircle size={14} color={Colors.dark.textMuted} />
              <Text style={styles.unplacedIdsText}>
                {unplacedTrackCount} track{unplacedTrackCount !== 1 ? 's' : ''} identified but missing timestamps
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
                const youtubeLink = setList.sourceLinks.find(l => l.platform === 'youtube');
                const soundcloudLink = setList.sourceLinks.find(l => l.platform === 'soundcloud');

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

                return (
                  <Pressable
                    key={`gap-${item.timestamp}`}
                    style={styles.gapIndicator}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowAddModal(true);
                    }}
                  >
                    <View style={styles.gapTimestamp}>
                      <Text style={styles.gapTimestampText}>{formatTime(item.timestamp)}</Text>
                    </View>
                    <View style={styles.gapContent}>
                      <View style={styles.gapLine} />
                      <Text style={styles.gapText}>
                        ~{estimatedTracks} track{estimatedTracks > 1 ? 's' : ''} missing
                      </Text>
                      <View style={styles.gapLine} />
                    </View>
                    <Plus size={16} color={Colors.dark.primary} />
                  </Pressable>
                );
              }

              // Regular track
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
                />
              );
            })}
            
            {tracklistItems.length === 0 && (
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

            {tracklistItems.length > 0 && (
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
        </View>
      </ScrollView>

      <AddTrackModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddTrack}
        totalDuration={setList.totalDuration}
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
                console.log('[AddSource] Updated tracks:', updateResult);
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
                console.log('Add source warning:', addSourceResult.error);
              }

              // Update local state to reflect the new source and coverUrl immediately
              const newCoverUrl = importResult.setList?.coverUrl;
              setDbSet(prev => prev ? {
                ...prev,
                sourceLinks: [...prev.sourceLinks, { platform: selectedPlatform, url }],
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
                  coverUrl: refreshData.set.coverUrl || 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400',
                  plays: refreshData.set.trackCount * 10,
                  sourceLinks: refreshData.set.sourceLinks || [],
                  tracks: refreshData.set.tracks?.map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    artist: t.artist,
                    duration: 0,
                    coverUrl: '',
                    addedAt: new Date(t.addedAt || Date.now()),
                    source: t.source || 'database',
                    timestamp: t.timestamp || 0,
                    timestampStr: t.timestampStr,
                    verified: t.verified || !t.isId,
                    confidence: t.isId ? 0 : 1,
                    isId: t.isId,
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
              const youtubeLink = setList.sourceLinks.find(l => l.platform === 'youtube');
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
    marginTop: 8,
  },
  quickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
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
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
    borderStyle: 'dashed',
  },
  gapTimestamp: {
    width: 45,
    marginRight: 10,
  },
  gapTimestampText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
    fontVariant: ['tabular-nums'],
  },
  gapContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gapLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 107, 53, 0.3)',
  },
  gapText: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '500' as const,
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
});
