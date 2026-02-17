import React, { useCallback } from 'react';
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
        <Users size={48} color={Colors.dark.textMuted} />
        <Text style={styles.emptyTitle}>No followers yet</Text>
        <Text style={styles.emptyText}>
          When someone follows this user, they'll appear here
        </Text>
      </View>
    );
  }, [isLoading]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
          title: 'Followers',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={24} color={Colors.dark.text} />
            </Pressable>
          ),
        }}
      />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        {isLoading && followers.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : (
          <FlatList
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
});
