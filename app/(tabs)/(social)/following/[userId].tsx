import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Users, Music } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useFollowingList, FollowingItem } from '@/hooks/useSocial';
import UserCard from '@/components/UserCard';

// Artist card component for following list
function ArtistCard({
  artist,
  onPress,
}: {
  artist: NonNullable<FollowingItem['following_artist']>;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.artistCard} onPress={onPress}>
      <Image
        source={{ uri: artist.image_url || undefined }}
        style={styles.artistAvatar}
        contentFit="cover"
      />
      <View style={styles.artistInfo}>
        <Text style={styles.artistName} numberOfLines={1}>
          {artist.name}
        </Text>
        {artist.bio && (
          <Text style={styles.artistBio} numberOfLines={2}>
            {artist.bio}
          </Text>
        )}
        <Text style={styles.artistStats}>
          {artist.followers_count} followers
        </Text>
      </View>
      <View style={styles.artistBadge}>
        <Music size={14} color={Colors.dark.primary} />
      </View>
    </Pressable>
  );
}

type FilterType = 'all' | 'users' | 'artists';

export default function FollowingListScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [filter, setFilter] = useState<FilterType>('all');

  const {
    following,
    followingUsers,
    followingArtists,
    isLoading,
    isLoadingMore,
    hasMore,
    refresh,
    loadMore,
  } = useFollowingList(userId || '', 20);

  const filteredData = filter === 'users'
    ? followingUsers
    : filter === 'artists'
    ? followingArtists
    : following;

  const handleFilterChange = (newFilter: FilterType) => {
    Haptics.selectionAsync();
    setFilter(newFilter);
  };

  const navigateToArtist = (slug: string) => {
    Haptics.selectionAsync();
    router.push(`/(tabs)/(discover)/artist/${slug}`);
  };

  const renderItem = useCallback(
    ({ item }: { item: FollowingItem }) => {
      if (item.following_user) {
        return (
          <UserCard
            user={{
              id: item.following_user.id,
              username: item.following_user.username,
              display_name: item.following_user.display_name,
              avatar_url: item.following_user.avatar_url,
              bio: item.following_user.bio,
              followers_count: item.following_user.followers_count,
            }}
            showBio
            showStats
          />
        );
      }

      if (item.following_artist) {
        return (
          <ArtistCard
            artist={item.following_artist}
            onPress={() => navigateToArtist(item.following_artist!.slug)}
          />
        );
      }

      return null;
    },
    [navigateToArtist]
  );

  const renderFooter = useCallback(() => {
    if (!hasMore || !isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={Colors.dark.primary} />
      </View>
    );
  }, [hasMore, isLoadingMore]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Users size={48} color={Colors.dark.textMuted} />
        <Text style={styles.emptyTitle}>
          {filter === 'users'
            ? 'No users followed'
            : filter === 'artists'
            ? 'No artists followed'
            : 'Not following anyone'}
        </Text>
        <Text style={styles.emptyText}>
          {filter === 'artists'
            ? 'Follow artists to see their new sets in your feed'
            : 'Follow users to see their activity in your feed'}
        </Text>
      </View>
    );
  }, [isLoading, filter]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
          title: 'Following',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={24} color={Colors.dark.text} />
            </Pressable>
          ),
        }}
      />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <Pressable
            style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
            onPress={() => handleFilterChange('all')}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === 'all' && styles.filterTabTextActive,
              ]}
            >
              All ({following.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterTab, filter === 'users' && styles.filterTabActive]}
            onPress={() => handleFilterChange('users')}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === 'users' && styles.filterTabTextActive,
              ]}
            >
              Users ({followingUsers.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterTab, filter === 'artists' && styles.filterTabActive]}
            onPress={() => handleFilterChange('artists')}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === 'artists' && styles.filterTabTextActive,
              ]}
            >
              Artists ({followingArtists.length})
            </Text>
          </Pressable>
        </View>

        {isLoading && following.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : (
          <FlashList
            data={filteredData}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoading && following.length > 0}
                onRefresh={refresh}
                tintColor={Colors.dark.primary}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmpty}
            estimatedItemSize={64}
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  filterTabActive: {
    backgroundColor: `${Colors.dark.primary}15`,
    borderColor: Colors.dark.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.dark.textMuted,
  },
  filterTabTextActive: {
    color: Colors.dark.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
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
    lineHeight: 20,
  },
  // Artist card styles
  artistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  artistAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
  },
  artistInfo: {
    flex: 1,
    marginLeft: 12,
  },
  artistName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  artistBio: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  artistStats: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  artistBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${Colors.dark.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
