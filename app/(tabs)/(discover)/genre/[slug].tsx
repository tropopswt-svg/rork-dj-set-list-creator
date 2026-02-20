import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Music, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import ArtistCard from '@/components/ArtistCard';
import { browseArtists, getSetsByGenre } from '@/lib/supabase/artistService';
import type { DbArtist } from '@/lib/supabase/types';

// Title case helper
function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
}

const PAGE_SIZE = 20;

export default function GenreDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const genre = slug ? decodeURIComponent(slug) : '';

  const [activeTab, setActiveTab] = useState<'sets' | 'artists'>('sets');

  // Sets state
  const [sets, setSets] = useState<any[]>([]);
  const [setsCount, setSetsCount] = useState(0);
  const [setsLoading, setSetsLoading] = useState(true);
  const [setsLoadingMore, setSetsLoadingMore] = useState(false);
  const [setsOffset, setSetsOffset] = useState(0);
  const [setsHasMore, setSetsHasMore] = useState(true);
  const [setsRefreshing, setSetsRefreshing] = useState(false);

  // Artists state
  const [artists, setArtists] = useState<DbArtist[]>([]);
  const [artistsCount, setArtistsCount] = useState(0);
  const [artistsLoading, setArtistsLoading] = useState(true);
  const [artistsLoadingMore, setArtistsLoadingMore] = useState(false);
  const [artistsOffset, setArtistsOffset] = useState(0);
  const [artistsHasMore, setArtistsHasMore] = useState(true);
  const [artistsRefreshing, setArtistsRefreshing] = useState(false);

  // Load sets
  const loadSets = useCallback(async (refresh = false) => {
    if (!genre) return;
    const offset = refresh ? 0 : setsOffset;

    if (refresh) {
      setSetsRefreshing(true);
    } else if (offset === 0) {
      setSetsLoading(true);
    } else {
      setSetsLoadingMore(true);
    }

    const { data, count } = await getSetsByGenre(genre, PAGE_SIZE, offset);

    if (refresh || offset === 0) {
      setSets(data);
    } else {
      setSets(prev => [...prev, ...data]);
    }

    setSetsCount(count);
    setSetsHasMore(data.length === PAGE_SIZE);
    setSetsOffset(offset + data.length);
    setSetsLoading(false);
    setSetsLoadingMore(false);
    setSetsRefreshing(false);
  }, [genre, setsOffset]);

  // Load artists
  const loadArtists = useCallback(async (refresh = false) => {
    if (!genre) return;
    const offset = refresh ? 0 : artistsOffset;

    if (refresh) {
      setArtistsRefreshing(true);
    } else if (offset === 0) {
      setArtistsLoading(true);
    } else {
      setArtistsLoadingMore(true);
    }

    const { data, count } = await browseArtists({
      genre: genre.toLowerCase(),
      limit: PAGE_SIZE,
      offset,
    });

    if (refresh || offset === 0) {
      setArtists(data);
    } else {
      setArtists(prev => [...prev, ...data]);
    }

    setArtistsCount(count);
    setArtistsHasMore(data.length === PAGE_SIZE);
    setArtistsOffset(offset + data.length);
    setArtistsLoading(false);
    setArtistsLoadingMore(false);
    setArtistsRefreshing(false);
  }, [genre, artistsOffset]);

  // Initial load
  useEffect(() => {
    loadSets(true);
    loadArtists(true);
  }, [genre]);

  const handleSetPress = (setId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/(discover)/${setId}`);
  };

  const handleArtistPress = (artist: DbArtist) => {
    Haptics.selectionAsync();
    router.push(`/(tabs)/(discover)/artist/${artist.slug}`);
  };

  const getCoverUrl = (set: any) => {
    if (set.cover_url) return set.cover_url;
    if (set.youtube_url) {
      const match = set.youtube_url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
      );
      if (match) return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
    }
    return undefined;
  };

  const renderSetItem = ({ item }: { item: any }) => (
    <Pressable
      style={({ pressed }) => [styles.setCard, pressed && styles.setCardPressed]}
      onPress={() => handleSetPress(item.id)}
    >
      {getCoverUrl(item) ? (
        <Image
          source={{ uri: getCoverUrl(item) }}
          style={styles.setCover}
          contentFit="cover"
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          transition={250}
        />
      ) : (
        <View style={[styles.setCover, styles.setCoverPlaceholder]}>
          <Music size={20} color={Colors.dark.textMuted} />
        </View>
      )}
      <View style={styles.setInfo}>
        <Text style={styles.setTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.setArtist} numberOfLines={1}>
          {item.dj_name || 'Unknown Artist'}
        </Text>
        <Text style={styles.setMeta}>
          {item.track_count || 0} tracks
          {item.venue ? ` · ${item.venue}` : ''}
        </Text>
      </View>
    </Pressable>
  );

  const renderArtistItem = ({ item }: { item: DbArtist }) => (
    <ArtistCard artist={item} onPress={() => handleArtistPress(item)} />
  );

  const renderSetsFooter = () => {
    if (!setsHasMore || !setsLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={Colors.dark.primary} />
      </View>
    );
  };

  const renderArtistsFooter = () => {
    if (!artistsHasMore || !artistsLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={Colors.dark.primary} />
      </View>
    );
  };

  const isCurrentTabLoading = activeTab === 'sets' ? setsLoading : artistsLoading;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <LinearGradient
        colors={['rgba(196,30,58,0.12)', 'rgba(196,30,58,0.04)', Colors.dark.background]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={Colors.dark.text} />
          </Pressable>

          <Text style={styles.genreTitle}>{toTitleCase(genre)}</Text>
          <Text style={styles.genreStats}>
            {artistsCount} artist{artistsCount !== 1 ? 's' : ''} · {setsCount} set{setsCount !== 1 ? 's' : ''}
          </Text>
        </View>
      </LinearGradient>

      {/* Tab Toggle */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.setsTab, activeTab === 'sets' && styles.setsTabActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('sets');
          }}
        >
          <Text style={[styles.setsTabText, activeTab === 'sets' && styles.setsTabTextActive]}>
            Sets ({setsCount})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.artistsToggle, activeTab === 'artists' && styles.artistsToggleActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('artists');
          }}
        >
          <Text style={[styles.artistsToggleText, activeTab === 'artists' && styles.artistsToggleTextActive]}>
            Artists
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {isCurrentTabLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      ) : activeTab === 'sets' ? (
        <FlatList
          data={sets}
          keyExtractor={(item) => item.id}
          renderItem={renderSetItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={setsRefreshing}
              onRefresh={() => {
                setSetsOffset(0);
                loadSets(true);
              }}
              tintColor={Colors.dark.primary}
            />
          }
          onEndReached={() => {
            if (!setsLoading && !setsLoadingMore && setsHasMore) {
              loadSets(false);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderSetsFooter}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Music size={48} color={Colors.dark.textMuted} />
              <Text style={styles.emptyTitle}>No sets found</Text>
              <Text style={styles.emptyText}>
                No sets found for {genre} yet
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={artists}
          keyExtractor={(item) => item.id}
          renderItem={renderArtistItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={artistsRefreshing}
              onRefresh={() => {
                setArtistsOffset(0);
                loadArtists(true);
              }}
              tintColor={Colors.dark.primary}
            />
          }
          onEndReached={() => {
            if (!artistsLoading && !artistsLoadingMore && artistsHasMore) {
              loadArtists(false);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderArtistsFooter}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Users size={48} color={Colors.dark.textMuted} />
              <Text style={styles.emptyTitle}>No artists found</Text>
              <Text style={styles.emptyText}>
                No artists tagged with {genre} yet
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  genreTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  genreStats: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  setsTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(196, 30, 58, 0.08)',
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    gap: 10,
  },
  setsTabActive: {
    backgroundColor: Colors.dark.primary,
  },
  setsTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  setsTabTextActive: {
    color: '#fff',
  },
  artistsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  artistsToggleActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: 'rgba(196, 30, 58, 0.08)',
  },
  artistsToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.dark.textMuted,
  },
  artistsToggleTextActive: {
    color: Colors.dark.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 100,
  },
  setCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  setCardPressed: {
    backgroundColor: Colors.dark.cardHover,
  },
  setCover: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceLight,
    marginRight: 12,
  },
  setCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  setInfo: {
    flex: 1,
  },
  setTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  setArtist: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  setMeta: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
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
