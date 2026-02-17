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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  MapPin,
  Music,
  Play,
  Calendar,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { getVenueSets, type VenueInfo } from '@/lib/supabase/venueService';

interface SetItem {
  id: string;
  title: string;
  dj_name: string;
  created_at: string;
  track_count?: number;
  duration_seconds?: number;
}

function SetCard({ set, onPress }: { set: SetItem; onPress: () => void }) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <Pressable style={styles.setCard} onPress={onPress}>
      <View style={styles.setCoverContainer}>
        <View style={[styles.setCover, styles.setCoverPlaceholder]}>
          <Music size={24} color={Colors.dark.textMuted} />
        </View>
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Play size={16} color="#fff" fill="#fff" />
          </View>
        </View>
      </View>

      <View style={styles.setInfo}>
        <Text style={styles.setName} numberOfLines={2}>
          {set.title}
        </Text>
        {set.dj_name && (
          <Text style={styles.setArtist} numberOfLines={1}>
            {set.dj_name}
          </Text>
        )}
        <View style={styles.setMeta}>
          <View style={styles.metaItem}>
            <Calendar size={12} color={Colors.dark.textMuted} />
            <Text style={styles.metaText}>{formatDate(set.created_at)}</Text>
          </View>
          {set.track_count ? (
            <View style={styles.metaItem}>
              <Music size={12} color={Colors.dark.textMuted} />
              <Text style={styles.metaText}>{set.track_count} tracks</Text>
            </View>
          ) : null}
          {set.duration_seconds ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaText}>{formatDuration(set.duration_seconds)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function VenueDetailScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const venueName = decodeURIComponent(name || '');

  const [sets, setSets] = useState<SetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const PAGE_SIZE = 20;

  const loadSets = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
      setOffset(0);
    } else if (!refresh && offset === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    const currentOffset = refresh ? 0 : offset;

    const { data, count } = await getVenueSets(venueName, PAGE_SIZE, currentOffset);

    if (refresh || currentOffset === 0) {
      setSets(data);
    } else {
      setSets(prev => [...prev, ...data]);
    }

    setTotalCount(count);
    setHasMore(data.length === PAGE_SIZE);
    setOffset(currentOffset + data.length);
    setIsLoading(false);
    setIsLoadingMore(false);
    setIsRefreshing(false);
  }, [venueName, offset]);

  useEffect(() => {
    if (venueName) {
      loadSets(true);
    }
  }, [venueName]);

  const handleRefresh = () => loadSets(true);

  const handleLoadMore = () => {
    if (!isLoading && !isLoadingMore && hasMore) {
      loadSets(false);
    }
  };

  const handleSetPress = (set: SetItem) => {
    Haptics.selectionAsync();
    router.push(`/(tabs)/(discover)/${set.id}`);
  };

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.venueIconContainer}>
        <MapPin size={32} color={Colors.dark.primary} />
      </View>
      <Text style={styles.venueTitle}>{venueName}</Text>
      <Text style={styles.venueSubtitle}>
        {totalCount} set{totalCount !== 1 ? 's' : ''} recorded
      </Text>
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
        <Music size={48} color={Colors.dark.textMuted} />
        <Text style={styles.emptyTitle}>No sets found</Text>
        <Text style={styles.emptyText}>
          No sets have been recorded at this venue yet
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
          title: venueName,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={24} color={Colors.dark.text} />
            </Pressable>
          ),
        }}
      />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        {isLoading && sets.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : (
          <FlatList
            data={sets}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SetCard set={item} onPress={() => handleSetPress(item)} />
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    marginBottom: 8,
  },
  venueIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${Colors.dark.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  venueTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  venueSubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  listContent: {
    paddingBottom: 100,
  },
  setCard: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  setCoverContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  setCover: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.dark.surfaceLight,
  },
  setCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  setInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  setName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    lineHeight: 20,
    marginBottom: 2,
  },
  setArtist: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  setMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
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
