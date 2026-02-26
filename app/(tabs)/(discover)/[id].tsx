import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, ActivityIndicator, Alert, Platform, Modal, Animated as RNAnimated, Easing } from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useNavigation } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
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
  Heart,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  Radio,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import TrackCard from '@/components/TrackCard';
import AddTrackModal from '@/components/AddTrackModal';
import FillGapModal from '@/components/FillGapModal';
import ArtistLink from '@/components/ArtistLink';
import BubbleGlassLogo from '@/components/BubbleGlassLogo';
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
import { useLikeSet } from '@/hooks/useSocial';
import { getFallbackImage, getVenueImage } from '@/utils/coverImage';
import { useSets } from '@/contexts/SetsContext';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAudioPreview } from '@/contexts/AudioPreviewContext';
import { AuthGateModal } from '@/components/AuthGate';

// API base URL
const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

// Animated circle for the identification ring
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Animated trakd waveform bars for ring center
function TrakdWaveCenter() {
  const barAnims = useRef(
    Array.from({ length: 5 }, () => new RNAnimated.Value(0.3))
  ).current;

  useEffect(() => {
    barAnims.forEach((anim, i) => {
      const animate = () => {
        const peak = 0.4 + Math.random() * 0.6;
        const valley = 0.15 + Math.random() * 0.2;
        const dur = 300 + Math.random() * 400;
        RNAnimated.sequence([
          RNAnimated.timing(anim, { toValue: peak, duration: dur, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          RNAnimated.timing(anim, { toValue: valley, duration: dur + 100, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ]).start(animate);
      };
      setTimeout(animate, i * 80);
    });
    return () => barAnims.forEach(a => a.stopAnimation());
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      {barAnims.map((anim, i) => (
        <RNAnimated.View
          key={i}
          style={{
            width: 3,
            height: 18,
            borderRadius: 1.5,
            backgroundColor: '#C41E3A',
            transform: [{ scaleY: anim }],
          }}
        />
      ))}
    </View>
  );
}

// Liquid Glass Identification Ring — inspired by FYP skip button
function IdentificationRing({ identified, total, onPress }: { identified: number; total: number; onPress?: () => void }) {
  const progress = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const percentage = total > 0 ? Math.round((identified / total) * 100) : 0;

  // RN Animated values for shimmer + glow
  const shimmerAnim = useRef(new RNAnimated.Value(0)).current;
  const glowAnim = useRef(new RNAnimated.Value(0.3)).current;

  const size = 62;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    // Reanimated arc
    ringOpacity.value = withTiming(1, { duration: 400 });
    progress.value = withDelay(300, withSpring(percentage / 100, {
      damping: 18,
      stiffness: 80,
      mass: 1,
    }));

    // RN Animated shimmer rotation
    RNAnimated.loop(
      RNAnimated.timing(shimmerAnim, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // RN Animated glow pulse
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(glowAnim, {
          toValue: 0.7,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        RNAnimated.timing(glowAnim, {
          toValue: 0.3,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => {
      shimmerAnim.stopAnimation();
      glowAnim.stopAnimation();
    };
  }, [percentage]);

  const animatedStrokeProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
  }));

  const shimmerRotate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Animated.View style={[ringStyles.container, containerStyle]}>
        <View style={ringStyles.ringContainer}>
          {/* Outer glow ring — pulsing red */}
          <RNAnimated.View style={[ringStyles.glowRing, { opacity: glowAnim }]} />
          {/* Spinning shimmer accent */}
          <RNAnimated.View style={[ringStyles.shimmerRing, { transform: [{ rotate: shimmerRotate }] }]} />
          {/* 3D shadow */}
          <View style={ringStyles.shadowLayer} />
          {/* Glass face */}
          <View style={ringStyles.glassFace}>
            <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
              {/* Background track */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Animated red glass arc */}
              <AnimatedCircle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#C41E3A"
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                animatedProps={animatedStrokeProps}
                strokeLinecap="round"
              />
            </Svg>
            {/* Center animated waveform */}
            <View style={ringStyles.centerLabel}>
              <TrakdWaveCenter />
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const ringStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 82,
    height: 82,
  },
  glowRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.25)',
    shadowColor: '#C41E3A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  shimmerRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.25)',
    borderRightColor: 'rgba(196, 30, 58, 0.1)',
  },
  shadowLayer: {
    position: 'absolute',
    top: 3,
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  glassFace: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderTopColor: 'rgba(255,255,255,0.3)',
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  percentText: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(196, 30, 58, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  percentSymbol: {
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    marginTop: -3,
    marginLeft: 1,
  },
});

// Liquid glass progress bar for reanalyze loading state
function GlassProgressBar({ isActive }: { isActive: boolean }) {
  const fillAnim = useRef(new RNAnimated.Value(0)).current;
  const shimmerAnim = useRef(new RNAnimated.Value(0)).current;
  const glowAnim = useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    if (isActive) {
      // Fill bar: slow ease from 0→85% (never fully completes until done)
      RNAnimated.timing(fillAnim, {
        toValue: 0.85,
        duration: 8000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      // Shimmer sweep across the bar
      RNAnimated.loop(
        RNAnimated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ).start();

      // Glow pulse
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(glowAnim, { toValue: 0.7, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          RNAnimated.timing(glowAnim, { toValue: 0.3, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      ).start();

      return () => {
        fillAnim.stopAnimation();
        shimmerAnim.stopAnimation();
        glowAnim.stopAnimation();
      };
    } else {
      fillAnim.setValue(0);
    }
  }, [isActive]);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 260],
  });

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={glassBarStyles.wrapper}>
      {/* Glass track */}
      <View style={glassBarStyles.track}>
        {/* Fill */}
        <RNAnimated.View style={[glassBarStyles.fill, { width: fillWidth }]}>
          {/* Shimmer highlight */}
          <RNAnimated.View
            style={[glassBarStyles.shimmer, { transform: [{ translateX: shimmerTranslate }] }]}
          />
        </RNAnimated.View>
      </View>
      {/* Glow under bar */}
      <RNAnimated.View style={[glassBarStyles.glow, { opacity: glowAnim }]} />
    </View>
  );
}

const glassBarStyles = StyleSheet.create({
  wrapper: {
    width: '80%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderBottomColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: 'rgba(196, 30, 58, 0.45)',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
  },
  glow: {
    position: 'absolute',
    bottom: 0,
    width: '60%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'transparent',
    shadowColor: '#C41E3A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
});

// Transform API set response into SetList type
function transformApiSet(apiSet: any): SetList {
  return {
    id: apiSet.id,
    name: apiSet.name,
    artist: apiSet.artist,
    venue: apiSet.venue,
    date: new Date(apiSet.date),
    totalDuration: apiSet.totalDuration || 0,
    coverUrl: apiSet.coverUrl || undefined,
    artistImageUrl: apiSet.artistImageUrl || undefined,
    plays: apiSet.trackCount * 10,
    sourceLinks: apiSet.sourceLinks || [],
    tracks: apiSet.tracks?.map((t: any) => ({
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
              isUnreleased: t.isUnreleased || false,
      previewUrl: t.previewUrl || undefined,
      isrc: t.isrc || undefined,
      releaseDate: t.releaseDate || undefined,
      popularity: t.popularity || undefined,
      trackLinks: t.trackLinks || [],
    })) || [],
    hasGaps: apiSet.hasGaps,
    gapCount: apiSet.gapCount,
    aiProcessed: apiSet.aiProcessed,
    commentsScraped: apiSet.commentsScraped,
    tracksIdentified: apiSet.tracksIdentified,
    description: apiSet.description,
    source: apiSet.source,
  };
}

export default function SetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sets, addSourceToSet, voteOnConflict, getActiveConflicts, addTracksToSet } = useSets();
  const { userId, addPoints } = useUser();
  const { isAuthenticated } = useAuth();
  const { currentTrackId, isPlaying, isLoading: isPreviewLoading, failedTrackId, playPreview, playDeezerPreview, stop: stopAudio } = useAudioPreview();
  const { isLiked, toggleLike } = useLikeSet(id);

  const [showAuthGate, setShowAuthGate] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tracklistCollapsed, setTracklistCollapsed] = useState(false);
  const [showFillGapModal, setShowFillGapModal] = useState(false);
  const [fillGapTimestamp, setFillGapTimestamp] = useState(0);
  const [gapMenuData, setGapMenuData] = useState<{ timestamp: number; duration: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<{ type: 'success' | 'empty' | 'error'; message: string; trackCount?: number } | null>(null);
  const analyzePopupScale = useSharedValue(0);
  const analyzePopupOpacity = useSharedValue(0);
  const analyzePopupStyle = useAnimatedStyle(() => ({
    transform: [{ scale: analyzePopupScale.value }],
    opacity: analyzePopupOpacity.value,
  }));
  const analyzePopupIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withDelay(200, withSpring(1.1, { damping: 8 })) }],
  }));
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);

  // Database set state
  const [dbSet, setDbSet] = useState<SetList | null>(null);
  const [isLoadingSet, setIsLoadingSet] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsEnrichment, setNeedsEnrichment] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [artistGenres, setArtistGenres] = useState<string[]>([]);
  const [setGenre, setSetGenre] = useState<string | null>(null);

  // Add Source Modal state
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<'youtube' | 'soundcloud'>('youtube');

  // Track Detail Modal state
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [pendingTimestamp, setPendingTimestamp] = useState<number | null>(null);

  // Audio Preview Modal state (for identifying unknown tracks)
  const [audioPreviewTrack, setAudioPreviewTrack] = useState<Track | null>(null);

  // ACRCloud Identify Track Modal
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);


  // ID This Modal state
  const [showIDThisModal, setShowIDThisModal] = useState(false);
  const [idThisTrack, setIdThisTrack] = useState<Track | null>(null);

  // Track votes on timestamp conflicts (conflictTimestamp -> selected track)
  const [timestampVotes, setTimestampVotes] = useState<Record<number, Track>>({});

  // Pick-and-place: tap an unplaced track to pick it, then tap a gap to place it
  const [pickedTrack, setPickedTrack] = useState<Track | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  // Native-driven chart scale — no JS listener, runs on UI thread
  const chartScale = scrollY.interpolate({
    inputRange: [0, 250, 500],
    outputRange: [1, 1.08, 0.85],
    extrapolate: 'clamp',
  });

  // Cover image fallback state
  const [coverImageError, setCoverImageError] = useState(false);
  const [coverTriedHqFallback, setCoverTriedHqFallback] = useState(false);
  const [artistImageFailed, setArtistImageFailed] = useState(false);

  // Chart detail modal
  const [showChartModal, setShowChartModal] = useState(false);
  const chartModalAnim = useRef(new RNAnimated.Value(0)).current;
  // Badge explanation modal
  const [badgeExplain, setBadgeExplain] = useState<{ type: 'trakd' | 'verified' | 'community' | 'missing'; count: number } | null>(null);
  const badgeExplainAnim = useRef(new RNAnimated.Value(0)).current;

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
          // Store enrichment flag, artist genres, and set genre from API
          setNeedsEnrichment(!!data.needsEnrichment);
          setArtistGenres(data.set.artistGenres || []);
          setSetGenre(data.set.genre || null);

          // Transform API response to match SetList type
          const transformedSet: SetList = {
            id: data.set.id,
            name: data.set.name,
            artist: data.set.artist,
            venue: data.set.venue,
            date: new Date(data.set.date),
            totalDuration: data.set.totalDuration || 0,
            coverUrl: data.set.coverUrl || undefined,
            artistImageUrl: data.set.artistImageUrl || undefined,
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
              isUnreleased: t.isUnreleased || false,
              previewUrl: t.previewUrl || undefined,
              isrc: t.isrc || undefined,
              releaseDate: t.releaseDate || undefined,
              popularity: t.popularity || undefined,
              trackLinks: t.trackLinks || [],
              album: t.album || undefined,
            })) || [],
            hasGaps: data.set.hasGaps,
            gapCount: data.set.gapCount,
            source: data.set.source,
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

  // Stop audio preview when navigating away from this screen
  const navigation = useNavigation();
  useEffect(() => {
    const unsubBlur = navigation.addListener('blur', () => {
      stopAudio();
    });
    const unsubRemove = navigation.addListener('beforeRemove', () => {
      stopAudio();
    });
    return () => {
      unsubBlur();
      unsubRemove();
    };
  }, [navigation, stopAudio]);

  // Also stop when the set id changes (navigating to a different set)
  useEffect(() => {
    return () => { stopAudio(); };
  }, [id, stopAudio]);

  // Auto-enrich: if the API says there are un-cached tracks, fire enrichment in background
  useEffect(() => {
    if (!needsEnrichment || !id || isEnriching) return;

    const enrichSet = async () => {
      setIsEnriching(true);
      try {
        const enrichResponse = await fetch(`${API_BASE_URL}/api/spotify-enrich`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'enrich-set', setId: id }),
        });
        const enrichData = await enrichResponse.json();

        if (enrichData.success && enrichData.enriched > 0) {
          // Re-fetch set data to get updated album art
          const refetchResponse = await fetch(`${API_BASE_URL}/api/sets/${id}`);
          const refetchData = await refetchResponse.json();

          if (refetchData.success && refetchData.set) {
            const transformedSet: SetList = {
              id: refetchData.set.id,
              name: refetchData.set.name,
              artist: refetchData.set.artist,
              venue: refetchData.set.venue,
              date: new Date(refetchData.set.date),
              totalDuration: refetchData.set.totalDuration || 0,
              coverUrl: refetchData.set.coverUrl || undefined,
              artistImageUrl: refetchData.set.artistImageUrl || undefined,
              plays: refetchData.set.trackCount * 10,
              sourceLinks: refetchData.set.sourceLinks || [],
              tracks: refetchData.set.tracks?.map((t: any) => ({
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
              isUnreleased: t.isUnreleased || false,
                previewUrl: t.previewUrl || undefined,
                isrc: t.isrc || undefined,
                releaseDate: t.releaseDate || undefined,
                popularity: t.popularity || undefined,
                trackLinks: t.trackLinks || [],
                album: t.album || undefined,
              })) || [],
              hasGaps: refetchData.set.hasGaps,
              gapCount: refetchData.set.gapCount,
            };
            setDbSet(transformedSet);
          }
        }
      } catch (err) {
        if (__DEV__) console.log('[SetDetail] Auto-enrich failed:', err);
      } finally {
        setIsEnriching(false);
        setNeedsEnrichment(false);
      }
    };

    enrichSet();
  }, [needsEnrichment, id]);

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

    // 4. Title or artist is a reaction/comment/sentence, not a track name
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
      // Sentence-like text (comment garbage scraped as track names)
      /\.\s+[A-Z]/, // Period then capital = sentence boundary
      /^(and it|but it|there have|there are|there is)\s/i, // Sentence openers
      /\b(plenty of|hundreds of|time for|from many)\b/i, // Multi-word sentence fragments
    ];
    if (garbagePatterns.some(p => p.test(title) || p.test(artist))) return true;

    // 5. Title or artist is a short string with a date pattern (event reference, not a track)
    const datePattern = /\b\d{1,2}[/\-]\d{1,2}\b/;
    if ((datePattern.test(title) && title.split(/\s+/).length <= 3) ||
        (datePattern.test(artist) && artist.split(/\s+/).length <= 3)) return true;

    // 6. Title equals artist (parsing error — same text landed in both fields)
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

    // Fuzzy string similarity using word overlap + Levenshtein for typos
    const fuzzyTitleMatch = (a: string, b: string): number => {
      const na = (a || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      const nb = (b || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      if (!na || !nb) return 0;
      if (na === nb) return 1;
      if (na.includes(nb) || nb.includes(na)) return 0.85;
      // Word overlap with Levenshtein for 1-2 letter typos
      const wa = na.split(/\s+/);
      const wb = nb.split(/\s+/);
      let matches = 0;
      for (const w1 of wa) {
        for (const w2 of wb) {
          if (w1 === w2) { matches++; break; }
          // Levenshtein: allow 1-2 char difference for words 4+ chars
          if (w1.length >= 4 && w2.length >= 4) {
            const maxLen = Math.max(w1.length, w2.length);
            let dist = 0;
            const dp: number[][] = Array.from({ length: w1.length + 1 }, (_, i) => [i]);
            for (let j = 0; j <= w2.length; j++) dp[0][j] = j;
            for (let i = 1; i <= w1.length; i++)
              for (let j = 1; j <= w2.length; j++)
                dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+(w1[i-1]===w2[j-1]?0:1));
            dist = dp[w1.length][w2.length];
            if (1 - dist / maxLen > 0.75) { matches += 0.8; break; }
          }
        }
      }
      return matches / Math.max(wa.length, wb.length);
    };

    // Deduplicate unplaced tracks AND cross-check against placed tracks
    const dedupedUnplaced: Track[] = [];
    for (const track of unplaced) {
      const newTitle = (track.title || '').toLowerCase();
      const newArtist = (track.artist || '').toLowerCase();

      // Check against PLACED tracks — skip if a near-duplicate is already in the timeline
      const matchesPlaced = timed.some(placed => {
        const titleSim = fuzzyTitleMatch(track.title, placed.title);
        const artistSim = fuzzyTitleMatch(track.artist, placed.artist);
        return titleSim >= 0.7 && (artistSim >= 0.5 || !newArtist || !placed.artist);
      });
      if (matchesPlaced) continue;

      // Check against other unplaced tracks already accepted
      const matchesUnplaced = dedupedUnplaced.some(existing => {
        const titleSim = fuzzyTitleMatch(track.title, existing.title);
        const artistSim = fuzzyTitleMatch(track.artist, existing.artist);
        return titleSim >= 0.7 && (artistSim >= 0.5 || !newArtist || !existing.artist);
      });
      if (matchesUnplaced) continue;

      dedupedUnplaced.push(track);
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

  // Clean up malformed track/artist names from scraping artifacts
  const cleanTrackName = (name: string | undefined): string => {
    if (!name) return '';
    let cleaned = name;
    // Strip leading track numbers like "75) " or "12. "
    cleaned = cleaned.replace(/^\d+\)\s*/, '');
    cleaned = cleaned.replace(/^\d+\.\s*/, '');
    // Remove leading close paren
    cleaned = cleaned.replace(/^\)\s*/, '');
    // Fix unbalanced parentheses — remove trailing unclosed opens
    let openCount = 0;
    for (const ch of cleaned) {
      if (ch === '(') openCount++;
      if (ch === ')') openCount--;
    }
    if (openCount > 0) {
      for (let k = 0; k < openCount; k++) {
        const lastOpen = cleaned.lastIndexOf('(');
        if (lastOpen !== -1) {
          cleaned = cleaned.substring(0, lastOpen).trim();
        }
      }
    }
    return cleaned.trim();
  };

  // Smart timestamp conflict detection and tracklist building
  const { tracklistItems, estimatedMissingTracks, avgTrackDur } = useMemo<{
    tracklistItems: TracklistItem[];
    estimatedMissingTracks: number;
    avgTrackDur: number;
  }>(() => {
    // Get max valid timestamp from set duration (use totalDuration or fallback to 2 hours)
    const maxValidTimestamp = (setList?.totalDuration && setList.totalDuration > 0)
      ? setList.totalDuration + 60 // Add 1 min buffer for tracks that might start near the end
      : 7200; // Default 2 hour max if no duration

    // Helper: normalize string for comparison (remove special chars, lowercase)
    const normalizeStr = (s: string | undefined): string => {
      if (!s) return '';
      return s.toLowerCase()
        .replace(/^\d+\)\s*/, '') // Strip leading track numbers like "75) "
        .replace(/^\d+\.\s*/, '') // Strip "12. " style numbers
        .replace(/\(mixed\)|\(original mix\)|\(original\)/g, '') // Strip common suffixes
        .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
        .replace(/^(\d{1,3})(?=[a-z])/g, '') // Strip leading digits before letters (track numbers)
        .replace(/feat|ft|featuring/g, '') // Remove featuring indicators
        .trim();
    };

    // Helper: check if two artist names refer to the same person
    // Handles variations like "M High", "High", "M", "mhigh" etc.
    const isSameArtist = (a: string | undefined, b: string | undefined): boolean => {
      const artA = normalizeStr(a);
      const artB = normalizeStr(b);
      if (!artA || !artB) return false;
      if (artA === artB) return true;
      // One contains the other (e.g. "mhigh" contains "high")
      if (artA.length > 2 && artB.length > 2 && (artA.includes(artB) || artB.includes(artA))) return true;
      // Character similarity >= 70%
      if (artA.length > 2 && artB.length > 2) {
        const shorter = artA.length <= artB.length ? artA : artB;
        const longer = artA.length > artB.length ? artA : artB;
        let matches = 0;
        for (let ci = 0; ci < shorter.length; ci++) {
          if (shorter[ci] === longer[ci]) matches++;
        }
        if (matches / longer.length >= 0.7) return true;
      }
      return false;
    };

    // Helper: check if two tracks are essentially the same song
    const isSameTrack = (a: Track, b: Track): boolean => {
      const titleA = normalizeStr(a.title);
      const titleB = normalizeStr(b.title);
      const artistA = normalizeStr(a.artist);
      const artistB = normalizeStr(b.artist);

      // Skip comparison if both are empty
      if (!titleA && !titleB) return true;

      // Exact match on title+artist
      if (titleA === titleB && artistA === artistB) return true;

      // Exact title match (even with different artist metadata)
      if (titleA && titleB && titleA === titleB) return true;

      // Title contains the other
      const titleMatch = (titleA && titleB) && (titleA.includes(titleB) || titleB.includes(titleA));
      // Artist contains the other
      const artistMatch = isSameArtist(a.artist, b.artist);

      // If both title and artist partially match, likely same track
      if (titleMatch && artistMatch) return true;

      // If titles match and at least one artist is present, likely same track with different artist formatting
      if (titleMatch && (artistA || artistB)) return true;

      // Check for very similar titles with same artist base
      if (artistMatch && (
        titleA.length > 4 && titleB.length > 4 &&
        (titleA.includes(titleB.slice(0, 5)) || titleB.includes(titleA.slice(0, 5)))
      )) {
        return true;
      }

      // If titles share a significant prefix (first 60%+ chars match)
      if (titleA.length > 4 && titleB.length > 4) {
        const shorter = titleA.length <= titleB.length ? titleA : titleB;
        const longer = titleA.length > titleB.length ? titleA : titleB;
        const prefixLen = Math.ceil(shorter.length * 0.6);
        if (longer.startsWith(shorter.slice(0, prefixLen))) return true;
      }

      // Check for swapped title/artist (common parsing error)
      const titleInOtherArtist = titleA.length > 4 && artistB.includes(titleA.slice(0, Math.min(6, titleA.length)));
      const artistInOtherTitle = artistA.length > 4 && titleB.includes(artistA.slice(0, Math.min(6, artistA.length)));
      const otherTitleInArtist = titleB.length > 4 && artistA.includes(titleB.slice(0, Math.min(6, titleB.length)));
      const otherArtistInTitle = artistB.length > 4 && titleA.includes(artistB.slice(0, Math.min(6, artistB.length)));

      if ((titleInOtherArtist || otherArtistInTitle) && (artistInOtherTitle || otherTitleInArtist)) {
        return true;
      }

      // Check if title contains mix/remix info that matches
      if (titleA.length > titleB.length && titleA.includes(titleB) && titleB.length > 3) return true;
      if (titleB.length > titleA.length && titleB.includes(titleA) && titleA.length > 3) return true;

      // Word overlap check for titles (Jaccard similarity)
      if (titleA.length > 6 && titleB.length > 6) {
        const wordsA = new Set(titleA.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
        const wordsB = new Set(titleB.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
        if (wordsA.size > 0 && wordsB.size > 0) {
          const intersection = [...wordsA].filter(w => wordsB.has(w));
          const smaller = Math.min(wordsA.size, wordsB.size);
          if (intersection.length / smaller >= 0.5) return true;
        }
      }

      // Cross-field match: one track's artist is basically the other's title
      // Catches parsing errors where title/artist are swapped (e.g. artist="Another brick in the wall")
      if (artistB.length > 8 && titleA.includes(artistB)) return true;
      if (artistA.length > 8 && titleB.includes(artistA)) return true;
      if (titleA.length > 8 && artistB.includes(titleA)) return true;
      if (titleB.length > 8 && artistA.includes(titleB)) return true;

      // Check if one title appears in the other's combined title+artist
      const combinedA = titleA + artistA;
      const combinedB = titleB + artistB;
      if (titleA.length > 5 && combinedB.includes(titleA)) return true;
      if (titleB.length > 5 && combinedA.includes(titleB)) return true;

      // Levenshtein-like: if titles differ by very few characters (typos, slight variations)
      if (titleA.length > 5 && titleB.length > 5 && Math.abs(titleA.length - titleB.length) <= 3) {
        let matches = 0;
        const shorter = titleA.length <= titleB.length ? titleA : titleB;
        const longer = titleA.length > titleB.length ? titleA : titleB;
        for (let ci = 0; ci < shorter.length; ci++) {
          if (shorter[ci] === longer[ci]) matches++;
        }
        if (matches / longer.length >= 0.8) return true;
      }

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
    // Calculate avg track duration from the set's actual data instead of hardcoding 5 min
    const setDuration = setList?.totalDuration || 0;
    const trackCount = setList?.trackCount || tracksWithoutConflicts.length;
    const computedAvg = (setDuration > 0 && trackCount > 1) ? Math.floor(setDuration / trackCount) : 0;
    // Clamp between 150s (2.5 min) and 420s (7 min), default 300 if data is bad
    const avgTrackDuration = (computedAvg >= 150 && computedAvg <= 420) ? computedAvg : 300;
    const minTrackGap = 75; // Tracks < 1.25 min apart are suspicious (likely same track or conflict)
    const gapThreshold = Math.max(avgTrackDuration + 60, 360); // At least one track length + buffer
    let missingCount = 0;
    let gapCounter = 0;

    // Check for gap at the START of the set (before first track)
    if (tracksWithoutConflicts.length > 0) {
      const firstTrackTimestamp = tracksWithoutConflicts[0].timestamp || 0;
      // If first track starts after gapThreshold (6 min), there's likely missing tracks at the start
      if (firstTrackTimestamp >= gapThreshold) {
        const estimatedMissing = Math.max(1, Math.floor(firstTrackTimestamp / avgTrackDuration));
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
          // Subtract avgTrackDuration (previous track is playing during start of gap)
          const estimatedMissing = Math.max(1, Math.floor((gap - avgTrackDuration) / avgTrackDuration));
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

        // Collapse same-artist duplicates: if multiple tracks have the same artist
        // (with fuzzy matching like "M High" / "High" / "M"), keep only the best per artist
        const artistGroups: Track[][] = [];
        for (const t of uniqueTracks) {
          const existingArtistGroup = artistGroups.find(group =>
            group.some(existing => isSameArtist(existing.artist, t.artist))
          );
          if (existingArtistGroup) {
            existingArtistGroup.push(t);
          } else {
            artistGroups.push([t]);
          }
        }
        uniqueTracks = artistGroups.map(group => pickBestTrack(group));

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

          // If top track is better (2+ point gap), just show it — no need for a vote
          if (topScore - runnerUpScore >= 2) {
            items.push({ type: 'track' as const, data: scored[0].track });
          } else {
            // Very close scores — check if tracks are actually different songs
            // Do a final dedup pass: if all "worthy" tracks are really the same song, just pick the best
            const worthyTracks = scored.filter(s => s.score >= 3).map(s => s.track);
            if (worthyTracks.length <= 1) {
              items.push({ type: 'track' as const, data: scored[0].track });
            } else {
              // Final same-song check across all worthy tracks
              const trulyUnique: Track[] = [worthyTracks[0]];
              for (let wi = 1; wi < worthyTracks.length; wi++) {
                const isDup = trulyUnique.some(u => isSameTrack(u, worthyTracks[wi]));
                if (!isDup) trulyUnique.push(worthyTracks[wi]);
              }
              // Cap at 3 options max to avoid overwhelming the voter
              const capped = trulyUnique.slice(0, 3);
              if (capped.length > 1) {
                items.push({
                  type: 'timestamp-conflict' as const,
                  tracks: capped,
                  timestamp: Math.min(...capped.map(t => t.timestamp || 0)),
                });
              } else {
                // All "conflicts" are the same song — pick the highest scored
                items.push({ type: 'track' as const, data: scored[0].track });
              }
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

    // Cap the missing count to something reasonable based on set duration
    // Use totalDuration if available, otherwise estimate from track timestamp range
    let effectiveDuration = setList?.totalDuration || 0;
    if (!effectiveDuration && tracksWithoutConflicts.length > 0) {
      const timestamps = tracksWithoutConflicts.map(t => t.timestamp || 0).filter(t => t > 0);
      if (timestamps.length > 0) {
        // Estimate duration as last timestamp + one avg track length
        effectiveDuration = Math.max(...timestamps) + avgTrackDuration;
      }
    }
    const maxReasonableTracks = effectiveDuration > 0
      ? Math.floor(effectiveDuration / 240)
      : 15; // Conservative default cap
    const knownTrackCount = combined.filter(c => c.type === 'track' || c.type === 'timestamp-conflict').length;
    const cappedMissing = Math.min(missingCount, Math.max(0, maxReasonableTracks - knownTrackCount));

    return { tracklistItems: combined, estimatedMissingTracks: cappedMissing, avgTrackDur: avgTrackDuration };
  }, [sortedTracks, conflicts, isLowQualityTrack]);

  const handleLike = useCallback(() => {
    if (!isAuthenticated) {
      setShowAuthGate(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleLike();
  }, [toggleLike, isAuthenticated]);


  const getHeaderCoverImage = useCallback((): string | null => {
    if (!setList) return null;
    const artistFallback = (!artistImageFailed && setList.artistImageUrl) || null;
    if (coverImageError && coverTriedHqFallback) return artistFallback;
    if (setList.coverUrl) {
      if (coverImageError && setList.coverUrl.includes('maxresdefault')) {
        if (!coverTriedHqFallback) return setList.coverUrl.replace('maxresdefault', 'hqdefault');
        return artistFallback;
      }
      return setList.coverUrl;
    }
    return artistFallback;
  }, [setList, coverImageError, coverTriedHqFallback, artistImageFailed]);

  const handleCoverImageError = useCallback(() => {
    if (!coverTriedHqFallback && setList?.coverUrl?.includes('maxresdefault')) {
      setCoverTriedHqFallback(true);
      setCoverImageError(true);
    } else if (!coverImageError) {
      setCoverTriedHqFallback(true);
      setCoverImageError(true);
    } else {
      // All cover fallbacks exhausted, artist image also failed — show placeholder
      setArtistImageFailed(true);
    }
  }, [coverTriedHqFallback, coverImageError, setList?.coverUrl]);

  // Extract videoId for the floating player (must be before early return to keep hook count stable)
  const playerVideoId = useMemo(() => {
    const links = setList?.sourceLinks || [];
    const ytLink = links.find((l: any) => l.platform === 'youtube');
    if (!ytLink) return null;
    return extractYouTubeId(ytLink.url);
  }, [setList?.sourceLinks]);

  // Show loading / error / not found state
  if (isLoadingSet || !setList) {
    return (
      <View style={styles.loadingContainer}>
        <BubbleGlassLogo size="large" loading={isLoadingSet} />
        {!isLoadingSet && loadError && (
          <View style={{ alignItems: 'center', marginTop: 16, paddingHorizontal: 32 }}>
            <Text style={styles.loadingText}>{loadError}</Text>
            <Pressable
              style={{ marginTop: 12, backgroundColor: 'rgba(196, 30, 58, 0.85)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#C41E3A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 }}
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
                        artistImageUrl: data.set.artistImageUrl || undefined,
                        plays: data.set.trackCount * 10, sourceLinks: data.set.sourceLinks || [],
                        tracks: data.set.tracks?.map((t: any) => ({
                          id: t.id, title: t.title, artist: t.artist, duration: 0, coverUrl: t.coverUrl || '',
                          addedAt: new Date(t.addedAt || Date.now()), source: t.source || 'database',
                          timestamp: t.timestamp || 0, timestampStr: t.timestampStr,
                          verified: t.verified || !t.isId, confidence: t.isId ? 0 : 1, isId: t.isId,
                          isReleased: t.isReleased || false, isUnreleased: t.isUnreleased || false,
                          previewUrl: t.previewUrl || undefined,
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

  const allIdentifiedTracks = [...sortedTracks, ...unplacedTracks];
  const verifiedCount = allIdentifiedTracks.filter(t => t.verified).length;
  const communityCount = allIdentifiedTracks.filter(t => t.source === 'social' || t.source === 'manual').length;

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
    if (!isAuthenticated) { setShowAuthGate(true); return; }
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
              isUnreleased: t.isUnreleased || false,
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


  // Get the source URL and platform for audio preview
  // Prefer the platform the tracklist was built from (timestamps match that source)
  const getAudioSource = (): { url: string; platform: 'youtube' | 'soundcloud' } | null => {
    if (!setList?.sourceLinks?.length) return null;
    const links = setList.sourceLinks || [];
    const ytLink = links.find(l => l.platform === 'youtube');
    const scLink = links.find(l => l.platform === 'soundcloud');

    // Prefer the platform the tracklist was built from (timestamps match that source)
    const primarySource = setList.source;
    if (primarySource === 'soundcloud' && scLink) return { url: scLink.url, platform: 'soundcloud' };
    if (primarySource === 'youtube' && ytLink) return { url: ytLink.url, platform: 'youtube' };

    // Fallback: if primary is 1001tracklists or unknown, prefer YouTube (most common), then SoundCloud
    if (ytLink) return { url: ytLink.url, platform: 'youtube' };
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
        return <ExternalLink size={size} color="rgba(255,255,255,0.5)" />;
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

      <RNAnimated.ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={RNAnimated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.headerImage}>
          {getHeaderCoverImage() ? (
            <Image
              key={setList.coverUrl || 'default-cover'}
              source={{ uri: getHeaderCoverImage()! }}
              style={styles.coverImage}
              cachePolicy="none"
              onError={handleCoverImageError}
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              transition={250}
            />
          ) : (
            <View style={[styles.coverImage, { backgroundColor: Colors.dark.surface }]} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(105,100,95,1)']}
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
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerLogo}>
            <BubbleGlassLogo size="small" />
          </View>
        </View>

        <View style={styles.darkZone}>
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
              <View style={styles.titleActions}>
                <Pressable style={styles.saveButton} onPress={handleLike}>
                  <Heart
                    size={24}
                    color={isLiked ? '#EF4444' : '#FFFFFF'}
                    fill={isLiked ? '#EF4444' : 'none'}
                  />
                </Pressable>
                {audioSource && (
                  <Pressable
                    style={styles.saveButton}
                    onPress={() => {
                      if (!isAuthenticated) { setShowAuthGate(true); return; }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowIdentifyModal(true);
                    }}
                  >
                    <Radio size={22} color="#FFFFFF" />
                  </Pressable>
                )}
              </View>
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
              <Text style={styles.quickStatText}>{sortedTracks.length + unplacedTracks.length} tracks</Text>
              {estimatedMissingTracks > 0 && (
                <Pressable
                  style={styles.missingTracksChip}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Alert.alert(
                      'Missing Tracks',
                      `~${estimatedMissingTracks} track${estimatedMissingTracks !== 1 ? 's' : ''} estimated missing from this set. Drag from unplaced tracks to fill gaps.`
                    );
                  }}
                >
                  <AlertCircle size={11} color="#FB923C" />
                </Pressable>
              )}
            </View>

            {/* Genre Pills */}
            {(artistGenres.length > 0 || setGenre) && (
              <View style={styles.genreRow}>
                {(artistGenres.length > 0 ? artistGenres : [setGenre])
                  .filter(Boolean).slice(0, 4).map((genre) => (
                    <Pressable
                      key={genre}
                      style={styles.genrePill}
                      onPress={() => router.push(`/(tabs)/(discover)/genre/${encodeURIComponent(genre)}`)}
                    >
                      <Text style={styles.genrePillText}>{genre}</Text>
                    </Pressable>
                ))}
              </View>
            )}

            {/* IDentified Matching Progress Banner */}
            {setList.isMatchingInProgress && (
              <View style={styles.matchingBanner}>
                <ActivityIndicator size="small" color="#C41E3A" />
                <View style={styles.matchingBannerContent}>
                  <Text style={styles.matchingBannerTitle}>Identifying tracks...</Text>
                  <Text style={styles.matchingBannerSubtext}>
                    Matching tracks to database
                  </Text>
                </View>
                <Sparkles size={18} color="#C41E3A" />
              </View>
            )}

            {/* Matching Complete Banner */}
            {!setList.isMatchingInProgress && setList.matchingStats && (
              <View style={styles.matchingCompleteBanner}>
                <CheckCircle size={16} color="#22C55E" />
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
                    <AlertCircle size={14} color="#FF6B35" />
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
                    <Sparkles size={14} color="#FB923C" />
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

          {/* Sources section label removed — buttons moved to chart row */}

          {/* Completion chart with source buttons flanking */}
          {(() => {
            const tracksWeHave = sortedTracks.length + unplacedTracks.length;
            const estimatedTotal = tracksWeHave + estimatedMissingTracks;
            const ytLink = (setList.sourceLinks || []).find(l => l.platform === 'youtube');
            const scLink = (setList.sourceLinks || []).find(l => l.platform === 'soundcloud');

            return (
              <RNAnimated.View style={[styles.statsSectionWrap, { transform: [{ scale: chartScale }] }]}>
                <View style={styles.statsSection}>
                  {/* YouTube — left of chart */}
                  <Pressable
                    style={({ pressed }) => [styles.sourceChip, pressed && { transform: [{ scale: 0.92 }], opacity: 0.8 }]}
                    onPress={() => {
                      if (!isAuthenticated) { setShowAuthGate(true); return; }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (ytLink) {
                        handleOpenSource(ytLink);
                      } else {
                        setSelectedPlatform('youtube');
                        setShowSourceModal(true);
                      }
                    }}
                  >
                    <View style={styles.sourceChipShadow} />
                    <View style={[styles.sourceChipFace, ytLink ? { borderColor: 'rgba(255, 0, 0, 0.15)' } : {}]}>
                      <View style={styles.sourceChipShine} />
                      <View style={[styles.sourceChipIcon, { backgroundColor: 'rgba(255, 0, 0, 0.12)' }]}>
                        <Youtube size={14} color="#FF0000" />
                      </View>
                      <Text style={[styles.sourceChipLabel, { color: ytLink ? '#FF4444' : 'rgba(255,255,255,0.4)' }]}>
                        {ytLink ? 'YouTube' : '+ YouTube'}
                      </Text>
                    </View>
                  </Pressable>

                  {/* Chart ring — center */}
                  <IdentificationRing
                    identified={tracksWeHave}
                    total={estimatedTotal}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowChartModal(true);
                      RNAnimated.spring(chartModalAnim, {
                        toValue: 1,
                        damping: 15,
                        stiffness: 150,
                        mass: 0.8,
                        useNativeDriver: true,
                      }).start();
                    }}
                  />

                  {/* SoundCloud — right of chart */}
                  <Pressable
                    style={({ pressed }) => [styles.sourceChip, pressed && { transform: [{ scale: 0.92 }], opacity: 0.8 }]}
                    onPress={() => {
                      if (!isAuthenticated) { setShowAuthGate(true); return; }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (scLink) {
                        handleOpenSource(scLink);
                      } else {
                        setSelectedPlatform('soundcloud');
                        setShowSourceModal(true);
                      }
                    }}
                  >
                    <View style={styles.sourceChipShadow} />
                    <View style={[styles.sourceChipFace, scLink ? { borderColor: 'rgba(255, 85, 0, 0.15)' } : {}]}>
                      <View style={styles.sourceChipShine} />
                      <View style={[styles.sourceChipIcon, { backgroundColor: 'rgba(255, 85, 0, 0.12)' }]}>
                        <Music2 size={14} color="#FF5500" />
                      </View>
                      <Text style={[styles.sourceChipLabel, { color: scLink ? '#FF7733' : 'rgba(255,255,255,0.4)' }]}>
                        {scLink ? 'SoundCloud' : '+ SoundCloud'}
                      </Text>
                    </View>
                  </Pressable>
                </View>

                {/* Gold trakd badge — shown when both sources are linked */}
                {ytLink && scLink && (
                  <View style={styles.trakdBadge}>
                    <Sparkles size={10} color="rgba(255, 210, 70, 0.9)" />
                    <Text style={styles.trakdBadgeText}>trakd</Text>
                  </View>
                )}
              </RNAnimated.View>
            );
          })()}

          {setList.aiProcessed && (setList.commentsScraped || 0) > 0 && (
            <View style={styles.aiInfoBanner}>
              <Sparkles size={14} color="#00D4AA" />
              <Text style={styles.aiInfoText}>
                trakd • {setList.commentsScraped?.toLocaleString()} data points analyzed
              </Text>
            </View>
          )}

          {/* Waveform Timeline */}
          {(setList.totalDuration || 0) > 0 && tracks.length > 0 && (
            <WaveformTimeline
              tracks={tracks}
              totalDuration={setList.totalDuration || 0}
              onGapPress={(timestamp) => {
                if (!isAuthenticated) { setShowAuthGate(true); return; }
                setFillGapTimestamp(timestamp);
                setShowFillGapModal(true);
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

        </View>
        </View>
          {/* Gradient transition dark → cream */}
          <LinearGradient
            colors={['rgba(105,100,95,1)', 'rgba(105,100,95,0.6)', 'rgba(105,100,95,0.2)', Colors.dark.background]}
            locations={[0, 0.3, 0.6, 1]}
            style={styles.darkToCreamGradient}
          />

        <View style={styles.contentBottom}>
          <View style={styles.tracksSection}>
            <View style={styles.tracksSectionHeader}>
              <Text style={styles.sectionTitle}>Tracklist</Text>
              <Pressable
                style={styles.addTrackButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTracklistCollapsed(prev => !prev);
                }}
              >
                {tracklistCollapsed ? (
                  <ChevronDown size={16} color="#C41E3A" />
                ) : (
                  <ChevronUp size={16} color="#C41E3A" />
                )}
                <Text style={styles.addTrackText}>{tracklistCollapsed ? 'Show' : 'Hide'}</Text>
              </Pressable>
            </View>

            {!tracklistCollapsed && tracklistItems.map((item, index) => {
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
                const estimatedTracks = Math.max(1, Math.floor(item.duration / avgTrackDur));
                const isPickMode = !!pickedTrack;

                return (
                  <Pressable
                    key={item.gapId}
                    style={[
                      styles.gapIndicator,
                      isPickMode && styles.gapIndicatorDropTarget,
                    ]}
                    onPress={isPickMode
                      ? () => handlePlaceTrack(item.timestamp)
                      : () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setGapMenuData({ timestamp: item.timestamp, duration: item.duration });
                        }
                    }
                  >
                    <Text style={styles.gapTimestampText}>{formatTime(item.timestamp)}</Text>
                    <View style={[styles.gapLine, isPickMode && styles.gapLineActive]} />
                    <Text style={[styles.gapText, isPickMode && styles.gapTextActive]}>
                      {isPickMode ? 'Place here' : `~${estimatedTracks} missing`}
                    </Text>
                    <View style={[styles.gapLine, isPickMode && styles.gapLineActive]} />
                    {!isPickMode && (
                      <Pressable
                        style={styles.gapAddButton}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setGapMenuData({ timestamp: item.timestamp, duration: item.duration });
                        }}
                        hitSlop={8}
                      >
                        <Plus size={14} color="#C41E3A" />
                      </Pressable>
                    )}
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
                          if (showPlayer) setPlayerMinimized(true);
                          setAudioPreviewTrack(votedTrack);
                        } : undefined}
                        hasPreview={!isUnidentified && !votedTrack.isUnreleased && (!!votedTrack.previewUrl || !!votedTrack.isReleased)}
                        isCurrentlyPlaying={currentTrackId === votedTrack.id && isPlaying}
                        isPreviewLoading={currentTrackId === votedTrack.id && isPreviewLoading}
                        previewFailed={failedTrackId === votedTrack.id}
                        onPlayPreview={!isUnidentified && !votedTrack.isUnreleased && (votedTrack.previewUrl || votedTrack.isReleased) ? () => {
                          if (!isAuthenticated) { setShowAuthGate(true); return; }
                          if (votedTrack.previewUrl) {
                            playPreview(votedTrack.id, votedTrack.previewUrl);
                          } else if (votedTrack.title && votedTrack.artist) {
                            playDeezerPreview(votedTrack.id, votedTrack.artist, votedTrack.title);
                          }
                        } : undefined}
                      />
                      <View style={styles.votedTrackBadge}>
                        <CheckCircle size={10} color="#00D4AA" />
                        <Text style={styles.votedTrackBadgeText}>Your vote • Pending</Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={`ts-conflict-${item.timestamp}`} style={styles.timestampConflict}>
                    <View style={styles.timestampConflictHeader}>
                      <View style={styles.timestampConflictBadge}>
                        <AlertCircle size={10} color="#FB923C" />
                        <Text style={styles.timestampConflictBadgeText}>Which track at {formatTime(item.timestamp)}?</Text>
                      </View>
                    </View>
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
                              {cleanTrackName(track.title) || 'Unknown'}
                            </Text>
                            <Text style={styles.timestampConflictTrackArtist} numberOfLines={1}>
                              {cleanTrackName(track.artist) || 'Unknown Artist'}
                            </Text>
                          </View>
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
                      setSelectedTrack(track);
                      if (track.timestamp !== undefined) {
                        setPendingTimestamp(track.timestamp);
                      }
                    }}
                    onContributorPress={(username) => setSelectedContributor(username)}
                    slim={isUnidentified}
                    hasPreview={!isUnidentified && !track.isUnreleased && (!!track.previewUrl || !!track.isReleased)}
                    isCurrentlyPlaying={currentTrackId === track.id && isPlaying}
                    isPreviewLoading={currentTrackId === track.id && isPreviewLoading}
                    previewFailed={failedTrackId === track.id}
                    onPlayPreview={!isUnidentified && !track.isUnreleased && (track.previewUrl || track.isReleased) ? () => {
                      if (!isAuthenticated) { setShowAuthGate(true); return; }
                      if (track.previewUrl) {
                        playPreview(track.id, track.previewUrl);
                      } else if (track.title && track.artist) {
                        playDeezerPreview(track.id, track.artist, track.title);
                      }
                    } : undefined}
                  />
                );
              }

              return null;
            })}
            
            {!tracklistCollapsed && tracklistItems.length === 0 && unplacedTracks.length === 0 && (
              <View style={styles.emptyTracks}>
                <Sparkles size={32} color="#9C968E" />
                <Text style={styles.emptyText}>No tracks identified yet</Text>
                <Text style={styles.emptySubtext}>
                  Be the first to contribute! Add a track you recognize.
                </Text>
                <Pressable
                  style={styles.emptyAddButton}
                  onPress={() => { if (!isAuthenticated) { setShowAuthGate(true); return; } setShowAddModal(true); }}
                >
                  <Plus size={16} color="#FFF" />
                  <Text style={styles.emptyAddButtonText}>Add First Track</Text>
                </Pressable>
              </View>
            )}

            {!tracklistCollapsed && (tracklistItems.length > 0 || unplacedTracks.length > 0) && (
              <View style={styles.missingTrackCta}>
                <Text style={styles.missingTrackText}>Know a track we missed?</Text>
                <Pressable
                  style={styles.contributeButton}
                  onPress={() => {
                    if (!isAuthenticated) { setShowAuthGate(true); return; }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowAddModal(true);
                  }}
                >
                  <Text style={styles.contributeButtonText}>Contribute</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Unplaced Tracks Section - always visible outside tracklist fold */}
          {unplacedTracks.length > 0 && (
            <View style={styles.unplacedSection}>
              <View style={styles.unplacedHeader}>
                <View style={styles.unplacedTitleRow}>
                  <ListMusic size={16} color="#6B6560" />
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
                const isUnidentified = track.isId || track.title?.toLowerCase() === 'id';
                return (
                  <View key={track.id} style={isPicked ? styles.unplacedTrackCardPicked : undefined}>
                    <TrackCard
                      track={track}
                      showIndex={index + 1}
                      onPress={() => {
                        if (isPicked) {
                          setPickedTrack(null);
                        } else if (estimatedMissingTracks > 0) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setPickedTrack(track);
                          if (tracklistCollapsed) {
                            setTracklistCollapsed(false);
                          }
                        } else {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedTrack(track);
                        }
                      }}
                      hasPreview={!isUnidentified && !track.isUnreleased && (!!track.previewUrl || !!track.isReleased)}
                      isCurrentlyPlaying={currentTrackId === track.id && isPlaying}
                      isPreviewLoading={currentTrackId === track.id && isPreviewLoading}
                      previewFailed={failedTrackId === track.id}
                      onPlayPreview={!isUnidentified && !track.isUnreleased && (track.previewUrl || track.isReleased) ? () => {
                        if (!isAuthenticated) { setShowAuthGate(true); return; }
                        if (track.previewUrl) {
                          playPreview(track.id, track.previewUrl);
                        } else if (track.title && track.artist) {
                          playDeezerPreview(track.id, track.artist, track.title);
                        }
                      } : undefined}
                      onContributorPress={(username) => setSelectedContributor(username)}
                    />
                    {isPicked && (
                      <View style={styles.pickedBadge}>
                        <Text style={styles.pickedBadgeText}>Selected</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Comments Section */}
          {/* Similar Sets */}
          {id && <SimilarSets setId={id} />}

          {id && <CommentsSection setId={id} />}
        </View>
      </RNAnimated.ScrollView>

      {/* Floating YouTube/SoundCloud Player */}
      {showPlayer && playerVideoId && (
        <View style={styles.floatingPlayer}>
          <YouTubePlayer
            videoId={playerVideoId}
            initialTimestamp={currentTimestamp}
            onTimestampChange={setCurrentTimestamp}
            onClose={() => setShowPlayer(false)}
            minimized={playerMinimized}
            onToggleMinimize={() => setPlayerMinimized(!playerMinimized)}
          />
        </View>
      )}

      {/* Floating Audio Preview for track identification */}
      {audioPreviewTrack && (
        <View style={styles.floatingAudioPreview}>
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
      )}

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

      {/* Chart Detail Modal */}
      <Modal
        visible={showChartModal}
        transparent
        animationType="none"
        onRequestClose={() => {
          RNAnimated.timing(chartModalAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
            setShowChartModal(false);
          });
        }}
      >
        <Pressable
          style={styles.chartModalOverlay}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            RNAnimated.timing(chartModalAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
              setShowChartModal(false);
            });
          }}
        >
          <RNAnimated.View
            style={[
              styles.chartModalCard,
              {
                opacity: chartModalAnim,
                transform: [{
                  scale: chartModalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                }],
              },
            ]}
          >
            {/* Big ring at the top */}
            <View style={styles.chartModalRing}>
              <IdentificationRing
                identified={sortedTracks.length + unplacedTracks.length}
                total={sortedTracks.length + unplacedTracks.length + estimatedMissingTracks}
              />
            </View>

            <Text style={styles.chartModalTitle}>
              {Math.round(((sortedTracks.length + unplacedTracks.length) / Math.max(sortedTracks.length + unplacedTracks.length + estimatedMissingTracks, 1)) * 100)}% Identified
            </Text>
            <Text style={styles.chartModalSubtitle}>
              {sortedTracks.length + unplacedTracks.length} of ~{sortedTracks.length + unplacedTracks.length + estimatedMissingTracks} estimated tracks
            </Text>

            <View style={styles.chartModalDivider} />

            {analyzing ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <GlassProgressBar isActive={analyzing} />
              </View>
            ) : (<>
            <View style={styles.chartModalBadges}>
              {/* Trakd Badge */}
              <Pressable
                style={styles.chartBadge3d}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setBadgeExplain({ type: 'trakd', count: setList.tracksIdentified || (sortedTracks.length + unplacedTracks.length) });
                  badgeExplainAnim.setValue(0);
                  RNAnimated.spring(badgeExplainAnim, { toValue: 1, damping: 14, stiffness: 160, mass: 0.7, useNativeDriver: true }).start();
                }}
              >
                <View style={styles.chartBadge3dShadow} />
                <View style={[styles.chartBadge3dFace, { borderColor: 'rgba(0, 212, 170, 0.3)' }]}>
                  <View style={styles.chartBadge3dShine} />
                  <View style={[styles.chartBadge3dIcon, { backgroundColor: 'rgba(0, 212, 170, 0.2)' }]}>
                    <Sparkles size={14} color="#00D4AA" />
                  </View>
                  <Text style={styles.chartBadge3dValue}>{setList.tracksIdentified || (sortedTracks.length + unplacedTracks.length)}</Text>
                  <Text style={[styles.chartBadge3dLabel, { color: '#00D4AA' }]}>trakd</Text>
                </View>
              </Pressable>

              {/* Verified Badge */}
              <Pressable
                style={styles.chartBadge3d}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setBadgeExplain({ type: 'verified', count: verifiedCount });
                  badgeExplainAnim.setValue(0);
                  RNAnimated.spring(badgeExplainAnim, { toValue: 1, damping: 14, stiffness: 160, mass: 0.7, useNativeDriver: true }).start();
                }}
              >
                <View style={styles.chartBadge3dShadow} />
                <View style={[styles.chartBadge3dFace, { borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
                  <View style={styles.chartBadge3dShine} />
                  <View style={[styles.chartBadge3dIcon, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                    <CheckCircle size={14} color="#22C55E" />
                  </View>
                  <Text style={styles.chartBadge3dValue}>{verifiedCount}</Text>
                  <Text style={[styles.chartBadge3dLabel, { color: '#22C55E' }]}>verified</Text>
                </View>
              </Pressable>

              {/* Community Badge */}
              <Pressable
                style={styles.chartBadge3d}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setBadgeExplain({ type: 'community', count: communityCount });
                  badgeExplainAnim.setValue(0);
                  RNAnimated.spring(badgeExplainAnim, { toValue: 1, damping: 14, stiffness: 160, mass: 0.7, useNativeDriver: true }).start();
                }}
              >
                <View style={styles.chartBadge3dShadow} />
                <View style={[styles.chartBadge3dFace, { borderColor: 'rgba(139, 92, 246, 0.3)' }]}>
                  <View style={styles.chartBadge3dShine} />
                  <View style={[styles.chartBadge3dIcon, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                    <Users size={14} color="#8B5CF6" />
                  </View>
                  <Text style={styles.chartBadge3dValue}>{communityCount}</Text>
                  <Text style={[styles.chartBadge3dLabel, { color: '#8B5CF6' }]}>community</Text>
                </View>
              </Pressable>
            </View>

            {estimatedMissingTracks > 0 && (
              <Pressable
                style={styles.chartModalMissing}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setBadgeExplain({ type: 'missing', count: estimatedMissingTracks });
                  badgeExplainAnim.setValue(0);
                  RNAnimated.spring(badgeExplainAnim, { toValue: 1, damping: 14, stiffness: 160, mass: 0.7, useNativeDriver: true }).start();
                }}
              >
                <AlertCircle size={12} color="#FB923C" />
                <Text style={styles.chartModalMissingText}>~{estimatedMissingTracks} estimated missing</Text>
              </Pressable>
            )}

            {/* Reanalyze button */}
            {(() => {
              const ytLink = (setList.sourceLinks || []).find(l => l.platform === 'youtube');
              const scLink = (setList.sourceLinks || []).find(l => l.platform === 'soundcloud');
              const analyzeLink = ytLink || scLink;
              if (!analyzeLink) return null;
              const analyzeSource = ytLink ? 'youtube' : 'soundcloud';
              return (
                <Pressable
                  style={styles.chartModalReanalyze}
                  disabled={analyzing}
                  onPress={async () => {
                    if (!isAuthenticated) { setShowAuthGate(true); return; }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    try {
                      setAnalyzing(true);
                      const importResponse = await fetch(`${API_BASE_URL}/api/import`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: analyzeLink.url }),
                      });
                      const importResult = await importResponse.json();
                      if (!importResponse.ok) throw new Error(importResult.error || `Server error (${importResponse.status})`);

                      // Close chart modal FIRST to avoid stacked modals
                      RNAnimated.timing(chartModalAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
                        setShowChartModal(false);
                      });

                      if (importResult.success && importResult.setList?.tracks?.length > 0) {
                        const updateResponse = await fetch(`${API_BASE_URL}/api/sets/update-tracks`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            setId: setList.id,
                            tracks: importResult.setList.tracks,
                            source: analyzeSource,
                            coverUrl: importResult.setList.coverUrl,
                          }),
                        });
                        // Read the breakdown from update-tracks
                        let updateData: any = {};
                        try {
                          updateData = await updateResponse.json();
                        } catch {}
                        if (!updateResponse.ok) {
                          console.warn('[Reanalyze] update-tracks error:', updateData);
                        }

                        fetch(`${API_BASE_URL}/api/spotify-enrich`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'enrich-set', setId: setList.id }),
                        }).catch(() => {});
                        const refreshResponse = await fetch(`${API_BASE_URL}/api/sets/${setList.id}`);
                        const refreshData = await refreshResponse.json();
                        if (refreshData.success && refreshData.set) {
                          const refreshedSet = transformApiSet(refreshData.set);
                          const currentTrackCount = setList.tracks?.length || 0;
                          const newTrackCount = refreshedSet.tracks?.length || 0;
                          // GUARD: never accept fewer tracks — sources are additive
                          if (newTrackCount >= currentTrackCount) {
                            setDbSet(refreshedSet);
                          }
                        }

                        // Build breakdown message from update-tracks response
                        const timestamped = updateData.updatedCount || 0;
                        const verified = updateData.confirmedCount || 0;
                        const added = updateData.newTracksAdded || 0;
                        const errors = updateData.errorCount || 0;
                        const parts: string[] = [];
                        if (timestamped > 0) parts.push(`${timestamped} timestamped`);
                        if (verified > 0) parts.push(`${verified} verified`);
                        if (added > 0) parts.push(`${added} new`);
                        if (errors > 0) parts.push(`${errors} failed`);
                        const resultType = errors > 0 ? 'error' : (timestamped > 0 || added > 0) ? 'success' : (verified > 0 ? 'success' : 'empty');
                        const msg = parts.length > 0
                          ? parts.join(', ')
                          : 'No changes made';

                        // Show result popup after chart modal is gone
                        setTimeout(() => {
                          Haptics.notificationAsync(
                            resultType === 'success'
                              ? Haptics.NotificationFeedbackType.Success
                              : Haptics.NotificationFeedbackType.Warning
                          );
                          analyzePopupScale.value = 0;
                          analyzePopupOpacity.value = 0;
                          setAnalyzeResult({ type: resultType as any, message: msg, trackCount: timestamped + added });
                          analyzePopupScale.value = withSpring(1, { damping: 12, stiffness: 150 });
                          analyzePopupOpacity.value = withTiming(1, { duration: 200 });
                        }, 250);
                      } else {
                        setTimeout(() => {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          analyzePopupScale.value = 0;
                          analyzePopupOpacity.value = 0;
                          setAnalyzeResult({ type: 'empty', message: 'No tracks found in comments or description' });
                          analyzePopupScale.value = withSpring(1, { damping: 14, stiffness: 120 });
                          analyzePopupOpacity.value = withTiming(1, { duration: 200 });
                        }, 250);
                      }
                    } catch (error: any) {
                      // Close chart modal first if still open
                      setShowChartModal(false);
                      setTimeout(() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        analyzePopupScale.value = 0;
                        analyzePopupOpacity.value = 0;
                        setAnalyzeResult({ type: 'error', message: error.message || 'Failed to analyze' });
                        analyzePopupScale.value = withSpring(1, { damping: 14, stiffness: 120 });
                        analyzePopupOpacity.value = withTiming(1, { duration: 200 });
                      }, 250);
                    } finally {
                      setAnalyzing(false);
                    }
                  }}
                >
                  <Sparkles size={14} color="#C41E3A" />
                  <Text style={styles.chartModalReanalyzeText}>{analyzing ? 'Reanalyzing...' : 'Reanalyze Set'}</Text>
                </Pressable>
              );
            })()}
            </>)}

            {/* Badge explanation overlay */}
            {badgeExplain && (
              <RNAnimated.View
                style={[
                  styles.badgeExplainCard,
                  {
                    opacity: badgeExplainAnim,
                    transform: [{
                      scale: badgeExplainAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
                    }],
                  },
                ]}
              >
                <View style={[
                  styles.badgeExplainIcon,
                  {
                    backgroundColor: badgeExplain.type === 'trakd' ? 'rgba(0,212,170,0.15)'
                      : badgeExplain.type === 'verified' ? 'rgba(34,197,94,0.15)'
                      : badgeExplain.type === 'community' ? 'rgba(139,92,246,0.15)'
                      : 'rgba(251,146,60,0.15)',
                  },
                ]}>
                  {badgeExplain.type === 'trakd' && <Sparkles size={20} color="#00D4AA" />}
                  {badgeExplain.type === 'verified' && <CheckCircle size={20} color="#22C55E" />}
                  {badgeExplain.type === 'community' && <Users size={20} color="#8B5CF6" />}
                  {badgeExplain.type === 'missing' && <AlertCircle size={20} color="#FB923C" />}
                </View>
                <Text style={[
                  styles.badgeExplainTitle,
                  {
                    color: badgeExplain.type === 'trakd' ? '#00D4AA'
                      : badgeExplain.type === 'verified' ? '#22C55E'
                      : badgeExplain.type === 'community' ? '#8B5CF6'
                      : '#FB923C',
                  },
                ]}>
                  {badgeExplain.type === 'trakd' ? 'Trakd' : badgeExplain.type === 'verified' ? 'Verified' : badgeExplain.type === 'community' ? 'Community' : 'Est. Missing'}
                </Text>
                <Text style={styles.badgeExplainDesc}>
                  {badgeExplain.type === 'trakd' ? 'Total tracks identified in this set by all sources — AI, community, and database matches.'
                    : badgeExplain.type === 'verified' ? 'Tracks confirmed by multiple sources or manually verified. High confidence these are correct.'
                    : badgeExplain.type === 'community' ? 'Tracks contributed by users — submitted via comments, social shares, or manual additions.'
                    : 'Based on gaps in the tracklist, we estimate there are tracks not yet identified. Help fill them in!'}
                </Text>
                <Pressable
                  style={styles.badgeExplainClose}
                  onPress={() => {
                    RNAnimated.timing(badgeExplainAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
                      setBadgeExplain(null);
                    });
                  }}
                >
                  <Text style={styles.badgeExplainCloseText}>Got it</Text>
                </Pressable>
              </RNAnimated.View>
            )}
          </RNAnimated.View>
        </Pressable>
      </Modal>

      {/* Gap Menu — tapping a gap shows frosted glass track cards for each missing slot */}
      {gapMenuData !== null && (
        <Modal
          visible={true}
          animationType="slide"
          transparent
          onRequestClose={() => setGapMenuData(null)}
        >
          <Pressable style={styles.gapMenuOverlay} onPress={() => setGapMenuData(null)}>
            <View style={styles.gapMenuContent} onStartShouldSetResponder={() => true}>
              <View style={styles.gapMenuHeader}>
                <Text style={styles.gapMenuTitle}>
                  ~{Math.max(1, Math.round(gapMenuData.duration / avgTrackDur))} Missing Track{Math.max(1, Math.round(gapMenuData.duration / avgTrackDur)) !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.gapMenuSubtitle}>
                  {(() => { const m1 = Math.floor(gapMenuData.timestamp / 60); const s1 = Math.floor(gapMenuData.timestamp % 60); const end = gapMenuData.timestamp + gapMenuData.duration; const m2 = Math.floor(end / 60); const s2 = Math.floor(end % 60); return `${m1}:${s1.toString().padStart(2, '0')} — ${m2}:${s2.toString().padStart(2, '0')}`; })()}
                </Text>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {Array.from({ length: Math.max(1, Math.round(gapMenuData.duration / avgTrackDur)) }, (_, i) => {
                  const ts = Math.floor(gapMenuData.timestamp + (i * gapMenuData.duration) / Math.max(1, Math.round(gapMenuData.duration / avgTrackDur)));
                  const m = Math.floor(ts / 60);
                  const s = Math.floor(ts % 60);
                  const timeStr = `${m}:${s.toString().padStart(2, '0')}`;
                  return (
                    <View key={`gap-slot-${i}`} style={styles.gapCard}>
                      <View style={styles.gapCardInner}>
                        <View style={styles.gapCardCover}>
                          <HelpCircle size={20} color="rgba(255,255,255,0.2)" />
                        </View>
                        <View style={styles.gapCardInfo}>
                          <Text style={styles.gapCardTitle}>Unknown Track</Text>
                          <View style={styles.gapCardTimestamp}>
                            <Clock size={10} color="#C41E3A" />
                            <Text style={styles.gapCardTime}>{timeStr}</Text>
                          </View>
                        </View>
                        {audioSource && (
                          <Pressable
                            style={styles.gapCardPlayBtn}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              setGapMenuData(null);
                              if (audioSource.platform === 'youtube' && playerVideoId) {
                                // Use floating YouTube player at this timestamp
                                setCurrentTimestamp(ts);
                                setShowPlayer(true);
                                setPlayerMinimized(false);
                              } else {
                                // SoundCloud or no video: open audio preview overlay
                                setAudioPreviewTrack({
                                  id: `gap-${ts}`,
                                  title: 'ID',
                                  artist: 'ID',
                                  duration: 0,
                                  coverUrl: '',
                                  addedAt: new Date(),
                                  source: 'manual',
                                  timestamp: ts,
                                  verified: false,
                                  confidence: 0,
                                  isId: true,
                                } as Track);
                              }
                            }}
                          >
                            <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                          </Pressable>
                        )}
                        <Pressable
                          style={styles.gapCardIdBtn}
                          onPress={() => {
                            if (!isAuthenticated) { setShowAuthGate(true); return; }
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setGapMenuData(null);
                            setFillGapTimestamp(ts);
                            setShowFillGapModal(true);
                          }}
                        >
                          <Plus size={12} color="#C41E3A" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}

      <ContributorModal
        visible={selectedContributor !== null}
        username={selectedContributor || ''}
        onClose={() => setSelectedContributor(null)}
      />

      {/* Analyze Result Popup */}
      {analyzeResult && (
        <Modal
          visible={true}
          transparent
          animationType="none"
          onRequestClose={() => {
            analyzePopupScale.value = withTiming(0, { duration: 150 });
            analyzePopupOpacity.value = withTiming(0, { duration: 150 });
            setTimeout(() => setAnalyzeResult(null), 160);
          }}
        >
          <Pressable
            style={styles.analyzePopupOverlay}
            onPress={() => {
              analyzePopupScale.value = withTiming(0, { duration: 150 });
              analyzePopupOpacity.value = withTiming(0, { duration: 150 });
              setTimeout(() => setAnalyzeResult(null), 160);
            }}
          >
            <Animated.View
              style={[
                styles.analyzePopupContainer,
                analyzeResult.type === 'success' && styles.analyzePopupSuccess,
                analyzeResult.type === 'empty' && styles.analyzePopupEmpty,
                analyzeResult.type === 'error' && styles.analyzePopupError,
                analyzePopupStyle,
              ]}
            >
              {analyzeResult.type === 'success' ? (
                <>
                  <Animated.View
                    style={[
                      styles.analyzePopupIconRing,
                      { borderColor: 'rgba(196, 30, 58, 0.4)' },
                      analyzePopupIconStyle,
                    ]}
                  >
                    <Sparkles size={28} color="#C41E3A" />
                  </Animated.View>
                  <Text style={styles.analyzePopupTitle}>Analysis Complete</Text>
                  <Text style={styles.analyzePopupMessage}>{analyzeResult.message}</Text>
                </>
              ) : analyzeResult.type === 'empty' ? (
                <>
                  <View style={[styles.analyzePopupIconRing, { borderColor: 'rgba(156, 150, 142, 0.3)' }]}>
                    <ListMusic size={28} color="#9C968E" />
                  </View>
                  <Text style={styles.analyzePopupTitle}>No Changes</Text>
                  <Text style={styles.analyzePopupMessage}>{analyzeResult.message || 'No new tracks could be identified from this source'}</Text>
                </>
              ) : (
                <>
                  <View style={[styles.analyzePopupIconRing, { borderColor: 'rgba(255, 107, 53, 0.3)' }]}>
                    <AlertCircle size={28} color="#FF6B35" />
                  </View>
                  <Text style={styles.analyzePopupTitle}>Analysis Failed</Text>
                  <Text style={styles.analyzePopupMessage}>{analyzeResult.message}</Text>
                </>
              )}
              <Pressable
                style={styles.analyzePopupDismiss}
                onPress={() => {
                  analyzePopupScale.value = withTiming(0, { duration: 150 });
                  analyzePopupOpacity.value = withTiming(0, { duration: 150 });
                  setTimeout(() => setAnalyzeResult(null), 160);
                }}
              >
                <Text style={styles.analyzePopupDismissText}>OK</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      )}

      <AddSourceModal
        visible={showSourceModal}
        platform={selectedPlatform}
        setName={setList?.name || 'this set'}
        setArtist={setList?.artist}
        onClose={() => setShowSourceModal(false)}
        onImport={async (url) => {
          if (!setList) return { success: false, error: 'Set not found' };

          // For database sets, save the source URL first, then try analysis
          if (dbSet) {
            // Update local state IMMEDIATELY so UI reflects the source no matter what
            setDbSet(prev => prev ? {
              ...prev,
              sourceLinks: [...(prev.sourceLinks || []).filter(l => l.platform !== selectedPlatform), { platform: selectedPlatform, url }],
            } : prev);

            let importStats = { matched: 0, newFromSecondary: 0, commentsScraped: 0 };

            // Save the source URL to the database (don't let errors block the flow)
            try {
              await fetch(`${API_BASE_URL}/api/sets/add-source`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setId: setList.id, url, platform: selectedPlatform }),
              });
            } catch (e: any) {
              if (__DEV__) console.warn('[AddSource] Save failed:', e.message);
            }

            // Try to scrape/analyze the URL for track IDs
            try {
              const importResponse = await fetch(`${API_BASE_URL}/api/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
              });

              if (importResponse.ok) {
                const importResult = await importResponse.json();

                if (importResult.success) {
                  const scrapedTracks = importResult.setList?.tracks || [];
                  if (scrapedTracks.length > 0) {
                    await fetch(`${API_BASE_URL}/api/sets/update-tracks`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        setId: setList.id,
                        tracks: scrapedTracks,
                        source: selectedPlatform,
                        coverUrl: importResult.setList?.coverUrl,
                      }),
                    });
                  }

                  if (importResult.setList?.coverUrl) {
                    setDbSet(prev => prev ? { ...prev, coverUrl: importResult.setList.coverUrl } : prev);
                  }

                  importStats = {
                    matched: importResult.tracksCount || 0,
                    newFromSecondary: scrapedTracks.length,
                    commentsScraped: importResult.commentsCount || 0,
                  };

                }
              }
            } catch (importError: any) {
              if (__DEV__) console.warn('[AddSource] Import/analysis failed:', importError.message);
            }

            // Refresh set data from the API — GUARD: never accept fewer tracks
            try {
              const refreshResponse = await fetch(`${API_BASE_URL}/api/sets/${setList.id}`);
              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                if (refreshData.success && refreshData.set) {
                  const refreshedSet = transformApiSet(refreshData.set);
                  const currentTrackCount = setList.tracks?.length || 0;
                  const newTrackCount = refreshedSet.tracks?.length || 0;
                  if (newTrackCount >= currentTrackCount) {
                    setDbSet(refreshedSet);
                  } else if (__DEV__) {
                    console.warn(`[AddSource] Refresh returned fewer tracks (${newTrackCount} vs ${currentTrackCount}), keeping current data`);
                  }
                }
              }
            } catch (e: any) {
              if (__DEV__) console.warn('[AddSource] Refresh failed:', e.message);
            }

            // Trigger Spotify enrichment via the auto-enrich flow so it re-fetches
            // the set after completing and shows album art / verified badges in real-time
            setNeedsEnrichment(true);

            try { await addPoints('source_added', setList.id); } catch (e) {}

            return { success: true, stats: importStats };
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
            if (audioSource?.platform === 'youtube' && playerVideoId) {
              if (showPlayer) {
                // Seek existing player to timestamp
                setCurrentTimestamp(pendingTimestamp);
                if (playerMinimized) setPlayerMinimized(false);
              } else {
                // Start the floating YouTube player at the timestamp
                setCurrentTimestamp(pendingTimestamp);
                setShowPlayer(true);
                setPlayerMinimized(false);
              }
            } else if (audioSource && selectedTrack) {
              // SoundCloud: open audio preview overlay at this timestamp
              setAudioPreviewTrack({ ...selectedTrack, timestamp: pendingTimestamp });
            }
          }
          setPendingTimestamp(null);
        }}
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

      <IdentifyTrackModal
        visible={showIdentifyModal}
        onClose={() => setShowIdentifyModal(false)}
        onIdentified={(track, timestamp) => {
          // Optionally auto-add to tracklist
          setShowIdentifyModal(false);
        }}
        setTitle={setList?.name}
        setId={id || undefined}
        audioUrl={audioSource?.url}
      />
      <AuthGateModal
        visible={showAuthGate}
        onClose={() => setShowAuthGate(false)}
        title="Sign up to continue"
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
  floatingPlayer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  floatingAudioPreview: {
    position: 'absolute',
    top: 60,
    left: 8,
    right: 8,
    zIndex: 20,
  },
  headerImage: {
    height: 420,
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
    height: 300,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(10, 10, 10, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderTopColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  headerLogo: {
    position: 'absolute',
    top: 64,
    right: 20,
  },
  darkZone: {
    backgroundColor: 'rgba(105,100,95,1)',
  },
  darkToCreamGradient: {
    height: 100,
    marginTop: -1,
    marginBottom: -50,
  },
  content: {
    paddingHorizontal: 20,
    marginTop: -240,
  },
  contentBottom: {
    paddingHorizontal: 20,
  },
  titleSection: {
    marginBottom: 14,
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
    color: '#00D4AA',
  },
  artistSeparator: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: '#00D4AA',
    opacity: 0.4,
    marginHorizontal: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    lineHeight: 30,
  },
  titleActions: {
    alignItems: 'center',
    gap: 10,
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(10, 10, 10, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderTopColor: 'rgba(255,255,255,0.18)',
    shadowOpacity: 0,
    elevation: 0,
  },
  venue: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
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
    color: 'rgba(255,255,255,0.45)',
  },
  quickStatDot: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginHorizontal: 8,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  genrePill: {
    backgroundColor: 'rgba(10, 10, 10, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  genrePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  linksSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#9C968E',
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
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderTopColor: 'rgba(255,255,255,0.25)',
    borderBottomColor: 'rgba(0,0,0,0.15)',
  },
  linkCardFilled: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  linkCardEmpty: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
  },
  linkIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(240, 235, 227, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkIconEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  linkPlatform: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.85)',
  },
  linkPlatformEmpty: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#9C968E',
  },
  linkLabel: {
    fontSize: 12,
    color: '#6B6560',
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
    backgroundColor: 'rgba(255, 0, 0, 0.75)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
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
    color: '#FB923C',
    fontWeight: '600',
    textAlign: 'center',
  },
  statsSectionWrap: {
    marginBottom: 6,
    alignItems: 'center',
  },
  statsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  sourceChip: {
    flex: 1,
    alignItems: 'center',
  },
  sourceChipShadow: {
    position: 'absolute',
    bottom: -2,
    left: 4,
    right: 4,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sourceChipFace: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderBottomColor: 'rgba(0,0,0,0.15)',
    overflow: 'hidden',
  },
  sourceChipShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  sourceChipIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sourceChipLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  trakdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 200, 50, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 50, 0.2)',
    borderTopColor: 'rgba(255, 215, 80, 0.3)',
    borderBottomColor: 'rgba(180, 140, 20, 0.15)',
    alignSelf: 'center',
  },
  trakdBadgeText: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: 'rgba(255, 210, 70, 0.85)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statsBadgeColumn: {
    gap: 4,
  },
  statBadgeMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
  statBadgeMiniIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBadgeMiniValue: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.85)',
  },
  statBadgeMiniLabel: {
    fontSize: 7,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statsPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF0000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  missingTracksChip: {
    marginLeft: 4,
    padding: 2,
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
  missingTracksInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  missingTracksInlineText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#FB923C',
  },
  missingTracksHint: {
    fontSize: 11,
    color: '#9C968E',
  },
  // Timestamp conflict styles — compact inline vote
  timestampConflict: {
    backgroundColor: 'rgba(251, 146, 60, 0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.15)',
  },
  timestampConflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  timestampConflictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timestampConflictBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FB923C',
  },
  timestampConflictTime: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.45)',
    fontVariant: ['tabular-nums'] as any,
  },
  timestampConflictSubtext: {
    fontSize: 11,
    color: '#9C968E',
    marginBottom: 12,
    lineHeight: 16,
  },
  timestampConflictOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginBottom: 4,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  timestampConflictVoteBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.3)',
  },
  timestampConflictVoteBtnText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FB923C',
  },
  timestampConflictTrackInfo: {
    flex: 1,
  },
  timestampConflictTrackTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#2D2A26',
  },
  timestampConflictTrackArtist: {
    fontSize: 11,
    color: '#6B6560',
  },
  timestampConflictTrackTime: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#9C968E',
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
    color: '#00D4AA',
  },
  aiInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 170, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.2)',
  },
  playInAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 10, 0.55)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  playInAppIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  playInAppInfo: {
    flex: 1,
  },
  playInAppTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playInAppSubtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  aiInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#6B6560',
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
    color: '#2D2A26',
  },
  addTrackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    borderTopColor: 'rgba(255,255,255,1)',
    borderBottomColor: 'rgba(232,226,217,0.6)',
    shadowColor: 'rgba(45, 42, 38, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  addTrackText: {
    fontSize: 13,
    color: '#C41E3A',
    fontWeight: '500' as const,
  },
  emptyTracks: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    borderTopColor: 'rgba(255,255,255,1)',
    borderBottomColor: 'rgba(232,226,217,0.6)',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#2D2A26',
    marginTop: 16,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9C968E',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 212, 170, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyAddButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  gapIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginBottom: 2,
    gap: 6,
  },
  gapTimestampText: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: 'rgba(255, 107, 53, 0.6)',
    fontVariant: ['tabular-nums'],
  },
  gapLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
  },
  gapText: {
    fontSize: 9,
    color: 'rgba(255, 107, 53, 0.5)',
    fontWeight: '500' as const,
  },
  gapIndicatorDropTarget: {
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    borderWidth: 1,
    borderColor: '#FF6B35',
    borderStyle: 'dashed',
    borderRadius: 6,
    minHeight: 36,
  },
  gapLineActive: {
    backgroundColor: '#C41E3A',
    height: 2,
  },
  gapTextActive: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#C41E3A',
  },
  gapAddButton: {
    padding: 2,
  },
  unplacedIdsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    borderTopColor: 'rgba(255,255,255,1)',
    borderBottomColor: 'rgba(232,226,217,0.5)',
  },
  unplacedIdsText: {
    flex: 1,
    fontSize: 12,
    color: '#9C968E',
  },
  unplacedSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E8E2D9',
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
    color: '#6B6560',
  },
  unplacedSubtitle: {
    fontSize: 12,
    color: '#9C968E',
  },
  missingTrackCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    borderTopColor: 'rgba(255,255,255,1)',
    borderBottomColor: 'rgba(232,226,217,0.6)',
    shadowColor: 'rgba(45, 42, 38, 0.1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  missingTrackText: {
    fontSize: 14,
    color: '#6B6560',
  },
  contributeButton: {
    backgroundColor: 'rgba(196, 30, 58, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.2)',
  },
  contributeButtonText: {
    fontSize: 13,
    color: '#C41E3A',
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
    color: '#FF6B35',
  },
  matchingBannerSubtext: {
    fontSize: 12,
    color: '#6B6560',
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
    color: '#22C55E',
  },
  matchingUnreleasedText: {
    color: '#C41E3A',
  },
  // Needs Source Banner styles
  needsSourceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
  },
  needsSourceIconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  needsSourceContent: {
    flex: 1,
  },
  needsSourceTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FF6B35',
    marginBottom: 1,
  },
  needsSourceText: {
    fontSize: 9.5,
    color: '#6B6560',
    lineHeight: 13,
  },
  // Pick-and-place styles
  unplacedTrackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    borderTopColor: 'rgba(255,255,255,0.95)',
    borderBottomColor: 'rgba(232,226,217,0.5)',
    shadowColor: 'rgba(45, 42, 38, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  unplacedTrackCardPicked: {
    borderRadius: 14,
    borderColor: 'rgba(0, 212, 170, 0.5)',
    borderWidth: 2,
    backgroundColor: 'rgba(0, 212, 170, 0.06)',
    marginBottom: 8,
  },
  unplacedTrackIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(240, 235, 227, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  unplacedTrackIndexText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#9C968E',
  },
  unplacedTrackInfo: {
    flex: 1,
  },
  unplacedTrackTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#2D2A26',
    marginBottom: 2,
  },
  unplacedTrackArtist: {
    fontSize: 11,
    color: '#6B6560',
  },
  pickedBadge: {
    backgroundColor: 'rgba(0, 212, 170, 0.8)',
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
    backgroundColor: 'rgba(10, 10, 10, 0.75)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.3)',
    borderTopColor: 'rgba(255,255,255,0.15)',
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
  // Gap menu modal
  gapMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  gapMenuContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  gapMenuHeader: {
    marginBottom: 16,
  },
  gapMenuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gapMenuSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
    fontVariant: ['tabular-nums'] as any,
  },
  gapCard: {
    marginBottom: 10,
  },
  gapCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  gapCardCover: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapCardInfo: {
    flex: 1,
  },
  gapCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.3)',
    fontStyle: 'italic',
  },
  gapCardTimestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  gapCardTime: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C41E3A',
    fontVariant: ['tabular-nums'] as any,
  },
  gapCardPlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#C41E3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapCardIdBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(196, 30, 58, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartModalCard: {
    width: 260,
    backgroundColor: 'rgba(30, 30, 34, 0.95)',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#C41E3A',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  chartModalRing: {
    marginBottom: 16,
    transform: [{ scale: 1.4 }],
  },
  chartModalTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  chartModalSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  chartModalDivider: {
    width: '80%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  chartModalBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 14,
  },
  chartBadge3d: {
    alignItems: 'center',
    width: 68,
  },
  chartBadge3dShadow: {
    position: 'absolute',
    bottom: -3,
    left: 4,
    right: 4,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  chartBadge3dFace: {
    width: 68,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(45, 45, 50, 0.95)',
    alignItems: 'center',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    borderBottomColor: 'rgba(0,0,0,0.3)',
    overflow: 'hidden',
  },
  chartBadge3dShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  chartBadge3dIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  chartBadge3dValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  chartBadge3dLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartModalMissing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(251, 146, 60, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.2)',
  },
  chartModalMissingText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FB923C',
  },
  chartModalReanalyze: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(196, 30, 58, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.25)',
    width: '100%',
  },
  chartModalReanalyzeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#C41E3A',
  },
  badgeExplainCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(25, 25, 28, 0.97)',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeExplainIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  badgeExplainTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    marginBottom: 8,
  },
  badgeExplainDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  badgeExplainClose: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  badgeExplainCloseText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.7)',
  },
  reanalyzeBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reanalyzeBoxText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#9C968E',
  },
  analyzePopupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzePopupContainer: {
    width: 280,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  analyzePopupSuccess: {
    borderColor: 'rgba(196, 30, 58, 0.25)',
    borderTopColor: 'rgba(196, 30, 58, 0.35)',
    shadowColor: '#C41E3A',
    shadowOpacity: 0.3,
  },
  analyzePopupEmpty: {
    borderColor: 'rgba(156, 150, 142, 0.15)',
  },
  analyzePopupError: {
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  analyzePopupIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  analyzePopupTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#F5E6D3',
    marginBottom: 6,
  },
  analyzePopupMessage: {
    fontSize: 13,
    color: '#9C968E',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  analyzePopupDismiss: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
  },
  analyzePopupDismissText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#F5E6D3',
  },
});
