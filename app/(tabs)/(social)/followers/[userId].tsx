import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFollowersList, FollowerItem } from '@/hooks/useSocial';
import UserCard from '@/components/UserCard';

export default function FollowersListScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const {
    followers,
    isLoading,
    isLoadingMore,
    hasMore,
    refresh,
    loadMore,
  } = useFollowersList(userId || '', 20);

  const renderFollower = useCallback(
    ({ item }: { item: FollowerItem }) => (
      <UserCard
        user={{
          id: item.follower.id,
          username: item.follower.username,
          display_name: item.follower.display_name,
          avatar_url: item.follower.avatar_url,
          bio: item.follower.bio,
          followers_count: item.follower.followers_count,
        }}
        showBio
        showStats
        glass
      />
    ),
    []
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
          <Text style={styles.emptyTitle}>No followers yet</Text>
          <Text style={styles.emptyText}>
            When someone follows this user, they'll appear here
          </Text>
        </View>
      </View>
    );
  }, [isLoading]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: '#1e1e22' },
          headerTintColor: 'rgba(255,255,255,0.9)',
          headerShadowVisible: false,
          title: 'Followers',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={24} color="rgba(255,255,255,0.9)" />
            </Pressable>
          ),
        }}
      />

      <View style={styles.container}>
        {isLoading && followers.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : (
          <FlashList
            data={followers}
            renderItem={renderFollower}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoading && followers.length > 0}
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
  cardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
});
