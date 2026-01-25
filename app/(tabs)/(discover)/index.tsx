import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Link2, TrendingUp, Clock, Filter, ChevronDown, ChevronUp, X, User, Calendar, MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import SetFeedCard from '@/components/SetFeedCard';
import IDentifiedLogo from '@/components/IDentifiedLogo';
import ImportSetModal from '@/components/ImportSetModal';
import { mockSetLists } from '@/mocks/tracks';
import { SetList } from '@/types';
import { useDebounce } from '@/utils/hooks';
import { ImportResult } from '@/services/importService';

// API base URL
const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://rork-dj-set-list-creator.vercel.app';

type FilterType = 'trending' | 'recent';

interface Filters {
  artists: string[];
  years: string[];
  countries: string[];
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
  const [setLists, setSetLists] = useState<SetList[]>([]);
  const [dbSets, setDbSets] = useState<SetList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [expandedFilter, setExpandedFilter] = useState<'artists' | 'years' | 'countries' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeFilter, setActiveFilter] = useState<FilterType>('recent');
  const [refreshing, setRefreshing] = useState(false);
  const [dbStats, setDbStats] = useState({ sets: 0, tracks: 0 });
  const [selectedFilters, setSelectedFilters] = useState<Filters>({
    artists: [],
    years: [],
    countries: [],
  });

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

  const activeFilterCount = selectedFilters.artists.length + selectedFilters.years.length + selectedFilters.countries.length;

  const filteredSets = useMemo(() => {
    return setLists
      .filter(set => {
        // Search filter
        if (debouncedSearchQuery) {
          const query = debouncedSearchQuery.toLowerCase();
          const matchesSearch =
            set.name.toLowerCase().includes(query) ||
            set.artist.toLowerCase().includes(query) ||
            set.venue?.toLowerCase().includes(query);
          if (!matchesSearch) return false;
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

        return true;
      })
      .sort((a, b) => {
        if (activeFilter === 'trending') {
          return (b.plays || 0) - (a.plays || 0);
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [setLists, debouncedSearchQuery, activeFilter, selectedFilters]);

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
    setSelectedFilters({ artists: [], years: [], countries: [] });
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
    setExpandedFilter(expandedFilter === section ? null : section);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
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

        {/* Filter Dropdown */}
        {showFilterDropdown && (
          <Animated.View style={[styles.filterDropdown]}>
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
              <ScrollView style={styles.filterOptionsList} horizontal={false} showsVerticalScrollIndicator={true}>
                <View style={styles.filterOptionsWrap}>
                  {filterOptions[expandedFilter].map(option => (
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
                </View>
              </ScrollView>
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

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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
              {filteredSets.map(setList => (
                <SetFeedCard
                  key={setList.id}
                  setList={setList}
                  onPress={() => router.push(`/(tabs)/(discover)/${setList.id}`)}
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
        </ScrollView>

        <ImportSetModal
          visible={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
        />

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
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500' as const,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  filterButtonText: {
    fontSize: 12,
    color: Colors.dark.text,
    fontWeight: '600',
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
    paddingVertical: 10,
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
  filterOptionsList: {
    maxHeight: 150,
    marginTop: 12,
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
});
