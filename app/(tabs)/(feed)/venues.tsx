import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Search,
  X,
  ChevronDown,
  MapPin,
  Music,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import {
  browseVenues,
  getPopularVenues,
  getTopVenues,
  type VenueInfo,
  type VenueSortOption,
} from '@/lib/supabase/venueService';

// Venue card component
function VenueCard({ venue, onPress }: { venue: VenueInfo; onPress: () => void }) {
  return (
    <Pressable style={styles.venueCard} onPress={onPress}>
      {venue.imageUrl ? (
        <Image
          source={{ uri: venue.imageUrl }}
          style={styles.venueImage}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.venueImage, styles.venueImagePlaceholder]}>
          <MapPin size={24} color={Colors.dark.textMuted} />
        </View>
      )}

      <View style={styles.venueInfo}>
        <Text style={styles.venueName} numberOfLines={1}>
          {venue.name}
        </Text>

        {venue.location && (
          <Text style={styles.venueLocation} numberOfLines={1}>
            {venue.location}
          </Text>
        )}

        <View style={styles.venueStats}>
          <View style={styles.statItem}>
            <Music size={12} color={Colors.dark.textMuted} />
            <Text style={styles.statText}>{venue.setsCount} sets</Text>
          </View>
        </View>
      </View>

      <ChevronDown
        size={20}
        color={Colors.dark.textMuted}
        style={{ transform: [{ rotate: '-90deg' }] }}
      />
    </Pressable>
  );
}

type SortOption = {
  label: string;
  value: VenueSortOption;
  order: 'asc' | 'desc';
};

const SORT_OPTIONS: SortOption[] = [
  { label: 'Most Sets', value: 'sets_count', order: 'desc' },
  { label: 'Name (A-Z)', value: 'name', order: 'asc' },
  { label: 'Name (Z-A)', value: 'name', order: 'desc' },
  { label: 'Recently Active', value: 'recent', order: 'desc' },
];

export default function VenuesScreen() {
  const router = useRouter();

  // State
  const [venues, setVenues] = useState<VenueInfo[]>([]);
  const [popularVenues, setPopularVenues] = useState<VenueInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS[0]);

  const PAGE_SIZE = 20;

  // Load popular venues on mount
  useEffect(() => {
    loadPopularVenues();
  }, []);

  const loadPopularVenues = async () => {
    const data = await getPopularVenues(5);
    setPopularVenues(data);
  };

  // Whether we're in the default "top 100" view (no search, default sort)
  const isDefaultView = searchQuery.length < 2 && sortOption === SORT_OPTIONS[0];

  // Load venues
  const loadVenues = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
      setOffset(0);
    } else if (!refresh && offset === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    // Default view: show top 100 venues sorted A-Z
    if (isDefaultView) {
      const top = await getTopVenues(100);
      setVenues(top);
      setTotalCount(top.length);
      setHasMore(false);
      setOffset(top.length);
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
      return;
    }

    const currentOffset = refresh ? 0 : offset;

    const { data, count } = await browseVenues({
      limit: PAGE_SIZE,
      offset: currentOffset,
      search: searchQuery.length >= 2 ? searchQuery : undefined,
      sortBy: sortOption.value,
      sortOrder: sortOption.order,
    });

    if (refresh || currentOffset === 0) {
      setVenues(data);
    } else {
      setVenues(prev => [...prev, ...data]);
    }

    setTotalCount(count);
    setHasMore(data.length === PAGE_SIZE);
    setOffset(currentOffset + data.length);
    setIsLoading(false);
    setIsLoadingMore(false);
    setIsRefreshing(false);
  }, [searchQuery, sortOption, offset, isDefaultView]);

  // Initial load and reload on filter changes
  useEffect(() => {
    loadVenues(true);
  }, [searchQuery, sortOption]);

  const handleRefresh = () => loadVenues(true);

  const handleLoadMore = () => {
    if (!isLoading && !isLoadingMore && hasMore) {
      loadVenues(false);
    }
  };

  const handleVenuePress = (venue: VenueInfo) => {
    Haptics.selectionAsync();
    router.push({
      pathname: '/(tabs)/(feed)/venue/[name]',
      params: { name: venue.name },
    });
  };

  const clearSearch = () => {
    setSearchQuery('');
    Haptics.selectionAsync();
  };

  const renderHeader = () => (
    <View>
      {/* Popular Venues (only show if not searching) */}
      {!searchQuery && popularVenues.length > 0 && (
        <View style={styles.popularSection}>
          <Text style={styles.sectionTitle}>Popular Venues</Text>
          <FlatList
            horizontal
            data={popularVenues}
            keyExtractor={(item) => item.name}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.popularList}
            renderItem={({ item }) => (
              <Pressable
                style={styles.popularCard}
                onPress={() => handleVenuePress(item)}
              >
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.popularImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.popularImage, styles.popularImagePlaceholder]}>
                    <MapPin size={20} color={Colors.dark.textMuted} />
                  </View>
                )}
                <Text style={styles.popularName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.popularSets}>
                  {item.setsCount} sets
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}

      {/* Results count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {isDefaultView
            ? 'Top 100 Venues'
            : `${totalCount} venue${totalCount !== 1 ? 's' : ''}${searchQuery ? ` for "${searchQuery}"` : ''}`
          }
        </Text>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore) return null;
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator color={Colors.dark.primary} />
        </View>
      );
    }
    return null;
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <MapPin size={48} color={Colors.dark.textMuted} />
        <Text style={styles.emptyTitle}>No venues found</Text>
        <Text style={styles.emptyText}>
          {searchQuery
            ? 'Try a different search term'
            : 'No venues available yet'}
        </Text>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
          title: '',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={24} color={Colors.dark.text} />
            </Pressable>
          ),
          headerTitle: () => (
            <View style={styles.headerToggle}>
              <Pressable
                style={styles.headerToggleButton}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.replace('/(tabs)/(feed)/artists');
                }}
              >
                <Text style={styles.headerToggleText}>Artists</Text>
              </Pressable>
              <Pressable
                style={[styles.headerToggleButton, styles.headerToggleButtonActive]}
                onPress={() => {}}
              >
                <Text style={[styles.headerToggleText, styles.headerToggleTextActive]}>Venues</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search size={20} color={Colors.dark.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search venues..."
              placeholderTextColor={Colors.dark.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={clearSearch}>
                <X size={18} color={Colors.dark.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Horizontal Scrolling Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipContainer}
          style={styles.chipScrollView}
        >
          {SORT_OPTIONS.map((option) => (
            <Pressable
              key={`${option.value}-${option.order}`}
              style={[styles.chip, sortOption === option && styles.chipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSortOption(option);
              }}
            >
              <Text style={[styles.chipText, sortOption === option && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Venues List */}
        {isLoading && venues.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : (
          <FlatList
            data={venues}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => (
              <VenueCard venue={item} onPress={() => handleVenuePress(item)} />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.dark.primary}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmpty}
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  headerToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  headerToggleButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 58,
    alignItems: 'center',
  },
  headerToggleButtonActive: {
    backgroundColor: Colors.dark.primary,
  },
  headerToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  headerToggleTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.dark.text,
  },
  chipScrollView: {
    minHeight: 52,
    maxHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    height: 52,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    height: 36,
  },
  chipActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: `${Colors.dark.primary}15`,
  },
  chipText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.dark.primary,
  },
  listContent: {
    paddingBottom: 100,
  },
  popularSection: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.dark.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  popularList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  popularCard: {
    width: 120,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  popularImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: Colors.dark.surfaceLight,
  },
  popularImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
    textAlign: 'center',
  },
  popularSets: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsCount: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  venueImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceLight,
  },
  venueImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueInfo: {
    flex: 1,
    marginLeft: 12,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  venueLocation: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  venueStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
});
