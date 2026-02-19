import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Search,
  X,
  Filter,
  ChevronDown,
  Music,
  Users,
  CheckCircle,
  Headphones,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useFollowArtist } from '@/hooks/useSocial';
import { useRecommendedArtists } from '@/hooks/useRecommendations';
import {
  browseArtists,
  getArtistGenres,
  getPopularArtists,
  type ArtistSortOption,
} from '@/lib/supabase/artistService';
import type { DbArtist } from '@/lib/supabase/types';

// Spinning vinyl record component
function SpinningVinyl({ size = 56 }: { size?: number }) {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, []);

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const grooveCount = 3;
  const grooves = [];
  for (let i = 0; i < grooveCount; i++) {
    const grooveSize = size * (0.85 - i * 0.15);
    grooves.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          width: grooveSize,
          height: grooveSize,
          borderRadius: grooveSize / 2,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.3)',
        }}
      />
    );
  }

  return (
    <Animated.View
      style={[
        styles.vinylContainer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ rotate }],
        },
      ]}
    >
      {grooves}
      <View
        style={[
          styles.vinylLabel,
          {
            width: size * 0.35,
            height: size * 0.35,
            borderRadius: (size * 0.35) / 2,
          },
        ]}
      >
        <View
          style={[
            styles.vinylHole,
            {
              width: size * 0.08,
              height: size * 0.08,
              borderRadius: (size * 0.08) / 2,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

// Artist card component
function ArtistCard({ artist, onPress }: { artist: DbArtist; onPress: () => void }) {
  const { user } = useAuth();
  const { isFollowing, isLoading, toggleFollow } = useFollowArtist(artist.id);

  const handleFollow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleFollow();
  };

  return (
    <Pressable style={styles.artistCard} onPress={onPress}>
      {artist.image_url ? (
        <Image
          source={{ uri: artist.image_url }}
          style={styles.artistImage}
          contentFit="cover"
        />
      ) : (
        <SpinningVinyl size={56} />
      )}

      <View style={styles.artistInfo}>
        <View style={styles.artistNameRow}>
          <Text style={styles.artistName} numberOfLines={1}>
            {artist.name}
          </Text>
          {artist.verified && (
            <CheckCircle size={14} color={Colors.dark.primary} fill={Colors.dark.primary} />
          )}
        </View>

        {artist.genres && artist.genres.length > 0 && (
          <Text style={styles.artistGenres} numberOfLines={1}>
            {artist.genres.slice(0, 2).join(' • ')}
          </Text>
        )}

        <View style={styles.artistStats}>
          <View style={styles.statItem}>
            <Music size={12} color={Colors.dark.textMuted} />
            <Text style={styles.statText}>{artist.tracks_count || 0}</Text>
          </View>
          {(artist.followers_count ?? 0) > 0 && (
            <View style={styles.statItem}>
              <Users size={12} color={Colors.dark.textMuted} />
              <Text style={styles.statText}>{artist.followers_count}</Text>
            </View>
          )}
        </View>
      </View>

      {user && (
        <Pressable
          style={[styles.followButton, isFollowing && styles.followingButton]}
          onPress={handleFollow}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={isFollowing ? Colors.dark.primary : '#fff'} />
          ) : (
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          )}
        </Pressable>
      )}
    </Pressable>
  );
}

type SortOption = {
  label: string;
  value: ArtistSortOption;
  order: 'asc' | 'desc';
};

const SORT_OPTIONS: SortOption[] = [
  { label: 'Name (A-Z)', value: 'name', order: 'asc' },
  { label: 'Name (Z-A)', value: 'name', order: 'desc' },
  { label: 'Most Tracks', value: 'tracks_count', order: 'desc' },
  { label: 'Most Followers', value: 'followers_count', order: 'desc' },
  { label: 'Recently Added', value: 'created_at', order: 'desc' },
];

export default function ArtistsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // State
  const [artists, setArtists] = useState<DbArtist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS[0]);
  const [genres, setGenres] = useState<string[]>([]);

  // Modals
  const [showSortModal, setShowSortModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Recommended artists
  const { artists: recommendedArtists } = useRecommendedArtists(5);

  const PAGE_SIZE = 20;

  // Load genres on mount
  useEffect(() => {
    loadGenres();
  }, []);

  const loadGenres = async () => {
    const genreList = await getArtistGenres();
    setGenres(genreList);
  };

  // Load artists
  const loadArtists = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
      setOffset(0);
    } else if (!refresh && offset === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    const currentOffset = refresh ? 0 : offset;

    const { data, count } = await browseArtists({
      limit: PAGE_SIZE,
      offset: currentOffset,
      search: searchQuery.length >= 2 ? searchQuery : undefined,
      genre: selectedGenre || undefined,
      sortBy: sortOption.value,
      sortOrder: sortOption.order,
    });

    if (refresh || currentOffset === 0) {
      setArtists(data);
    } else {
      setArtists(prev => [...prev, ...data]);
    }

    setTotalCount(count);
    setHasMore(data.length === PAGE_SIZE);
    setOffset(currentOffset + data.length);
    setIsLoading(false);
    setIsLoadingMore(false);
    setIsRefreshing(false);
  }, [searchQuery, selectedGenre, sortOption, offset]);

  // Initial load and reload on filter changes
  useEffect(() => {
    loadArtists(true);
  }, [searchQuery, selectedGenre, sortOption]);

  const handleRefresh = () => loadArtists(true);

  const handleLoadMore = () => {
    if (!isLoading && !isLoadingMore && hasMore) {
      loadArtists(false);
    }
  };

  const handleArtistPress = (artist: DbArtist) => {
    Haptics.selectionAsync();
    router.push(`/(tabs)/(discover)/artist/${artist.slug}`);
  };

  const clearSearch = () => {
    setSearchQuery('');
    Haptics.selectionAsync();
  };

  const clearFilters = () => {
    setSelectedGenre(null);
    setSortOption(SORT_OPTIONS[0]);
    Haptics.selectionAsync();
  };

  const hasActiveFilters = selectedGenre !== null || sortOption !== SORT_OPTIONS[0];

  const renderHeader = () => (
    <View>
      {/* Recommended Artists (only show if not searching/filtering) */}
      {!searchQuery && !selectedGenre && recommendedArtists.length > 0 && isAuthenticated && (
        <View style={styles.recommendedSection}>
          <Text style={styles.sectionTitle}>Recommended For You</Text>
          <FlatList
            horizontal
            data={recommendedArtists}
            keyExtractor={(item) => item.artist_id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recommendedList}
            renderItem={({ item }) => (
              <Pressable
                style={styles.recommendedCard}
                onPress={() => router.push(`/(tabs)/(discover)/artist/${item.artist_slug}`)}
              >
                <Image
                  source={{ uri: item.artist_image_url || undefined }}
                  style={styles.recommendedImage}
                  contentFit="cover"
                />
                <Text style={styles.recommendedName} numberOfLines={1}>
                  {item.artist_name}
                </Text>
                <Text style={styles.recommendedReason} numberOfLines={1}>
                  {item.reason}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}

      {/* Results count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {totalCount} artist{totalCount !== 1 ? 's' : ''}
          {searchQuery && ` for "${searchQuery}"`}
          {selectedGenre && ` in ${selectedGenre}`}
        </Text>
        {hasActiveFilters && (
          <Pressable onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>Clear filters</Text>
          </Pressable>
        )}
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
        <Headphones size={48} color={Colors.dark.textMuted} />
        <Text style={styles.emptyTitle}>No artists found</Text>
        <Text style={styles.emptyText}>
          {searchQuery
            ? 'Try a different search term'
            : selectedGenre
            ? 'No artists in this genre yet'
            : 'No artists available'}
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
                style={[styles.headerToggleButton, styles.headerToggleButtonActive]}
                onPress={() => {}}
              >
                <Text style={[styles.headerToggleText, styles.headerToggleTextActive]}>Artists</Text>
              </Pressable>
              <Pressable
                style={styles.headerToggleButton}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.replace('/(tabs)/(feed)/venues');
                }}
              >
                <Text style={styles.headerToggleText}>Venues</Text>
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
              placeholder="Search artists..."
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
          {/* Sort Chip */}
          <Pressable
            style={styles.chip}
            onPress={() => {
              Haptics.selectionAsync();
              setShowSortModal(true);
            }}
          >
            <Text style={styles.chipText}>{sortOption.label}</Text>
            <ChevronDown size={14} color={Colors.dark.textMuted} />
          </Pressable>

          {/* Genre Chips */}
          <Pressable
            style={[styles.chip, !selectedGenre && styles.chipActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedGenre(null);
            }}
          >
            <Text style={[styles.chipText, !selectedGenre && styles.chipTextActive]}>All</Text>
          </Pressable>

          {genres.slice(0, 15).map((genre) => (
            <Pressable
              key={genre}
              style={[styles.chip, selectedGenre === genre && styles.chipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedGenre(selectedGenre === genre ? null : genre);
              }}
            >
              <Text style={[styles.chipText, selectedGenre === genre && styles.chipTextActive]}>
                {genre}
              </Text>
            </Pressable>
          ))}

          {genres.length > 15 && (
            <Pressable
              style={styles.chip}
              onPress={() => {
                Haptics.selectionAsync();
                setShowFilterModal(true);
              }}
            >
              <Filter size={14} color={Colors.dark.textMuted} />
              <Text style={styles.chipText}>More</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Artists List */}
        {isLoading && artists.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : (
          <FlatList
            data={artists}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ArtistCard artist={item} onPress={() => handleArtistPress(item)} />
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

        {/* Sort Modal */}
        <Modal
          visible={showSortModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowSortModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort By</Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowSortModal(false)}
              >
                <X size={24} color={Colors.dark.text} />
              </Pressable>
            </View>
            <View style={styles.modalContent}>
              {SORT_OPTIONS.map((option) => (
                <Pressable
                  key={`${option.value}-${option.order}`}
                  style={[
                    styles.modalOption,
                    sortOption === option && styles.modalOptionActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSortOption(option);
                    setShowSortModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      sortOption === option && styles.modalOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {sortOption === option && (
                    <CheckCircle size={20} color={Colors.dark.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>

        {/* Genre Filter Modal */}
        <Modal
          visible={showFilterModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowFilterModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Genre</Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowFilterModal(false)}
              >
                <X size={24} color={Colors.dark.text} />
              </Pressable>
            </View>
            <View style={styles.modalContent}>
              <Pressable
                style={[
                  styles.modalOption,
                  !selectedGenre && styles.modalOptionActive,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedGenre(null);
                  setShowFilterModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    !selectedGenre && styles.modalOptionTextActive,
                  ]}
                >
                  All Genres
                </Text>
                {!selectedGenre && <CheckCircle size={20} color={Colors.dark.primary} />}
              </Pressable>

              {genres.map((genre) => (
                <Pressable
                  key={genre}
                  style={[
                    styles.modalOption,
                    selectedGenre === genre && styles.modalOptionActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedGenre(genre);
                    setShowFilterModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      selectedGenre === genre && styles.modalOptionTextActive,
                    ]}
                  >
                    {genre}
                  </Text>
                  {selectedGenre === genre && (
                    <CheckCircle size={20} color={Colors.dark.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>
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
  recommendedSection: {
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
  recommendedList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  recommendedCard: {
    width: 120,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  recommendedImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
    backgroundColor: Colors.dark.surfaceLight,
  },
  recommendedName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
    textAlign: 'center',
  },
  recommendedReason: {
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
  clearFiltersText: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: '500',
  },
  artistCard: {
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
  artistImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.surfaceLight,
  },
  vinylContainer: {
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  vinylLabel: {
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylHole: {
    backgroundColor: '#1a1a1a',
  },
  artistInfo: {
    flex: 1,
    marginLeft: 12,
  },
  artistNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  artistName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  artistGenres: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  artistStats: {
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
  followButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  followingButton: {
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  followButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  followingButtonText: {
    color: Colors.dark.primary,
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
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: 16,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  modalOptionActive: {
    backgroundColor: `${Colors.dark.primary}10`,
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.dark.text,
  },
  modalOptionTextActive: {
    color: Colors.dark.primary,
    fontWeight: '600',
  },
});
