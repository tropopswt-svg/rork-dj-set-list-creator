import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, ActivityIndicator, Animated, Alert, Modal, GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Link2, TrendingUp, Clock, Filter, ChevronDown, ChevronUp, X, User, Calendar, MapPin, Sparkles, Trash2, Edit3, RefreshCw, Tag, Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import SetFeedCard from '@/components/SetFeedCard';
import AnimatedSetCard, { CARD_HEIGHT } from '@/components/AnimatedSetCard';
import IDentifiedLogo from '@/components/IDentifiedLogo';
import ImportSetModal from '@/components/ImportSetModal';
import { mockSetLists } from '@/mocks/tracks';
import { SetList } from '@/types';
import { useDebounce } from '@/utils/hooks';
import { ImportResult } from '@/services/importService';
import { useSets } from '@/contexts/SetsContext';
import { detectEvent, getEventLabel } from '@/components/EventBadge';

// Offset to shift the "center" down - moves the "selected" card to thumb position
// Higher value = center point lower on screen
const CENTER_OFFSET = 107;

// API base URL
const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

type FilterType = 'trending' | 'recent';

interface Filters {
  artists: string[];
  years: string[];
  countries: string[];
  identified: 'all' | 'identified' | 'unidentified' | 'needs-source';
  eventId: string | null; // Filter by event/venue badge
}

// Extract country from location string (last part after comma)
const extractCountry = (name: string): string | null => {
  const atMatch = name.match(/@\s*(.+)$/);
  if (atMatch) {
    const parts = atMatch[1].split(',').map(p => p.trim());
    if (parts.length >= 2) {
      // Remove any date from the end
      let country = parts[parts.length - 1];
      country = country.replace(/\s*\d{4}-\d{2}-\d{2}\s*$/, '').trim();
      if (country && country.length > 1) return country;
    }
  }
  return null;
};

// Extract year from date
const extractYear = (date: Date | string): string => {
  const d = new Date(date);
  return d.getFullYear().toString();
};

export default function DiscoverScreen() {
  const router = useRouter();
  const { refreshSetsMetadata } = useSets();
  const [setLists, setSetLists] = useState<SetList[]>([]);
  const [dbSets, setDbSets] = useState<SetList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [expandedFilter, setExpandedFilter] = useState<'artists' | 'years' | 'countries' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const lastCenteredIndex = useRef(-1);
  const lastHapticTime = useRef(0);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeFilter, setActiveFilter] = useState<FilterType>('recent');
  const [refreshing, setRefreshing] = useState(false);
  const [dbStats, setDbStats] = useState({ sets: 0, tracks: 0 });
  const [selectedFilters, setSelectedFilters] = useState<Filters>({
    artists: [],
    years: [],
    countries: [],
    identified: 'all',
    eventId: null,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Hidden admin menu - tap 2 times, then hold to open
  const hiddenTapCount = useRef(0);
  const hiddenTapTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
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

  // Handle press in - start long press detection after 2 taps
  const handleHiddenPressIn = useCallback(() => {
    console.log('[Admin] Press in, tap count:', hiddenTapCount.current);

    // If we've tapped twice, start long press timer
    if (hiddenTapCount.current >= 2) {
      console.log('[Admin] Starting long press detection...');
      longPressTimer.current = setTimeout(() => {
        console.log('[Admin] Long press triggered! Opening menu...');
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
    console.log('[Admin] Tap count:', hiddenTapCount.current);

    // Light haptic on each tap
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Reset timer on each tap
    if (hiddenTapTimer.current) {
      clearTimeout(hiddenTapTimer.current);
    }

    // Reset count after 2 seconds of no activity
    hiddenTapTimer.current = setTimeout(() => {
      console.log('[Admin] Resetting tap count');
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
      console.log('[Admin] Starting metadata refresh...');
      const result = await refreshSetsMetadata();
      console.log('[Admin] Refresh complete:', result);

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
      console.error('[Admin] Refresh error:', error);
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

  // Fetch sets from database
  const fetchSets = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sets?limit=50&sort=${activeFilter === 'trending' ? 'popular' : 'recent'}`);
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
          coverUrl: set.coverUrl || 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400',
          plays: set.trackCount * 10, // Estimate plays from track count
          tracks: [],
          sourceLinks: set.sourceLinks || [],
          trackCount: set.trackCount,
          source: 'database',
        }));
        setDbSets(transformedSets);
        setDbStats({ sets: data.total || transformedSets.length, tracks: 0 });
        console.log('[Discover] Loaded', transformedSets.length, 'sets from database');
      }
    } catch (error) {
      console.error('[Discover] Failed to fetch sets:', error);
      // Fallback to mock data if API fails
      setDbSets([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter]);

  // Load sets on mount and when filter changes
  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  // Combine database sets with any local/mock sets
  useEffect(() => {
    // Prioritize database sets, add mock sets as fallback demos
    const combined = [...dbSets];
    // Only add mock sets if we have no database sets
    if (combined.length === 0) {
      combined.push(...mockSetLists);
    }
    setSetLists(combined);
  }, [dbSets]);

  // Haptic feedback when scrolling through cards - strong feedback on each card
  useEffect(() => {
    const HAPTIC_THROTTLE_MS = 60; // Slightly faster for responsive feel

    const listenerId = scrollY.addListener(({ value }) => {
      // Calculate which card is currently centered (adjusted for CENTER_OFFSET)
      const centeredIndex = Math.round((value + CENTER_OFFSET) / CARD_HEIGHT);
      const now = Date.now();

      // Update selected index immediately for responsive visual feedback
      if (centeredIndex !== lastCenteredIndex.current && centeredIndex >= 0) {
        lastCenteredIndex.current = centeredIndex;
        setSelectedIndex(centeredIndex);

        // Trigger haptic with throttle for smooth feel
        if (now - lastHapticTime.current > HAPTIC_THROTTLE_MS) {
          lastHapticTime.current = now;
          // Medium impact - noticeable "click" as you scroll through each set
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
    });

    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [scrollY]);

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

  // Extract unique filter options from sets
  const filterOptions = useMemo(() => {
    const artists = new Set<string>();
    const years = new Set<string>();
    const countries = new Set<string>();

    setLists.forEach(set => {
      if (set.artist) artists.add(set.artist);
      if (set.date) years.add(extractYear(set.date));
      const country = extractCountry(set.name);
      if (country) countries.add(country);
    });

    return {
      artists: Array.from(artists).sort(),
      years: Array.from(years).sort((a, b) => b.localeCompare(a)), // Newest first
      countries: Array.from(countries).sort(),
    };
  }, [setLists]);

  const activeFilterCount = selectedFilters.artists.length + selectedFilters.years.length + selectedFilters.countries.length + (selectedFilters.identified !== 'all' ? 1 : 0);

  // Check if a set has been IDentified (analyzed via YouTube/SoundCloud)
  const isSetIdentified = (set: SetList): boolean => {
    // Check if set has YouTube or SoundCloud sources
    const hasAnalyzableSource = set.sourceLinks?.some(
      link => link.platform === 'youtube' || link.platform === 'soundcloud'
    );
    // Check if it's been AI processed or has tracks with timestamps
    const hasBeenAnalyzed = set.aiProcessed || (set.tracksIdentified && set.tracksIdentified > 0);
    return hasAnalyzableSource && hasBeenAnalyzed;
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

        // IDentified / Source filter
        if (selectedFilters.identified !== 'all') {
          if (selectedFilters.identified === 'needs-source') {
            if (!setNeedsSource(set)) return false;
          } else {
            const identified = isSetIdentified(set);
            if (selectedFilters.identified === 'identified' && !identified) return false;
            if (selectedFilters.identified === 'unidentified' && identified) return false;
          }
        }

        // Artist filter
        if (selectedFilters.artists.length > 0) {
          if (!selectedFilters.artists.includes(set.artist)) return false;
        }

        // Year filter
        if (selectedFilters.years.length > 0) {
          const setYear = extractYear(set.date);
          if (!selectedFilters.years.includes(setYear)) return false;
        }

        // Country filter
        if (selectedFilters.countries.length > 0) {
          const country = extractCountry(set.name);
          if (!country || !selectedFilters.countries.includes(country)) return false;
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
  const middleIndex = Math.floor(filteredSets.length / 2);
  const initialScrollOffset = Math.max(0, middleIndex * CARD_HEIGHT - CENTER_OFFSET);

  // Calculate snap positions - each card should snap when it's in the "centered" (raised) position
  const snapOffsets = useMemo(() => {
    const offsets: number[] = [];
    filteredSets.forEach((_, index) => {
      // Position where this card is centered/raised
      const offset = index * CARD_HEIGHT - CENTER_OFFSET;
      if (offset >= 0) {
        offsets.push(offset);
      }
    });
    // Add 0 as first snap point if not already there
    if (offsets.length === 0 || offsets[0] !== 0) {
      offsets.unshift(0);
    }
    return offsets;
  }, [filteredSets.length]);

  // Set scroll position to middle when data loads
  const filteredSetKey = useMemo(() => filteredSets.map(s => s.id).join(','), [filteredSets]);

  useEffect(() => {
    if (filteredSets.length > 0 && scrollViewRef.current) {
      // Small delay to ensure layout is complete
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: initialScrollOffset, animated: false });
      }, 100);
    }
  }, [filteredSetKey, initialScrollOffset]);

  const toggleFilter = (type: keyof Filters, value: string) => {
    setSelectedFilters(prev => {
      const current = prev[type];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [type]: updated };
    });
  };

  const clearFilters = () => {
    setSelectedFilters({ artists: [], years: [], countries: [], identified: 'all' });
  };

  const toggleFilterDropdown = () => {
    Haptics.selectionAsync();
    const toValue = showFilterDropdown ? 0 : 1;
    setShowFilterDropdown(!showFilterDropdown);
    Animated.timing(dropdownAnim, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
    if (showFilterDropdown) {
      setExpandedFilter(null);
    }
  };

  const toggleFilterSection = (section: 'artists' | 'years' | 'countries') => {
    Haptics.selectionAsync();
    setFilterSearch('');
    setExpandedFilter(expandedFilter === section ? null : section);
  };

  // Filter options based on search
  const getFilteredOptions = (type: 'artists' | 'years' | 'countries') => {
    const options = filterOptions[type];
    if (!filterSearch || type === 'years') return options;
    const search = filterSearch.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(search));
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          {/* Hidden admin button - tap 2 times, then hold */}
          <Pressable
            style={styles.hiddenTapArea}
            onPress={handleHiddenTap}
            onPressIn={handleHiddenPressIn}
            onPressOut={handleHiddenPressOut}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            {isRefreshingMetadata && (
              <ActivityIndicator size="small" color={Colors.dark.primary} />
            )}
          </Pressable>
          <IDentifiedLogo />
          <View style={styles.headerSpacer}>
            <Pressable 
              style={styles.addButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowImportModal(true);
              }}
            >
              <Link2 size={18} color={Colors.dark.background} />
            </Pressable>
          </View>
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
            <Filter size={14} color={(showFilterDropdown || activeFilterCount > 0) ? Colors.dark.background : Colors.dark.primary} />
            <Text style={[styles.filterButtonText, (showFilterDropdown || activeFilterCount > 0) && styles.filterButtonTextActive]}>
              {activeFilterCount > 0 ? `${filteredSets.length} of ${dbStats.sets}` : `${dbStats.sets} sets`}
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
          <Animated.View style={[styles.filterDropdown]}>
            {/* IDentified toggle */}
            <View style={styles.identifiedFilterRow}>
              <Sparkles size={14} color={Colors.dark.primary} />
              <Text style={styles.identifiedFilterLabel}>Status:</Text>
              <View style={styles.identifiedToggleGroup}>
                <Pressable
                  style={[
                    styles.identifiedToggle,
                    selectedFilters.identified === 'all' && styles.identifiedToggleActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedFilters(prev => ({ ...prev, identified: 'all' }));
                  }}
                >
                  <Text style={[
                    styles.identifiedToggleText,
                    selectedFilters.identified === 'all' && styles.identifiedToggleTextActive,
                  ]}>All</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.identifiedToggle,
                    selectedFilters.identified === 'identified' && styles.identifiedToggleActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedFilters(prev => ({ ...prev, identified: 'identified' }));
                  }}
                >
                  <Text style={[
                    styles.identifiedToggleText,
                    selectedFilters.identified === 'identified' && styles.identifiedToggleTextActive,
                  ]}>IDentified</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.identifiedToggle,
                    selectedFilters.identified === 'unidentified' && styles.identifiedToggleActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedFilters(prev => ({ ...prev, identified: 'unidentified' }));
                  }}
                >
                  <Text style={[
                    styles.identifiedToggleText,
                    selectedFilters.identified === 'unidentified' && styles.identifiedToggleTextActive,
                  ]}>Unanalyzed</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.identifiedToggle,
                    styles.needsSourceToggle,
                    selectedFilters.identified === 'needs-source' && styles.needsSourceToggleActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedFilters(prev => ({ ...prev, identified: 'needs-source' }));
                  }}
                >
                  <Text style={[
                    styles.identifiedToggleText,
                    selectedFilters.identified === 'needs-source' && styles.needsSourceToggleTextActive,
                  ]}>Needs Source</Text>
                </Pressable>
              </View>
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
                style={[styles.filterSectionBtn, expandedFilter === 'countries' && styles.filterSectionBtnActive]}
                onPress={() => toggleFilterSection('countries')}
              >
                <MapPin size={14} color={expandedFilter === 'countries' ? Colors.dark.background : Colors.dark.text} />
                <Text style={[styles.filterSectionBtnText, expandedFilter === 'countries' && styles.filterSectionBtnTextActive]}>
                  Country {selectedFilters.countries.length > 0 && `(${selectedFilters.countries.length})`}
                </Text>
                <ChevronDown size={12} color={expandedFilter === 'countries' ? Colors.dark.background : Colors.dark.textMuted} />
              </Pressable>
            </View>

            {/* Expanded filter options */}
            {expandedFilter && (
              <View style={styles.expandedSection}>
                {/* Search input for artists and countries */}
                {(expandedFilter === 'artists' || expandedFilter === 'countries') && (
                  <View style={styles.filterSearchContainer}>
                    <Search size={14} color={Colors.dark.textMuted} />
                    <TextInput
                      style={styles.filterSearchInput}
                      placeholder={`Search ${expandedFilter === 'artists' ? 'artists' : 'countries'}...`}
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
          </Animated.View>
        )}

        <Animated.ScrollView
          ref={scrollViewRef as any}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          snapToOffsets={snapOffsets}
          decelerationRate={0.985}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.dark.primary}
            />
          }
        >
          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={Colors.dark.primary} />
              <Text style={styles.loadingText}>Loading sets...</Text>
            </View>
          ) : (
            <>
              {filteredSets.map((setList, index) => (
                <AnimatedSetCard
                  key={setList.id}
                  setList={setList}
                  index={index}
                  scrollY={scrollY}
                  centerOffset={CENTER_OFFSET}
                  isSelected={index === selectedIndex}
                  onPress={() => router.push(`/(tabs)/(discover)/${setList.id}`)}
                  onArtistPress={(artist) => {
                    const slug = artist.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').trim();
                    router.push(`/(tabs)/(discover)/artist/${slug}`);
                  }}
                  onEventPress={handleEventFilter}
                />
              ))}

              {filteredSets.length === 0 && (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Search size={32} color={Colors.dark.textMuted} />
                  </View>
                  <Text style={styles.emptyTitle}>No sets found</Text>
                  <Text style={styles.emptySubtitle}>
                    Try a different search or import a new set
                  </Text>
                </View>
              )}
            </>
          )}
        </Animated.ScrollView>

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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    height: 46,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: Colors.dark.text,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
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
    backgroundColor: 'rgba(226, 29, 72, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  activeEventText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  filterText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.dark.textSecondary,
  },
  filterTextActive: {
    color: Colors.dark.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
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
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: Colors.dark.text,
    fontWeight: '700' as const,
  },
  filterButtonTextActive: {
    color: Colors.dark.background,
  },
  filterDropdown: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    backgroundColor: 'rgba(226, 29, 72, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(226, 29, 72, 0.3)',
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
});
