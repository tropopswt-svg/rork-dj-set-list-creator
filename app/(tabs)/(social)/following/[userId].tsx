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
import { Image } from 'expo-image';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Users, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useFollowingList, FollowingItem } from '@/hooks/useSocial';
import UserCard from '@/components/UserCard';

// Glass artist card with location
function ArtistCard({
  artist,
  onPress,
}: {
  artist: NonNullable<FollowingItem['following_artist']>;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.artistCard, pressed && { transform: [{ scale: 0.97 }], opacity: 0.85 }]}
      onPress={onPress}
    >
      {/* 3D depth layers */}
      <View style={styles.cardDepth3} />
      <View style={styles.cardDepth2} />
      <View style={styles.cardDepth1} />
      {/* Main face */}
      <View style={styles.cardFace}>
        <View style={styles.cardShine} />
        <Image
          source={{ uri: artist.image_url || undefined }}
          style={styles.artistAvatar}
          contentFit="cover"
        />
        <View style={styles.artistInfo}>
          <Text style={styles.artistName} numberOfLines={1}>
            {artist.name}
          </Text>
          {artist.country ? (
            <View style={styles.locationRow}>
              <MapPin size={11} color="rgba(255,255,255,0.3)" />
              <Text style={styles.locationText}>{artist.country}</Text>
            </View>
          ) : artist.bio ? (
            <Text style={styles.artistBio} numberOfLines={1}>
              {artist.bio}
            </Text>
          ) : null}
          <Text style={styles.artistStats}>
            {artist.followers_count} followers
          </Text>
        </View>
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
            glass
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
        <View style={styles.emptyCard}>
          <View style={styles.cardShine} />
          <Users size={40} color="rgba(255,255,255,0.2)" />
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
      </View>
    );
  }, [isLoading, filter]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: '#1e1e22' },
          headerTintColor: 'rgba(255,255,255,0.9)',
          headerShadowVisible: false,
          title: 'Following',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={24} color="rgba(255,255,255,0.9)" />
            </Pressable>
          ),
        }}
      />

      <View style={styles.container}>
        {/* Glass Filter Tabs */}
        <View style={styles.filterContainer}>
          {(['all', 'users', 'artists'] as FilterType[]).map((f) => {
            const count = f === 'all' ? following.length
              : f === 'users' ? followingUsers.length
              : followingArtists.length;
            const active = filter === f;
            return (
              <Pressable
                key={f}
                style={[styles.filterTab, active && styles.filterTabActive]}
                onPress={() => handleFilterChange(f)}
              >
                {active && <View style={styles.filterTabShine} />}
                <Text
                  style={[
                    styles.filterTabText,
                    active && styles.filterTabTextActive,
                  ]}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                </Text>
              </Pressable>
            );
          })}
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
            estimatedItemSize={80}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c20',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  filterTabActive: {
    backgroundColor: 'rgba(196,30,58,0.15)',
    borderColor: 'rgba(196,30,58,0.3)',
    borderTopColor: 'rgba(196,30,58,0.4)',
  },
  filterTabShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
  },
  filterTabTextActive: {
    color: Colors.dark.primary,
    fontWeight: '600',
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
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 28,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderBottomColor: 'rgba(0,0,0,0.15)',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    lineHeight: 20,
  },
  // 3D glass artist card
  artistCard: {
    marginBottom: 10,
  },
  // Stacked depth layers for 3D effect
  cardDepth3: {
    position: 'absolute',
    bottom: -4,
    left: 8,
    right: 8,
    height: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardDepth2: {
    position: 'absolute',
    bottom: -2,
    left: 5,
    right: 5,
    height: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  cardDepth1: {
    position: 'absolute',
    bottom: -1,
    left: 3,
    right: 3,
    height: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardFace: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderTopColor: 'rgba(255,255,255,0.2)',
    borderBottomColor: 'rgba(0,0,0,0.12)',
    overflow: 'hidden',
  },
  cardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  artistAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  artistInfo: {
    flex: 1,
    marginLeft: 12,
  },
  artistName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  locationText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
  artistBio: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
    lineHeight: 18,
  },
  artistStats: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 4,
  },
});
