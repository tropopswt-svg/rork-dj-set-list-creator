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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, CheckCheck, Bell } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationItem from '@/components/NotificationItem';
import { NotificationWithUser } from '@/lib/supabase/notificationService';

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    hasMore,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const handleMarkAllAsRead = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    markAllAsRead();
  }, [markAllAsRead]);

  const renderNotification = useCallback(
    ({ item }: { item: NotificationWithUser }) => (
      <NotificationItem
        notification={item}
        onMarkAsRead={() => markAsRead(item.id)}
      />
    ),
    [markAsRead]
  );

  const renderFooter = useCallback(() => {
    if (!hasMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={Colors.dark.primary} />
      </View>
    );
  }, [hasMore]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Bell size={48} color={Colors.dark.textMuted} />
        <Text style={styles.emptyTitle}>No notifications yet</Text>
        <Text style={styles.emptyText}>
          When someone follows you, likes your contribution, or replies to your comment, you'll see it here
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
          title: 'Notifications',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={24} color={Colors.dark.text} />
            </Pressable>
          ),
          headerRight: () =>
            unreadCount > 0 ? (
              <Pressable
                onPress={handleMarkAllAsRead}
                hitSlop={8}
                style={styles.headerButton}
              >
                <CheckCheck size={20} color={Colors.dark.primary} />
              </Pressable>
            ) : null,
        }}
      />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        {isLoading && notifications.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : (
          <FlashList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
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

        {/* Unread count banner */}
        {unreadCount > 0 && (
          <View style={styles.unreadBanner}>
            <Text style={styles.unreadBannerText}>
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </Text>
            <Pressable onPress={handleMarkAllAsRead}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          </View>
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
  headerButton: {
    padding: 8,
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
  unreadBanner: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  unreadBannerText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.text,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
});
