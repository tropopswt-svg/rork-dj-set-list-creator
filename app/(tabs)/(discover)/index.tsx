import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, Pressable, TextInput, RefreshControl, ActivityIndicator, Animated, Alert, Modal, GestureResponderEvent, Easing, useWindowDimensions, InteractionManager, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Link2, TrendingUp, Clock, SlidersHorizontal, ChevronDown, ChevronUp, X, User, Calendar, MapPin, Sparkles, Trash2, Edit3, RefreshCw, Tag, Settings, Heart, Bookmark, Play, Share2, ExternalLink } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import AnimatedSetCard, { CARD_HEIGHT } from '@/components/AnimatedSetCard';
import BubbleGlassLogo from '@/components/BubbleGlassLogo';
import ImportSetModal from '@/components/ImportSetModal';
import { SetList } from '@/types';
import { useDebounce } from '@/utils/hooks';
import { ImportResult } from '@/services/importService';
import { useSets } from '@/contexts/SetsContext';
import { supabase } from '@/lib/supabase/client';
import * as socialService from '@/lib/supabase/socialService';
import DoubleTapHeart from '@/components/DoubleTapHeart';
import { detectEvent, getEventLabel } from '@/components/EventBadge';
import { normalizeVenueName, normalizeArtistName } from '@/lib/venueNormalization';

// Tab bar height from _layout.tsx — in React Navigation v7 (Expo Router 6),
// the tab bar is absolutely positioned and overlaps scroll content
const TAB_BAR_HEIGHT = 85;

// Subtle ambient floating orbs behind the card list
const AmbientOrbs = () => {
  // Each orb has independent X/Y drift animations
  const orb1X = useRef(new Animated.Value(0)).current;
  const orb1Y = useRef(new Animated.Value(0)).current;
  const orb2X = useRef(new Animated.Value(0)).current;
  const orb2Y = useRef(new Animated.Value(0)).current;
  const orb3X = useRef(new Animated.Value(0)).current;
  const orb3Y = useRef(new Animated.Value(0)).current;
  const orb4X = useRef(new Animated.Value(0)).current;
  const orb4Y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const drift = (anim: Animated.Value, toA: number, toB: number, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: toA, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: toB, duration: dur * 0.8, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: dur * 0.6, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );

    const anims = [
      drift(orb1X, 30, -20, 12000),
      drift(orb1Y, -25, 15, 14000),
      drift(orb2X, -35, 25, 16000),
      drift(orb2Y, 20, -30, 13000),
      drift(orb3X, 20, -35, 18000),
      drift(orb3Y, -15, 25, 15000),
      drift(orb4X, -25, 30, 14000),
      drift(orb4Y, 30, -20, 17000),
    ];

    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={ambientStyles.container} pointerEvents="none">
      <Animated.View style={[ambientStyles.orb, ambientStyles.orb1, { transform: [{ translateX: orb1X }, { translateY: orb1Y }] }]} />
      <Animated.View style={[ambientStyles.orb, ambientStyles.orb2, { transform: [{ translateX: orb2X }, { translateY: orb2Y }] }]} />
      <Animated.View style={[ambientStyles.orb, ambientStyles.orb3, { transform: [{ translateX: orb3X }, { translateY: orb3Y }] }]} />
      <Animated.View style={[ambientStyles.orb, ambientStyles.orb4, { transform: [{ translateX: orb4X }, { translateY: orb4Y }] }]} />
    </View>
  );
};

const ambientStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: 220,
    height: 220,
    top: '20%',
    left: -50,
    backgroundColor: 'rgba(196, 30, 58, 0.025)',
  },
  orb2: {
    width: 180,
    height: 180,
    top: '50%',
    right: -40,
    backgroundColor: 'rgba(196, 30, 58, 0.02)',
  },
  orb3: {
    width: 260,
    height: 260,
    top: '65%',
    left: '15%',
    backgroundColor: 'rgba(184, 134, 11, 0.015)',
  },
  orb4: {
    width: 160,
    height: 160,
    top: '10%',
    right: '10%',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
});

// Create outside component to avoid re-creation on every render
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList;
// Initial estimate of header area (logo ~76 + search ~62 + filters ~58 = ~196)
const HEADER_AREA_ESTIMATE = 196;

// Clear filter FAB with grooves, pulse, and spinning accent circle
const ClearFilterFab = ({ onPress, bottom }: { onPress: () => void; bottom?: number }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinCircleOpacity = useRef(new Animated.Value(0)).current;
  const spinCircleRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle pulse every 15 seconds
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(15000),
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 150,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    // Every 30 seconds, show a spinning accent circle
    const spinCircleAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(30000),
        Animated.timing(spinCircleOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(spinCircleRotation, {
          toValue: 3,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(spinCircleOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(spinCircleRotation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    spinCircleAnimation.start();

    return () => {
      pulseAnimation.stop();
      spinCircleAnimation.stop();
    };
  }, []);

  const spinCircleSpin = spinCircleRotation.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['0deg', '360deg', '720deg', '1080deg'],
  });

  return (
    <Pressable style={[styles.clearFilterFab, bottom != null && { bottom }]} onPress={onPress}>
      {/* Multiple vinyl grooves (static) */}
      <View style={styles.clearFilterGroove1} />
      <View style={styles.clearFilterGroove2} />
      <View style={styles.clearFilterGroove3} />
      {/* Spinning accent circle that appears every 30s */}
      <Animated.View
        style={[
          styles.clearFilterSpinCircle,
          {
            opacity: spinCircleOpacity,
            transform: [{ rotate: spinCircleSpin }],
          },
        ]}
      />
      {/* Center X icon - pulses */}
      <Animated.View style={[styles.clearFilterInner, { transform: [{ scale: pulseAnim }] }]}>
        <X size={24} color={Colors.dark.background} />
      </Animated.View>
    </Pressable>
  );
};

// API base URL
const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

type FilterType = 'trending' | 'recent';

interface Filters {
  artists: string[];
  years: string[];
  venues: string[];
  identified: 'all' | 'identified' | 'unidentified' | 'needs-source';
  eventId: string | null; // Filter by event/venue badge
}

// Extract venue from set name — parses "Artist @ Venue, Location" pattern
const extractVenue = (name: string): string | null => {
  const atMatch = name.match(/@\s*(.+)$/);
  if (atMatch) {
    const parts = atMatch[1].split(',').map(p => p.trim());
    // First part after @ is typically the venue
    const venue = parts[0].replace(/\s*\d{4}-\d{2}-\d{2}\s*$/, '').trim();
    if (venue && venue.length > 1) return venue;
  }
  return null;
};

// Extract year from date
const extractYear = (date: Date | string): string => {
  const d = new Date(date);
  return d.getFullYear().toString();
};

// Memoized list item — avoids inline closures that defeat React.memo on AnimatedSetCard.
// Without this, every renderItem call creates new onPress/onLongPress function refs,
// causing AnimatedSetCard + SetFeedCard (2000-line component with heavy regex) to
// re-render for every visible card on each scroll frame.
const SetCardItem = React.memo(function SetCardItem({
  item,
  index,
  scrollY,
  onCardTap,
  onLongPress,
  onArtistPress,
  onEventPress,
}: {
  item: SetList;
  index: number;
  scrollY: Animated.Value;
  onCardTap: (id: string) => void;
  onLongPress: (set: SetList) => void;
  onArtistPress: (artist: string) => void;
  onEventPress: (eventId: string) => void;
}) {
  const handlePress = useCallback(() => onCardTap(item.id), [item.id, onCardTap]);
  const handleLongPress = useCallback(() => onLongPress(item), [item, onLongPress]);

  return (
    <AnimatedSetCard
      setList={item}
      index={index}
      scrollY={scrollY}
      centerOffset={0}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onArtistPress={onArtistPress}
      onEventPress={onEventPress}
    />
  );
}, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.index === next.index &&
  prev.onCardTap === next.onCardTap &&
  prev.onLongPress === next.onLongPress
);

export default function DiscoverScreen() {
  const router = useRouter();
  const { refreshSetsMetadata } = useSets();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Full tab bar height: styled height + bottom safe area (home indicator on iOS)
  const totalTabBarHeight = TAB_BAR_HEIGHT + insets.bottom;
  // Measure the actual header area height for precise centering
  const [headerAreaHeight, setHeaderAreaHeight] = useState(HEADER_AREA_ESTIMATE);
  // Visible scroll area = screen minus safe area, header, and tab bar
  const visibleScrollHeight = windowHeight - insets.top - headerAreaHeight - totalTabBarHeight;
  const scrollPaddingTop = useMemo(() => Math.max(0, Math.round(visibleScrollHeight / 2 - CARD_HEIGHT / 2)), [visibleScrollHeight]);
  const scrollPaddingBottom = useMemo(() => scrollPaddingTop + totalTabBarHeight, [scrollPaddingTop, totalTabBarHeight]);
  const [setLists, setSetLists] = useState<SetList[]>([]);
  const [dbSets, setDbSets] = useState<SetList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [expandedFilter, setExpandedFilter] = useState<'artists' | 'years' | 'venues' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const scrollY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList<SetList>>(null);
  const lastCenteredIndex = useRef(-1);
  const lastHapticTime = useRef(0);
  // Subscribe to auth via ref only — avoids re-rendering this component on auth changes
  const userRef = useRef<any>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      userRef.current = session?.user ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      userRef.current = session?.user ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);
  const lastTapRef = useRef<Record<string, number>>({});
  const tapTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [doubleTapHeartId, setDoubleTapHeartId] = useState<string | null>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeFilter, setActiveFilter] = useState<FilterType>('recent');
  const [refreshing, setRefreshing] = useState(false);
  const [dbStats, setDbStats] = useState({ sets: 0, tracks: 0 });
  const [selectedFilters, setSelectedFilters] = useState<Filters>({
    artists: [],
    years: [],
    venues: [],
    identified: 'all',
    eventId: null,
  });
  const selectedIndexRef = useRef(0);

  // Auto-scroll feature - starts after 20 seconds of inactivity
  const AUTO_SCROLL_DELAY = 20000; // 20 seconds before auto-scroll starts
  const AUTO_SCROLL_INTERVAL = 5000; // 5 seconds per set
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);

  // Hidden admin menu - tap 2 times, then hold to open
  const hiddenTapCount = useRef(0);
  const hiddenTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);
  const [adminMode, setAdminMode] = useState<'none' | 'remove' | 'edit' | 'badge'>('none');
  const [showRefreshResults, setShowRefreshResults] = useState(false);
  const [lastRefreshResults, setLastRefreshResults] = useState<{
    updated: number;
    failed: number;
    updatedSets: Array<{ setId: string; setName: string; updates: Record<string, string> }>;
    failedSets: Array<{ setId: string; setName: string; error: string }>;
  } | null>(null);

  // Quick action menu state
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [quickMenuSet, setQuickMenuSet] = useState<SetList | null>(null);
  const [likedSets, setLikedSets] = useState<Set<string>>(new Set());
  const [savedSets, setSavedSets] = useState<Set<string>>(new Set());

  // Vinyl button animations - pulse every 15s, spinning circle every 30s
  const vinylPulseAnim = useRef(new Animated.Value(1)).current;
  const vinylSpinCircleOpacity = useRef(new Animated.Value(0)).current;
  const vinylSpinCircleRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle pulse every 15 seconds
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(15000),
        Animated.timing(vinylPulseAnim, {
          toValue: 1.08,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(vinylPulseAnim, {
          toValue: 0.95,
          duration: 150,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(vinylPulseAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    // Every 30 seconds, show a spinning accent circle
    const spinCircleAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(30000),
        Animated.timing(vinylSpinCircleOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(vinylSpinCircleRotation, {
          toValue: 3,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(vinylSpinCircleOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(vinylSpinCircleRotation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    spinCircleAnimation.start();

    return () => {
      pulseAnimation.stop();
      spinCircleAnimation.stop();
    };
  }, []);

  const vinylSpinCircleSpin = vinylSpinCircleRotation.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['0deg', '360deg', '720deg', '1080deg'],
  });

  // Handle press in - start long press detection after 2 taps
  const handleHiddenPressIn = useCallback(() => {
    if (__DEV__) console.log('[Admin] Press in, tap count:', hiddenTapCount.current);

    // If we've tapped twice, start long press timer
    if (hiddenTapCount.current >= 2) {
      if (__DEV__) console.log('[Admin] Starting long press detection...');
      longPressTimer.current = setTimeout(() => {
        if (__DEV__) console.log('[Admin] Long press triggered! Opening menu...');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        hiddenTapCount.current = 0;
        setShowAdminMenu(true);
      }, 500); // 500ms hold
    }
  }, []);

  // Handle press out - cancel long press
  const handleHiddenPressOut = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Handle tap
  const handleHiddenTap = useCallback(() => {
    hiddenTapCount.current += 1;
    if (__DEV__) console.log('[Admin] Tap count:', hiddenTapCount.current);

    // Light haptic on each tap
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Reset timer on each tap
    if (hiddenTapTimer.current) {
      clearTimeout(hiddenTapTimer.current);
    }

    // Reset count after 2 seconds of no activity
    hiddenTapTimer.current = setTimeout(() => {
      if (__DEV__) console.log('[Admin] Resetting tap count');
      hiddenTapCount.current = 0;
    }, 2000);
  }, []);

  // Admin menu actions
  const handleRefreshMetadata = useCallback(async () => {
    setShowAdminMenu(false);
    setIsRefreshingMetadata(true);

    Alert.alert(
      'Refreshing Metadata',
      'Fetching updated venue and location info from YouTube descriptions...',
      [{ text: 'OK' }]
    );

    try {
      if (__DEV__) console.log('[Admin] Starting metadata refresh...');
      const result = await refreshSetsMetadata();
      if (__DEV__) console.log('[Admin] Refresh complete:', result);

      // Store the results for viewing later
      setLastRefreshResults(result);

      setTimeout(() => {
        Alert.alert(
          'Metadata Refresh Complete',
          `Updated: ${result.updated} sets\nFailed: ${result.failed}\n\nTap "View Results" in admin menu to see details.`,
          [{ text: 'OK' }]
        );
      }, 500);
    } catch (error: any) {
      if (__DEV__) console.error('[Admin] Refresh error:', error);
      Alert.alert('Error', `Failed to refresh metadata: ${error.message || 'Unknown error'}`);
    } finally {
      setIsRefreshingMetadata(false);
    }
  }, [refreshSetsMetadata]);

  // View last refresh results
  const handleViewRefreshResults = useCallback(() => {
    setShowAdminMenu(false);
    if (lastRefreshResults) {
      setShowRefreshResults(true);
    } else {
      Alert.alert('No Results', 'No metadata refresh has been performed yet.');
    }
  }, [lastRefreshResults]);

  const handleEnterRemoveMode = useCallback(() => {
    setShowAdminMenu(false);
    setAdminMode('remove');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Remove Mode',
      'Tap on sets to remove them. Tap "Done" when finished.',
      [{ text: 'OK' }]
    );
  }, []);

  const handleEnterEditMode = useCallback(() => {
    setShowAdminMenu(false);
    setAdminMode('edit');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Edit Mode',
      'Tap on sets to edit their names and details. Tap "Done" when finished.',
      [{ text: 'OK' }]
    );
  }, []);

  const handleEnterBadgeMode = useCallback(() => {
    setShowAdminMenu(false);
    setAdminMode('badge');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Badge Mode',
      'Tap on sets to change their event badges. Tap "Done" when finished.',
      [{ text: 'OK' }]
    );
  }, []);

  const handleExitAdminMode = useCallback(() => {
    setAdminMode('none');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle event badge press - filter by event
  const handleEventFilter = useCallback((eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedFilters(prev => ({
      ...prev,
      eventId: prev.eventId === eventId ? null : eventId, // Toggle filter
    }));
  }, []);

  // Handle long press on set card - show quick menu
  const handleSetLongPress = useCallback((set: SetList) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setQuickMenuSet(set);
    setShowQuickMenu(true);
  }, []);

  // Quick menu actions
  const handleLikeSet = useCallback(() => {
    if (!quickMenuSet) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLikedSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(quickMenuSet.id)) {
        newSet.delete(quickMenuSet.id);
      } else {
        newSet.add(quickMenuSet.id);
      }
      return newSet;
    });
    setShowQuickMenu(false);
  }, [quickMenuSet]);

  const handleSaveSet = useCallback(() => {
    if (!quickMenuSet) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSavedSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(quickMenuSet.id)) {
        newSet.delete(quickMenuSet.id);
      } else {
        newSet.add(quickMenuSet.id);
      }
      return newSet;
    });
    setShowQuickMenu(false);
    Alert.alert(
      savedSets.has(quickMenuSet.id) ? 'Removed from Collection' : 'Added to Collection',
      savedSets.has(quickMenuSet.id)
        ? `"${quickMenuSet.name}" removed from your saved sets.`
        : `"${quickMenuSet.name}" added to your saved sets.`
    );
  }, [quickMenuSet, savedSets]);

  const handleListenSet = useCallback(() => {
    if (!quickMenuSet) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowQuickMenu(false);
    // Open first source link if available
    const sourceLink = quickMenuSet.sourceLinks?.[0];
    if (sourceLink) {
      Alert.alert('Opening Source', `Opening ${sourceLink.platform}...`);
      // In a real app, you'd use Linking.openURL(sourceLink.url)
    } else {
      Alert.alert('No Source', 'This set has no linked source to play.');
    }
  }, [quickMenuSet]);

  const handleShareSet = useCallback(() => {
    if (!quickMenuSet) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowQuickMenu(false);
    Alert.alert('Share', `Share "${quickMenuSet.name}" - Coming soon!`);
  }, [quickMenuSet]);

  const handleViewSet = useCallback(() => {
    if (!quickMenuSet) return;
    setShowQuickMenu(false);
    router.push(`/(tabs)/(discover)/${quickMenuSet.id}`);
  }, [quickMenuSet, router]);

  // Fetch sets from database
  const fetchSets = useCallback(async (searchTerm?: string) => {
    try {
      const params = new URLSearchParams({
        limit: '200',
        sort: 'recent',
      });
      if (searchTerm && searchTerm.length >= 2) {
        params.set('search', searchTerm);
      }
      const response = await fetch(`${API_BASE_URL}/api/sets?${params}`);
      const data = await response.json();

      if (data.success && data.sets) {
        // Transform API response to match SetList type
        const transformedSets: SetList[] = data.sets.map((set: any) => ({
          id: set.id,
          name: set.name,
          artist: set.artist,
          venue: set.venue,
          location: set.location,
          date: new Date(set.date),
          totalDuration: set.totalDuration || 0,
          coverUrl: set.coverUrl || null,
          artistImageUrl: set.artistImageUrl || null,
          plays: set.trackCount * 10, // Estimate plays from track count
          tracks: [],
          sourceLinks: set.sourceLinks || [],
          trackCount: set.trackCount,
          source: 'database',
        }));
        setDbSets(transformedSets);
        setDbStats({ sets: data.total || transformedSets.length, tracks: 0 });
        if (__DEV__) console.log('[Discover] Loaded', transformedSets.length, 'sets from database');
      }
    } catch (error) {
      if (__DEV__) console.error('[Discover] Failed to fetch sets:', error);
      setDbSets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load sets on mount and when filter changes
  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  // Re-fetch from database when search query changes (for full DB search)
  useEffect(() => {
    if (debouncedSearchQuery.length >= 2) {
      fetchSets(debouncedSearchQuery);
    } else if (debouncedSearchQuery.length === 0) {
      fetchSets();
    }
  }, [debouncedSearchQuery]);

  // Update set lists when database sets change
  useEffect(() => {
    setSetLists([...dbSets]);
  }, [dbSets]);

  // Track whether user is actively dragging (not programmatic scroll)
  const isUserDragging = useRef(false);

  // Track centered card index and provide haptic feedback during user drag.
  // Uses the Animated.event listener callback instead of scrollY.addListener
  // to avoid bridging the animated value from native→JS on every animation frame.
  const handleScrollEvent = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const centeredIndex = Math.round(offsetY / CARD_HEIGHT);

    if (centeredIndex !== lastCenteredIndex.current && centeredIndex >= 0) {
      lastCenteredIndex.current = centeredIndex;
      selectedIndexRef.current = centeredIndex;

      // Haptic feedback only during user drag, throttled
      if (isUserDragging.current) {
        const now = Date.now();
        if (now - lastHapticTime.current > 200) {
          lastHapticTime.current = now;
          Haptics.selectionAsync();
        }
      }
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSets();
    setRefreshing(false);
  }, [fetchSets]);

  const handleImport = (result: ImportResult) => {
    if (!result.success || !result.setList) {
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setSetLists([result.setList, ...setLists]);
    setShowImportModal(false);

    router.push(`/(tabs)/(discover)/${result.setList.id}`);
  };

  // Extract unique filter options from sets — normalize to deduplicate
  const filterOptions = useMemo(() => {
    const artists = new Set<string>();
    const years = new Set<string>();
    const venues = new Set<string>();

    setLists.forEach(set => {
      if (set.artist) artists.add(normalizeArtistName(set.artist));
      if (set.date) years.add(extractYear(set.date));
      // Use explicit venue field first, fall back to parsing from name
      const venue = set.venue || extractVenue(set.name);
      if (venue) venues.add(normalizeVenueName(venue));
    });

    return {
      artists: Array.from(artists).sort(),
      years: Array.from(years).sort((a, b) => b.localeCompare(a)),
      venues: Array.from(venues).sort(),
    };
  }, [setLists]);

  const activeFilterCount = selectedFilters.artists.length + selectedFilters.years.length + selectedFilters.venues.length + (selectedFilters.identified !== 'all' ? 1 : 0) + (selectedFilters.eventId ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || debouncedSearchQuery.length > 0;

  // Check if a set has been trakd (analyzed via YouTube/SoundCloud)
  const isSetIdentified = (set: SetList): boolean => {
    // A set is "trakd" if it has a YouTube or SoundCloud source AND has tracks
    const hasAnalyzableSource = set.sourceLinks?.some(
      link => link.platform === 'youtube' || link.platform === 'soundcloud'
    );
    const hasTracks = (set.trackCount || set.tracks?.length || 0) > 0;
    return !!(hasAnalyzableSource && hasTracks);
  };

  // Check if a set needs a source (no YouTube or SoundCloud)
  const setNeedsSource = (set: SetList): boolean => {
    return !set.sourceLinks?.some(
      link => link.platform === 'youtube' || link.platform === 'soundcloud'
    );
  };

  const filteredSets = useMemo(() => {
    return setLists
      .filter(set => {
        // Search filter - searches full name, artist, venue, and location
        if (debouncedSearchQuery) {
          const query = debouncedSearchQuery.toLowerCase();
          const matchesSearch =
            set.name.toLowerCase().includes(query) ||
            set.artist.toLowerCase().includes(query) ||
            set.venue?.toLowerCase().includes(query) ||
            set.location?.toLowerCase().includes(query);
          if (!matchesSearch) return false;
        }

        // trakd / Source filter
        if (selectedFilters.identified !== 'all') {
          if (selectedFilters.identified === 'needs-source') {
            if (!setNeedsSource(set)) return false;
          } else {
            const identified = isSetIdentified(set);
            if (selectedFilters.identified === 'identified' && !identified) return false;
            if (selectedFilters.identified === 'unidentified' && identified) return false;
          }
        }

        // Artist filter — normalize for consistent matching
        if (selectedFilters.artists.length > 0) {
          const normalizedArtist = normalizeArtistName(set.artist);
          if (!selectedFilters.artists.includes(normalizedArtist)) return false;
        }

        // Year filter
        if (selectedFilters.years.length > 0) {
          const setYear = extractYear(set.date);
          if (!selectedFilters.years.includes(setYear)) return false;
        }

        // Venue filter — normalize for consistent matching
        if (selectedFilters.venues.length > 0) {
          const venue = set.venue || extractVenue(set.name);
          if (!venue || !selectedFilters.venues.includes(normalizeVenueName(venue))) return false;
        }

        // Event/Venue badge filter
        if (selectedFilters.eventId) {
          const textToSearch = `${set.name} ${set.venue || ''} ${set.eventName || ''}`;
          const detectedEventId = detectEvent(textToSearch);
          if (detectedEventId !== selectedFilters.eventId) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (activeFilter === 'trending') {
          return (b.plays || 0) - (a.plays || 0);
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [setLists, debouncedSearchQuery, activeFilter, selectedFilters]);

  // Calculate initial scroll position to start in the middle of the list
  // With paddingTop centering the visible area, card i is centered when scrollY = i * CARD_HEIGHT
  const middleIndex = Math.floor(filteredSets.length / 2);
  const initialScrollOffset = middleIndex * CARD_HEIGHT;

  // Set scroll position to middle when data loads
  const filteredSetKey = useMemo(() => {
    const len = filteredSets.length;
    return `${len}-${filteredSets[0]?.id || ''}-${filteredSets[len - 1]?.id || ''}`;
  }, [filteredSets]);

  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (isInitialLoad.current && filteredSets.length > 0) {
      isInitialLoad.current = false;
    }
  }, [filteredSetKey]);

  // Auto-scroll: scroll to next set
  const scrollToNextSet = useCallback(() => {
    if (!flatListRef.current || filteredSets.length === 0) return;

    const nextIndex = (selectedIndexRef.current + 1) % filteredSets.length;

    flatListRef.current.scrollToIndex({
      index: nextIndex,
      animated: true,
    });
  }, [filteredSets.length]);

  // Start auto-scroll mode
  const startAutoScroll = useCallback(() => {
    if (filteredSets.length <= 1) return;

    setIsAutoScrolling(true);
    // Scroll to next set immediately, then every 5 seconds
    scrollToNextSet();
    autoScrollTimer.current = setInterval(() => {
      scrollToNextSet();
    }, AUTO_SCROLL_INTERVAL);
  }, [scrollToNextSet, filteredSets.length]);

  // Stop auto-scroll and reset inactivity timer
  const stopAutoScroll = useCallback(() => {
    setIsAutoScrolling(false);
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
  }, []);

  // Reset inactivity timer (called on any user interaction)
  const resetInactivityTimer = useCallback(() => {
    // Stop auto-scroll if it's running
    if (isAutoScrolling) {
      stopAutoScroll();
    }

    // Clear existing inactivity timer
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    // Start new inactivity timer
    inactivityTimer.current = setTimeout(() => {
      startAutoScroll();
    }, AUTO_SCROLL_DELAY);
  }, [isAutoScrolling, stopAutoScroll, startAutoScroll]);

  // Initialize inactivity timer on mount and cleanup on unmount
  useEffect(() => {
    resetInactivityTimer();

    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset timer when filteredSets changes (user interacted with filters)
  useEffect(() => {
    resetInactivityTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSetKey]);

  const toggleFilter = (type: 'artists' | 'years' | 'venues', value: string) => {
    setSelectedFilters(prev => {
      const current = prev[type];
      const arr = Array.isArray(current) ? current : [current].filter(Boolean);
      const updated = arr.includes(value)
        ? arr.filter((v: string) => v !== value)
        : [...arr, value];
      return { ...prev, [type]: updated };
    });
  };

  const clearFilters = () => {
    setSelectedFilters({ artists: [], years: [], venues: [], identified: 'all', eventId: null });
    setSearchQuery('');
  };

  // Clear all filters and close dropdown
  const handleClearAllFilters = () => {
    Haptics.selectionAsync();
    clearFilters();
    if (showFilterDropdown) {
      setShowFilterDropdown(false);
      setExpandedFilter(null);
    }
  };

  const toggleFilterDropdown = () => {
    Haptics.selectionAsync();
    const toValue = showFilterDropdown ? 0 : 1;
    setShowFilterDropdown(!showFilterDropdown);
    if (showFilterDropdown) {
      setExpandedFilter(null);
    }
  };

  const toggleFilterSection = (section: 'artists' | 'years' | 'venues') => {
    Haptics.selectionAsync();
    setFilterSearch('');
    setExpandedFilter(expandedFilter === section ? null : section);
  };

  // Filter options based on search
  const getFilteredOptions = (type: 'artists' | 'years' | 'venues') => {
    const options = filterOptions[type];
    if (!filterSearch || type === 'years') return options;
    const search = filterSearch.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(search));
  };

  // Stable callbacks for FlatList renderItem (avoids new function refs each render)
  const handleSetPress = useCallback((setId: string) => {
    router.push(`/(tabs)/(discover)/${setId}`);
  }, [router]);

  const handleCardTap = useCallback((setId: string) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[setId] || 0;

    if (now - lastTap < 300) {
      // Double-tap → like
      clearTimeout(tapTimerRef.current[setId]);
      delete tapTimerRef.current[setId];
      lastTapRef.current[setId] = 0;

      const currentUser = userRef.current;
      if (currentUser) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setDoubleTapHeartId(setId);
        socialService.likeSet(currentUser.id, setId);
      }
    } else {
      // First tap — wait for possible second tap
      lastTapRef.current[setId] = now;
      tapTimerRef.current[setId] = setTimeout(() => {
        delete tapTimerRef.current[setId];
        handleSetPress(setId);
      }, 300);
    }
  }, [handleSetPress]);

  const handleArtistNavPress = useCallback((artist: string) => {
    const slug = artist.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').trim();
    router.push(`/(tabs)/(discover)/artist/${slug}`);
  }, [router]);

  const getItemLayout = useCallback((_data: any, index: number) => ({
    length: CARD_HEIGHT,
    offset: CARD_HEIGHT * index,
    index,
  }), []);

  const renderSetCard = useCallback(({ item, index }: { item: SetList; index: number }) => (
    <SetCardItem
      item={item}
      index={index}
      scrollY={scrollY}
      onCardTap={handleCardTap}
      onLongPress={handleSetLongPress}
      onArtistPress={handleArtistNavPress}
      onEventPress={handleEventFilter}
    />
  ), [scrollY, handleCardTap, handleSetLongPress, handleArtistNavPress, handleEventFilter]);

  const keyExtractor = useCallback((item: SetList) => item.id, []);

  // Stable scroll handlers — avoids re-attaching native scroll listener on re-render
  const onScroll = useMemo(
    () => Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: true, listener: handleScrollEvent }
    ),
    [scrollY, handleScrollEvent]
  );

  const resetInactivityTimerRef = useRef(resetInactivityTimer);
  resetInactivityTimerRef.current = resetInactivityTimer;

  const onScrollBeginDrag = useCallback(() => {
    isUserDragging.current = true;
    resetInactivityTimerRef.current();
  }, []);

  const onScrollEndDrag = useCallback(() => {
    isUserDragging.current = false;
  }, []);

  const onMomentumScrollEnd = useCallback(() => {
    isUserDragging.current = false;
  }, []);

  const onTouchStart = useCallback(() => {
    resetInactivityTimerRef.current();
  }, []);

  const contentContainerMemoStyle = useMemo(
    () => [styles.scrollContent, { paddingTop: scrollPaddingTop, paddingBottom: scrollPaddingBottom }],
    [scrollPaddingTop, scrollPaddingBottom]
  );

  const listEmptyComponent = useMemo(() => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Search size={32} color={Colors.dark.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No sets found</Text>
      <Text style={styles.emptySubtitle}>
        Try a different search or import a new set
      </Text>
    </View>
  ), []);

  const listLoadingComponent = useMemo(() => (
    <View style={styles.loadingState}>
      <BubbleGlassLogo size="large" loading />
      <Text style={styles.loadingText}>Loading sets...</Text>
    </View>
  ), []);

  return (
    <View style={styles.container}>
      <AmbientOrbs />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - headerAreaHeight) > 2) {
            setHeaderAreaHeight(h);
          }
        }}>
        <View style={styles.header}>
          {/* Hidden admin button - dev only */}
          <Pressable
            style={styles.hiddenTapArea}
            {...(__DEV__ ? {
              onPress: handleHiddenTap,
              onPressIn: handleHiddenPressIn,
              onPressOut: handleHiddenPressOut,
            } : {})}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            {isRefreshingMetadata && (
              <ActivityIndicator size="small" color={Colors.dark.primary} />
            )}
          </Pressable>
          <BubbleGlassLogo loading={isLoading} />
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.dark.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sets, artists, venues..."
            placeholderTextColor={Colors.dark.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, activeFilter === 'trending' && styles.filterChipActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveFilter('trending');
            }}
          >
            <TrendingUp size={14} color={activeFilter === 'trending' ? Colors.dark.background : Colors.dark.textSecondary} />
            <Text style={[styles.filterText, activeFilter === 'trending' && styles.filterTextActive]}>Popular</Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, activeFilter === 'recent' && styles.filterChipActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveFilter('recent');
            }}
          >
            <Clock size={14} color={activeFilter === 'recent' ? Colors.dark.background : Colors.dark.textSecondary} />
            <Text style={[styles.filterText, activeFilter === 'recent' && styles.filterTextActive]}>Recent</Text>
          </Pressable>
          <Pressable
            style={[styles.filterButton, (showFilterDropdown || activeFilterCount > 0) && styles.filterButtonActive]}
            onPress={toggleFilterDropdown}
          >
            <SlidersHorizontal size={14} color={(showFilterDropdown || activeFilterCount > 0) ? Colors.dark.background : Colors.dark.primary} />
            <Text style={[styles.filterButtonText, (showFilterDropdown || activeFilterCount > 0) && styles.filterButtonTextActive]}>
              {activeFilterCount > 0 ? `${filteredSets.length} found` : 'Dig'}
            </Text>
            {showFilterDropdown ? (
              <ChevronUp size={14} color={(showFilterDropdown || activeFilterCount > 0) ? Colors.dark.background : Colors.dark.primary} />
            ) : (
              <ChevronDown size={14} color={(showFilterDropdown || activeFilterCount > 0) ? Colors.dark.background : Colors.dark.primary} />
            )}
          </Pressable>
        </View>

        {/* Active Event Filter Badge */}
        {selectedFilters.eventId && (
          <View style={styles.activeEventFilter}>
            <Text style={styles.activeEventFilterLabel}>Showing:</Text>
            <Pressable
              style={styles.activeEventBadge}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedFilters(prev => ({ ...prev, eventId: null }));
              }}
            >
              <Text style={styles.activeEventText}>{getEventLabel(selectedFilters.eventId)}</Text>
              <X size={12} color={Colors.dark.primary} />
            </Pressable>
          </View>
        )}

        {/* Filter Dropdown */}
        {showFilterDropdown && (
          <View style={styles.filterDropdown}>
            {/* trakd + Genres row */}
            <View style={styles.topToggleRow}>
              <Pressable
                style={[
                  styles.trakdToggleBtn,
                  selectedFilters.identified === 'identified' && styles.trakdToggleBtnActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedFilters(prev => ({
                    ...prev,
                    identified: prev.identified === 'identified' ? 'all' : 'identified',
                  }));
                }}
              >
                <Text style={[
                  styles.trakdToggleText,
                  selectedFilters.identified === 'identified' && styles.trakdToggleTextActive,
                ]}>trakd</Text>
                {selectedFilters.identified === 'identified' && (
                  <X size={12} color="rgba(255, 248, 231, 0.8)" />
                )}
              </Pressable>

              <Pressable
                style={styles.genresToggleBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/(tabs)/(discover)/genres');
                }}
              >
                <Tag size={14} color={Colors.dark.primary} />
                <Text style={styles.genresToggleText}>Genres</Text>
              </Pressable>
            </View>

            {/* Filter section buttons */}
            <View style={styles.filterSectionButtons}>
              <Pressable
                style={[styles.filterSectionBtn, expandedFilter === 'artists' && styles.filterSectionBtnActive]}
                onPress={() => toggleFilterSection('artists')}
              >
                <User size={14} color={expandedFilter === 'artists' ? Colors.dark.background : Colors.dark.text} />
                <Text style={[styles.filterSectionBtnText, expandedFilter === 'artists' && styles.filterSectionBtnTextActive]}>
                  Artist {selectedFilters.artists.length > 0 && `(${selectedFilters.artists.length})`}
                </Text>
                <ChevronDown size={12} color={expandedFilter === 'artists' ? Colors.dark.background : Colors.dark.textMuted} />
              </Pressable>

              <Pressable
                style={[styles.filterSectionBtn, expandedFilter === 'years' && styles.filterSectionBtnActive]}
                onPress={() => toggleFilterSection('years')}
              >
                <Calendar size={14} color={expandedFilter === 'years' ? Colors.dark.background : Colors.dark.text} />
                <Text style={[styles.filterSectionBtnText, expandedFilter === 'years' && styles.filterSectionBtnTextActive]}>
                  Year {selectedFilters.years.length > 0 && `(${selectedFilters.years.length})`}
                </Text>
                <ChevronDown size={12} color={expandedFilter === 'years' ? Colors.dark.background : Colors.dark.textMuted} />
              </Pressable>

              <Pressable
                style={[styles.filterSectionBtn, expandedFilter === 'venues' && styles.filterSectionBtnActive]}
                onPress={() => toggleFilterSection('venues')}
              >
                <MapPin size={14} color={expandedFilter === 'venues' ? Colors.dark.background : Colors.dark.text} />
                <Text style={[styles.filterSectionBtnText, expandedFilter === 'venues' && styles.filterSectionBtnTextActive]}>
                  Venue {selectedFilters.venues.length > 0 && `(${selectedFilters.venues.length})`}
                </Text>
                <ChevronDown size={12} color={expandedFilter === 'venues' ? Colors.dark.background : Colors.dark.textMuted} />
              </Pressable>
            </View>

            {/* Expanded filter options */}
            {expandedFilter && (
              <View style={styles.expandedSection}>
                {/* Search input for artists and venues */}
                {(expandedFilter === 'artists' || expandedFilter === 'venues') && (
                  <View style={styles.filterSearchContainer}>
                    <Search size={14} color={Colors.dark.textMuted} />
                    <TextInput
                      style={styles.filterSearchInput}
                      placeholder={`Search ${expandedFilter === 'artists' ? 'artists' : 'venues'}...`}
                      placeholderTextColor={Colors.dark.textMuted}
                      value={filterSearch}
                      onChangeText={setFilterSearch}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {filterSearch.length > 0 && (
                      <Pressable onPress={() => setFilterSearch('')}>
                        <X size={14} color={Colors.dark.textMuted} />
                      </Pressable>
                    )}
                  </View>
                )}
                <ScrollView style={styles.filterOptionsList} showsVerticalScrollIndicator={true}>
                  <View style={styles.filterOptionsWrap}>
                    {getFilteredOptions(expandedFilter).map(option => (
                      <Pressable
                        key={option}
                        style={[
                          styles.filterOptionChip,
                          selectedFilters[expandedFilter].includes(option) && styles.filterOptionChipSelected,
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          toggleFilter(expandedFilter, option);
                        }}
                      >
                        <Text
                          style={[
                            styles.filterOptionChipText,
                            selectedFilters[expandedFilter].includes(option) && styles.filterOptionChipTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                    {getFilteredOptions(expandedFilter).length === 0 && (
                      <Text style={styles.noResultsText}>No {expandedFilter} found</Text>
                    )}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <Pressable style={styles.clearFiltersBtn} onPress={clearFilters}>
                <X size={12} color={Colors.dark.primary} />
                <Text style={styles.clearFiltersBtnText}>Clear all filters</Text>
              </Pressable>
            )}
          </View>
        )}
        </View>

        {isLoading ? (
          <View style={[styles.scrollView, { justifyContent: 'center', alignItems: 'center' }]}>
            {listLoadingComponent}
          </View>
        ) : (
          <AnimatedFlatList
            ref={flatListRef as any}
            data={filteredSets}
            renderItem={renderSetCard}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            style={styles.scrollView}
            contentContainerStyle={contentContainerMemoStyle}
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={CARD_HEIGHT}
            snapToAlignment="start"
            initialScrollIndex={filteredSets.length > 0 ? middleIndex : undefined}
            onScroll={onScroll}
            onScrollBeginDrag={onScrollBeginDrag}
            onScrollEndDrag={onScrollEndDrag}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onTouchStart={onTouchStart}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.dark.primary}
              />
            }
            ListEmptyComponent={listEmptyComponent}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={5}
            windowSize={7}
            onScrollToIndexFailed={(info) => {
              flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
            }}
          />
        )}

        {/* Double-tap heart overlay — rendered once outside FlatList to avoid re-rendering all items */}
        {doubleTapHeartId && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <DoubleTapHeart
              visible={true}
              onComplete={() => setDoubleTapHeartId(null)}
            />
          </View>
        )}

        <ImportSetModal
          visible={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
        />

        {/* Admin Menu Modal */}
        <Modal
          visible={showAdminMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAdminMenu(false)}
        >
          <Pressable
            style={styles.adminModalOverlay}
            onPress={() => setShowAdminMenu(false)}
          >
            <View style={styles.adminMenuContainer}>
              <View style={styles.adminMenuHeader}>
                <Settings size={20} color={Colors.dark.primary} />
                <Text style={styles.adminMenuTitle}>Admin Menu</Text>
                <Pressable onPress={() => setShowAdminMenu(false)} hitSlop={8}>
                  <X size={20} color={Colors.dark.textMuted} />
                </Pressable>
              </View>

              <Pressable style={styles.adminMenuItem} onPress={handleRefreshMetadata}>
                <RefreshCw size={18} color={Colors.dark.text} />
                <View style={styles.adminMenuItemContent}>
                  <Text style={styles.adminMenuItemText}>Refresh Metadata</Text>
                  <Text style={styles.adminMenuItemDesc}>Re-fetch venue/location from YouTube</Text>
                </View>
              </Pressable>

              <Pressable style={styles.adminMenuItem} onPress={handleEnterRemoveMode}>
                <Trash2 size={18} color="#EF4444" />
                <View style={styles.adminMenuItemContent}>
                  <Text style={styles.adminMenuItemText}>Remove Sets</Text>
                  <Text style={styles.adminMenuItemDesc}>Tap sets to delete them</Text>
                </View>
              </Pressable>

              <Pressable style={styles.adminMenuItem} onPress={handleEnterEditMode}>
                <Edit3 size={18} color={Colors.dark.text} />
                <View style={styles.adminMenuItemContent}>
                  <Text style={styles.adminMenuItemText}>Edit Names</Text>
                  <Text style={styles.adminMenuItemDesc}>Modify set names and artists</Text>
                </View>
              </Pressable>

              <Pressable style={styles.adminMenuItem} onPress={handleEnterBadgeMode}>
                <Tag size={18} color={Colors.dark.text} />
                <View style={styles.adminMenuItemContent}>
                  <Text style={styles.adminMenuItemText}>Manage Badges</Text>
                  <Text style={styles.adminMenuItemDesc}>Change event/venue badges</Text>
                </View>
              </Pressable>

              {lastRefreshResults && (
                <Pressable style={[styles.adminMenuItem, styles.adminMenuItemHighlight]} onPress={handleViewRefreshResults}>
                  <Sparkles size={18} color={Colors.dark.primary} />
                  <View style={styles.adminMenuItemContent}>
                    <Text style={[styles.adminMenuItemText, { color: Colors.dark.primary }]}>View Last Refresh Results</Text>
                    <Text style={styles.adminMenuItemDesc}>{lastRefreshResults.updated} updated, {lastRefreshResults.failed} failed</Text>
                  </View>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Modal>

        {/* Refresh Results Modal */}
        <Modal
          visible={showRefreshResults}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRefreshResults(false)}
        >
          <View style={styles.resultsModalOverlay}>
            <View style={styles.resultsModalContainer}>
              <View style={styles.resultsModalHeader}>
                <Text style={styles.resultsModalTitle}>Metadata Refresh Results</Text>
                <Pressable onPress={() => setShowRefreshResults(false)} hitSlop={8}>
                  <X size={24} color={Colors.dark.text} />
                </Pressable>
              </View>

              <ScrollView style={styles.resultsScrollView}>
                {lastRefreshResults && lastRefreshResults.updatedSets.length > 0 && (
                  <View style={styles.resultsSection}>
                    <Text style={styles.resultsSectionTitle}>✅ Updated Sets ({lastRefreshResults.updatedSets.length})</Text>
                    {lastRefreshResults.updatedSets.map((item, index) => (
                      <View key={index} style={styles.resultItem}>
                        <Text style={styles.resultSetName} numberOfLines={1}>{item.setName}</Text>
                        <View style={styles.resultUpdates}>
                          {Object.entries(item.updates).map(([key, value]) => (
                            <Text key={key} style={styles.resultUpdateText}>
                              • {key}: {value}
                            </Text>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {lastRefreshResults && lastRefreshResults.failedSets.length > 0 && (
                  <View style={styles.resultsSection}>
                    <Text style={[styles.resultsSectionTitle, { color: '#EF4444' }]}>❌ Failed Sets ({lastRefreshResults.failedSets.length})</Text>
                    {lastRefreshResults.failedSets.map((item, index) => (
                      <View key={index} style={styles.resultItem}>
                        <Text style={styles.resultSetName} numberOfLines={1}>{item.setName}</Text>
                        <Text style={styles.resultErrorText}>{item.error}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {lastRefreshResults && lastRefreshResults.updatedSets.length === 0 && lastRefreshResults.failedSets.length === 0 && (
                  <Text style={styles.noResultsText}>No sets were updated or failed.</Text>
                )}
              </ScrollView>

              <Pressable style={styles.resultsCloseButton} onPress={() => setShowRefreshResults(false)}>
                <Text style={styles.resultsCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Admin Mode Bar */}
        {adminMode !== 'none' && (
          <View style={styles.adminModeBar}>
            <Text style={styles.adminModeText}>
              {adminMode === 'remove' ? 'Remove Mode - Tap sets to delete' :
               adminMode === 'edit' ? 'Edit Mode - Tap sets to edit' :
               'Badge Mode - Tap sets to change badges'}
            </Text>
            <Pressable style={styles.adminModeDoneButton} onPress={handleExitAdminMode}>
              <Text style={styles.adminModeDoneText}>Done</Text>
            </Pressable>
          </View>
        )}

        {/* Floating Clear Filter Button with spinning ring - shows when filter is open OR has active filters */}
        {(hasActiveFilters || showFilterDropdown) && (
          <ClearFilterFab onPress={handleClearAllFilters} bottom={totalTabBarHeight + 16} />
        )}

        {/* Quick Action Menu Modal */}
        <Modal
          visible={showQuickMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowQuickMenu(false)}
        >
          <Pressable
            style={styles.quickMenuOverlay}
            onPress={() => setShowQuickMenu(false)}
          >
            <View style={styles.quickMenuContainer}>
              {quickMenuSet && (
                <>
                  <View style={styles.quickMenuHeader}>
                    <Text style={styles.quickMenuTitle} numberOfLines={1}>
                      {quickMenuSet.name}
                    </Text>
                    <Text style={styles.quickMenuSubtitle} numberOfLines={1}>
                      {quickMenuSet.artist}
                    </Text>
                  </View>

                  <View style={styles.quickMenuActions}>
                    <Pressable
                      style={styles.quickMenuAction}
                      onPress={handleLikeSet}
                    >
                      <Heart
                        size={22}
                        color={likedSets.has(quickMenuSet.id) ? Colors.dark.primary : Colors.dark.text}
                        fill={likedSets.has(quickMenuSet.id) ? Colors.dark.primary : 'transparent'}
                      />
                      <Text style={styles.quickMenuActionText}>
                        {likedSets.has(quickMenuSet.id) ? 'Liked' : 'Like'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.quickMenuAction}
                      onPress={handleSaveSet}
                    >
                      <Bookmark
                        size={22}
                        color={savedSets.has(quickMenuSet.id) ? Colors.dark.primary : Colors.dark.text}
                        fill={savedSets.has(quickMenuSet.id) ? Colors.dark.primary : 'transparent'}
                      />
                      <Text style={styles.quickMenuActionText}>
                        {savedSets.has(quickMenuSet.id) ? 'Saved' : 'Save'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.quickMenuAction}
                      onPress={handleListenSet}
                    >
                      <Play size={22} color={Colors.dark.text} />
                      <Text style={styles.quickMenuActionText}>Listen</Text>
                    </Pressable>

                    <Pressable
                      style={styles.quickMenuAction}
                      onPress={handleShareSet}
                    >
                      <Share2 size={22} color={Colors.dark.text} />
                      <Text style={styles.quickMenuActionText}>Share</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    style={styles.quickMenuViewButton}
                    onPress={handleViewSet}
                  >
                    <ExternalLink size={16} color={Colors.dark.background} />
                    <Text style={styles.quickMenuViewButtonText}>View Full Set</Text>
                  </Pressable>
                </>
              )}
            </View>
          </Pressable>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
  },
  headerSpacer: {
    width: 44,
    alignItems: 'flex-end',
  },
  hiddenTapArea: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Vinyl-style button with spinning ring
  vinylButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylGroove1: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.25)',
  },
  vinylGroove2: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.35)',
  },
  vinylGroove3: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.45)',
  },
  vinylSpinCircle: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: Colors.dark.primary,
    borderRightColor: 'rgba(196, 30, 58, 0.5)',
  },
  vinylCenter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    marginHorizontal: 20,
    marginBottom: 14,
    paddingHorizontal: 14,
    borderRadius: 24,
    height: 42,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue' : undefined,
    color: '#F5E6D3',
    letterSpacing: 0.3,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 14,
    gap: 8,
  },
  activeEventFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  activeEventFilterLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  activeEventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(196, 30, 58, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.3)',
  },
  activeEventText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
    letterSpacing: 0.2,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipActive: {
    backgroundColor: Colors.dark.primary,
    borderColor: 'rgba(196, 30, 58, 0.6)',
    borderTopColor: 'rgba(255, 100, 120, 0.3)',
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  filterText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-Bold' : undefined,
    fontWeight: '700' as const,
    color: 'rgba(245, 230, 211, 0.7)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  filterTextActive: {
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // paddingTop and paddingBottom are applied dynamically via onLayout
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  loadingState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterButtonActive: {
    backgroundColor: Colors.dark.primary,
    borderColor: 'rgba(196, 30, 58, 0.6)',
    borderTopColor: 'rgba(255, 100, 120, 0.3)',
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  filterButtonText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-Bold' : undefined,
    fontWeight: '700' as const,
    color: 'rgba(245, 230, 211, 0.7)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  filterDropdown: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(20, 20, 22, 0.85)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  identifiedFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  identifiedFilterLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  identifiedToggleGroup: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    padding: 2,
  },
  identifiedToggle: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  identifiedToggleActive: {
    backgroundColor: Colors.dark.primary,
  },
  identifiedToggleText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.dark.textMuted,
  },
  identifiedToggleTextActive: {
    color: Colors.dark.background,
  },
  needsSourceToggle: {
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  needsSourceToggleActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  needsSourceToggleTextActive: {
    color: '#fff',
  },
  topToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  trakdToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(184, 134, 11, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(184, 134, 11, 0.25)',
  },
  genresToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(196, 30, 58, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(196, 30, 58, 0.25)',
  },
  genresToggleText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: Colors.dark.primary,
    letterSpacing: 0.3,
  },
  trakdToggleBtnActive: {
    backgroundColor: '#B8860B',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 223, 120, 0.5)',
    borderTopColor: 'rgba(255, 235, 150, 0.6)',
    borderBottomColor: '#8B6508',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  trakdToggleText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: '#B8860B',
    letterSpacing: 0.3,
  },
  trakdToggleTextActive: {
    color: '#FFF8E1',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  filterSectionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterSectionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: Colors.dark.background,
  },
  filterSectionBtnActive: {
    backgroundColor: Colors.dark.primary,
  },
  filterSectionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  filterSectionBtnTextActive: {
    color: Colors.dark.background,
  },
  expandedSection: {
    marginTop: 12,
  },
  filterSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    height: 36,
  },
  filterSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: Colors.dark.text,
  },
  filterOptionsList: {
    maxHeight: 120,
  },
  noResultsText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontStyle: 'italic',
  },
  filterOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterOptionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.dark.background,
  },
  filterOptionChipSelected: {
    backgroundColor: Colors.dark.primary,
  },
  filterOptionChipText: {
    fontSize: 12,
    color: Colors.dark.text,
    fontWeight: '500',
  },
  filterOptionChipTextSelected: {
    color: Colors.dark.background,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingVertical: 8,
  },
  clearFiltersBtnText: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '500',
  },
  // Admin Menu styles
  adminModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  adminMenuContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  adminMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  adminMenuTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginLeft: 10,
  },
  adminMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: Colors.dark.surfaceLight,
  },
  adminMenuItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  adminMenuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  adminMenuItemDesc: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  // Admin Mode Bar
  adminModeBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 34, // Account for bottom safe area
  },
  adminModeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  adminModeDoneButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  adminModeDoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  // Admin Menu Highlight for results button
  adminMenuItemHighlight: {
    backgroundColor: 'rgba(196, 30, 58, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.3)',
  },
  // Refresh Results Modal styles
  resultsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resultsModalContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  resultsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceLight,
  },
  resultsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  resultsScrollView: {
    padding: 16,
    maxHeight: 400,
  },
  resultsSection: {
    marginBottom: 20,
  },
  resultsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  resultItem: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  resultSetName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 6,
  },
  resultUpdates: {
    gap: 2,
  },
  resultUpdateText: {
    fontSize: 12,
    color: Colors.dark.primary,
    lineHeight: 18,
  },
  resultErrorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  resultsCloseButton: {
    backgroundColor: Colors.dark.primary,
    margin: 16,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  resultsCloseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  // Floating Clear Filter Button - bottom left with grooves and pulse
  clearFilterFab: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  clearFilterGroove1: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.25)',
  },
  clearFilterGroove2: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.35)',
  },
  clearFilterGroove3: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(196, 30, 58, 0.45)',
  },
  clearFilterSpinCircle: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: Colors.dark.primary,
    borderRightColor: 'rgba(196, 30, 58, 0.5)',
  },
  clearFilterInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Quick Action Menu styles
  quickMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  quickMenuContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  quickMenuHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  quickMenuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  quickMenuSubtitle: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  quickMenuActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  quickMenuAction: {
    alignItems: 'center',
    padding: 12,
    minWidth: 60,
  },
  quickMenuActionText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 6,
    fontWeight: '500',
  },
  quickMenuViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  quickMenuViewButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.background,
  },
});
