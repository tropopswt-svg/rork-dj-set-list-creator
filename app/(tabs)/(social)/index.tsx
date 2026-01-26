import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Heart, MessageCircle, Music, Clock, CheckCircle, Users, Share2, Bell, UserPlus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useFeed, useFollowing, useNotifications, ActivityWithDetails } from '@/hooks/useSocial';

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'like_set':
      return <Heart size={14} color={Colors.dark.error} fill={Colors.dark.error} />;
    case 'track_id':
      return <Music size={14} color={Colors.dark.primary} />;
    case 'new_set':
      return <Music size={14} color={Colors.dark.success} />;
    case 'follow_user':
    case 'follow_artist':
      return <UserPlus size={14} color={Colors.dark.primary} />;
    default:
      return <MessageCircle size={14} color={Colors.dark.textSecondary} />;
  }
}

function getActivityText(activity: ActivityWithDetails) {
  switch (activity.activity_type) {
    case 'like_set':
      return 'liked a set';
    case 'track_id':
      return 'identified a track';
    case 'new_set':
      return 'new set added';
    case 'follow_user':
      return `started following ${activity.target_user?.display_name || activity.target_user?.username}`;
    case 'follow_artist':
      return `started following ${activity.artist?.name}`;
    default:
      return '';
  }
}

function ActivityCard({ activity, onPress }: { activity: ActivityWithDetails; onPress: () => void }) {
  const [liked, setLiked] = useState(false);

  const toggleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked(!liked);
  };

  return (
    <Pressable style={styles.activityCard} onPress={onPress}>
      <View style={styles.activityHeader}>
        <Image
          source={{ uri: activity.user?.avatar_url || 'https://via.placeholder.com/40' }}
          style={styles.activityAvatar}
          contentFit="cover"
        />
        <View style={styles.activityHeaderText}>
          <View style={styles.activityNameRow}>
            <Text style={styles.activityFriendName}>
              {activity.user?.display_name || activity.user?.username || 'User'}
            </Text>
            {getActivityIcon(activity.activity_type)}
          </View>
          <Text style={styles.activityAction}>{getActivityText(activity)}</Text>
        </View>
        <Text style={styles.activityTime}>{formatTimeAgo(activity.created_at)}</Text>
      </View>

      {activity.set && (
        <View style={styles.activityContent}>
          <Image
            source={{ uri: activity.set.cover_url || 'https://via.placeholder.com/64' }}
            style={styles.activitySetImage}
            contentFit="cover"
          />
          <View style={styles.activitySetInfo}>
            <Text style={styles.activitySetName} numberOfLines={1}>
              {activity.set.name}
            </Text>
            <Text style={styles.activitySetArtist}>{activity.set.artist_name}</Text>
            {activity.metadata?.track_title && (
              <View style={styles.trackBadge}>
                <Music size={11} color={Colors.dark.primary} />
                <Text style={styles.trackBadgeText}>
                  {activity.metadata.track_artist} - {activity.metadata.track_title}
                </Text>
                {activity.metadata.timestamp && (
                  <View style={styles.trackTimestamp}>
                    <Clock size={10} color={Colors.dark.textMuted} />
                    <Text style={styles.trackTimestampText}>
                      {Math.floor(activity.metadata.timestamp / 60)}:{(activity.metadata.timestamp % 60).toString().padStart(2, '0')}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      <View style={styles.activityActions}>
        <Pressable
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            toggleLike();
          }}
        >
          <Heart
            size={18}
            color={liked ? Colors.dark.error : Colors.dark.textMuted}
            fill={liked ? Colors.dark.error : 'transparent'}
          />
        </Pressable>
        <Pressable style={styles.actionButton}>
          <MessageCircle size={18} color={Colors.dark.textMuted} />
        </Pressable>
        <Pressable style={styles.actionButton}>
          <Share2 size={18} color={Colors.dark.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function SocialScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { feed, isLoading, isRefreshing, refresh } = useFeed();
  const { followedUsers, followedArtists, isLoading: followingLoading } = useFollowing();
  const { unreadCount } = useNotifications();

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const navigateToSet = (setId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/(discover)/${setId}`);
  };

  // Not logged in view
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.title}>Social</Text>
          </View>
          <View style={styles.loginPromptContainer}>
            <Users size={48} color={Colors.dark.textMuted} />
            <Text style={styles.loginPromptTitle}>Connect with friends</Text>
            <Text style={styles.loginPromptText}>
              Log in to follow friends, see their activity, and share your contributions
            </Text>
            <Pressable
              style={styles.loginButton}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.loginButtonText}>Log In</Text>
            </Pressable>
            <Pressable
              style={styles.signupButton}
              onPress={() => router.push('/(auth)/signup')}
            >
              <Text style={styles.signupButtonText}>Create Account</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Social</Text>
          <View style={styles.headerButtons}>
            <Pressable
              style={styles.headerButton}
              onPress={() => {
                Haptics.selectionAsync();
                // TODO: Navigate to notifications
              }}
            >
              <Bell size={22} color={Colors.dark.text} />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationCount}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={styles.headerButton}
              onPress={() => {
                Haptics.selectionAsync();
                // TODO: Navigate to find friends
              }}
            >
              <Users size={22} color={Colors.dark.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.dark.primary}
            />
          }
        >
          {/* Following Section */}
          <View style={styles.followingSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Following</Text>
              <Text style={styles.sectionCount}>
                {followedUsers.length + followedArtists.length}
              </Text>
            </View>
            {followingLoading ? (
              <ActivityIndicator color={Colors.dark.primary} style={styles.sectionLoader} />
            ) : followedUsers.length === 0 && followedArtists.length === 0 ? (
              <View style={styles.emptyFollowing}>
                <Text style={styles.emptyFollowingText}>
                  You're not following anyone yet
                </Text>
                <Pressable style={styles.findFriendsButton}>
                  <UserPlus size={16} color={Colors.dark.primary} />
                  <Text style={styles.findFriendsText}>Find Friends</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.followingContainer}
              >
                {followedUsers.map((follow) => (
                  <Pressable
                    key={follow.id}
                    style={styles.followingItem}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push(`/user/${follow.following_user?.username}`);
                    }}
                  >
                    <Image
                      source={{ uri: follow.following_user?.avatar_url || 'https://via.placeholder.com/56' }}
                      style={styles.followingAvatar}
                      contentFit="cover"
                    />
                    <Text style={styles.followingName} numberOfLines={1}>
                      @{follow.following_user?.username}
                    </Text>
                  </Pressable>
                ))}
                {followedArtists.map((follow) => (
                  <Pressable
                    key={follow.id}
                    style={styles.followingItem}
                    onPress={() => {
                      Haptics.selectionAsync();
                      if (follow.following_artist?.slug) {
                        router.push(`/(tabs)/(discover)/artist/${follow.following_artist.slug}`);
                      }
                    }}
                  >
                    <Image
                      source={{ uri: follow.following_artist?.image_url || 'https://via.placeholder.com/56' }}
                      style={[styles.followingAvatar, styles.artistAvatar]}
                      contentFit="cover"
                    />
                    <Text style={styles.followingName} numberOfLines={1}>
                      {follow.following_artist?.name}
                    </Text>
                  </Pressable>
                ))}
                <Pressable style={styles.addFollowItem}>
                  <View style={styles.addFollowCircle}>
                    <UserPlus size={22} color={Colors.dark.primary} />
                  </View>
                  <Text style={styles.addFollowText}>Find</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>

          {/* Activity Feed */}
          <View style={styles.activitySection}>
            <Text style={styles.activityTitle}>Activity</Text>
            {isLoading ? (
              <ActivityIndicator color={Colors.dark.primary} style={styles.loader} />
            ) : feed.length === 0 ? (
              <View style={styles.emptyFeed}>
                <Text style={styles.emptyFeedTitle}>No activity yet</Text>
                <Text style={styles.emptyFeedText}>
                  Follow users and artists to see their activity here
                </Text>
              </View>
            ) : (
              feed.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onPress={() => {
                    if (activity.set?.id) {
                      navigateToSet(activity.set.id);
                    }
                  }}
                />
              ))
            )}
          </View>
        </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
    letterSpacing: -0.3,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.dark.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loginPromptContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  loginPromptTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 8,
  },
  loginPromptText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  loginButton: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginTop: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  signupButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  followingSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  sectionCount: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionLoader: {
    marginVertical: 20,
  },
  emptyFollowing: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyFollowingText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  findFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  findFriendsText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.primary,
  },
  followingContainer: {
    paddingHorizontal: 16,
    gap: 14,
  },
  followingItem: {
    alignItems: 'center',
    width: 68,
  },
  followingAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 6,
  },
  artistAvatar: {
    borderWidth: 2,
    borderColor: Colors.dark.primary,
  },
  followingName: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.dark.text,
    textAlign: 'center',
  },
  addFollowItem: {
    alignItems: 'center',
    width: 68,
  },
  addFollowCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
  },
  addFollowText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.dark.primary,
  },
  activitySection: {
    paddingHorizontal: 16,
  },
  activityTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  loader: {
    marginTop: 40,
  },
  emptyFeed: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyFeedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptyFeedText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  activityCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  activityHeaderText: {
    flex: 1,
  },
  activityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityFriendName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  activityAction: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  activityTime: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  activityContent: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  activitySetImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  activitySetInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  activitySetName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  activitySetArtist: {
    fontSize: 13,
    color: Colors.dark.primary,
    marginBottom: 6,
  },
  trackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.dark.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
  },
  trackBadgeText: {
    fontSize: 11,
    color: Colors.dark.text,
    fontWeight: '500',
  },
  trackTimestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 4,
  },
  trackTimestampText: {
    fontSize: 10,
    color: Colors.dark.textMuted,
  },
  activityActions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  actionButton: {
    padding: 4,
  },
});
