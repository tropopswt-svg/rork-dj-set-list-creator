import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Bell, UserPlus, Play, ChevronRight, Music, Heart, MessageCircle, Share2, LogIn } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import Colors from '@/constants/colors';
import { useSets } from '@/contexts/SetsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFollowing, useNotifications, useLikeSet } from '@/hooks/useSocial';
import IDentifiedLogo from '@/components/IDentifiedLogo';

interface Artist {
  id: string;
  name: string;
  image: string;
  following: boolean;
}

// Suggested artists (will come from API later)
const suggestedArtists: Artist[] = [
  {
    id: '5',
    name: 'Chris Stussy',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
    following: false,
  },
  {
    id: '6',
    name: 'Sama\'',
    image: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=200&h=200&fit=crop',
    following: false,
  },
  {
    id: '7',
    name: 'Solomun',
    image: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=200&h=200&fit=crop',
    following: false,
  },
];

// Feed item component with like functionality
function FeedCard({ item, onPress }: { item: any; onPress: () => void }) {
  const { isAuthenticated } = useAuth();
  const { isLiked, isLoading: likeLoading, toggleLike } = useLikeSet(item.set.id);
  const router = useRouter();

  const handleLike = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleLike();
  };

  const handleComment = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/(discover)/${item.set.id}?showComments=true`);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(`https://identified.app/set/${item.set.id}`, {
          dialogTitle: `Check out ${item.set.name} on IDentified`,
        });
      }
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  return (
    <View style={styles.feedCard}>
      <Pressable onPress={onPress}>
        <View style={styles.feedHeader}>
          <Image
            source={{ uri: item.artist.image }}
            style={styles.feedArtistImage}
            contentFit="cover"
          />
          <View style={styles.feedHeaderText}>
            <Text style={styles.feedArtistName}>{item.artist.name}</Text>
            <Text style={styles.feedAction}>posted a new set</Text>
          </View>
          <Text style={styles.feedTime}>{item.set.date}</Text>
        </View>
        <View style={styles.feedContent}>
          <View style={styles.feedCoverContainer}>
            <Image
              source={{ uri: item.set.image }}
              style={styles.feedCover}
              contentFit="cover"
            />
            <View style={styles.feedPlayOverlay}>
              <View style={styles.feedPlayButton}>
                <Play size={20} color="#fff" fill="#fff" />
              </View>
            </View>
          </View>
          <View style={styles.feedSetInfo}>
            <Text style={styles.feedSetName} numberOfLines={2}>{item.set.name}</Text>
            <Text style={styles.feedSetVenue}>{item.set.venue}</Text>
            <View style={styles.feedSetStats}>
              <Text style={styles.feedSetDuration}>{item.set.duration}</Text>
              {item.set.duration && <View style={styles.feedSetDivider} />}
              <View style={styles.feedTracksRow}>
                <Music size={12} color={Colors.dark.textMuted} />
                <Text style={styles.feedSetTracks}>{item.set.tracksIdentified} tracks</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>

      {/* Social Actions */}
      <View style={styles.socialActions}>
        <Pressable
          style={styles.actionButton}
          onPress={handleLike}
          disabled={likeLoading}
        >
          <Heart
            size={20}
            color={isLiked ? '#EF4444' : Colors.dark.textMuted}
            fill={isLiked ? '#EF4444' : 'none'}
          />
          <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
            Like
          </Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={handleComment}>
          <MessageCircle size={20} color={Colors.dark.textMuted} />
          <Text style={styles.actionText}>Comment</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={handleShare}>
          <Share2 size={20} color={Colors.dark.textMuted} />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { sets } = useSets();
  const { isAuthenticated, user, profile } = useAuth();
  const { followedArtists, isLoading: followingLoading } = useFollowing();
  const { unreadCount } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [following, setFollowing] = useState<Record<string, boolean>>({});

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor(diff / 60000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Use real sets for feed items, sorted by date (newest first)
  const realFeedItems = useMemo(() => {
    return sets
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
      .map(set => ({
        id: set.id,
        type: 'new_set' as const,
        artist: {
          id: set.artist,
          name: set.artist,
          image: set.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
          following: true,
        },
        set: {
          id: set.id,
          name: set.name,
          venue: set.venue || '',
          date: formatDate(set.date),
          image: set.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
          duration: set.totalDuration ? formatDuration(set.totalDuration) : '',
          tracksIdentified: set.tracksIdentified || set.tracks.length,
        },
        timestamp: set.date,
      }));
  }, [sets]);

  // Artists the user follows
  const followedArtistsList = useMemo(() => {
    if (!isAuthenticated || followedArtists.length === 0) {
      // Show placeholder artists when not logged in
      return [
        { id: '1', name: 'Dixon', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop', following: true },
        { id: '2', name: 'Âme', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop', following: true },
        { id: '3', name: 'Hunee', image: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=200&h=200&fit=crop', following: true },
        { id: '4', name: 'Ben Böhmer', image: 'https://images.unsplash.com/photo-1508854710579-5cecc3a9ff17?w=200&h=200&fit=crop', following: true },
      ];
    }
    return followedArtists.map(f => ({
      id: f.following_artist?.id || '',
      name: f.following_artist?.name || '',
      image: f.following_artist?.image_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
      following: true,
    }));
  }, [isAuthenticated, followedArtists]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const toggleFollow = (artistId: string) => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFollowing(prev => ({ ...prev, [artistId]: !prev[artistId] }));
  };

  const handleNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    // TODO: Navigate to notifications screen
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <IDentifiedLogo size="medium" />
          <View style={styles.headerRight}>
            {!isAuthenticated && (
              <Pressable
                style={styles.loginButton}
                onPress={() => router.push('/(auth)/login')}
              >
                <LogIn size={16} color="#fff" />
                <Text style={styles.loginButtonText}>Login</Text>
              </Pressable>
            )}
            <Pressable style={styles.notifButton} onPress={handleNotifications}>
              <Bell size={22} color={Colors.dark.text} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.dark.primary}
            />
          }
        >
          {/* Following section */}
          <View style={styles.followingSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Following</Text>
              <Text style={styles.sectionCount}>
                {isAuthenticated ? `${followedArtistsList.length} artists` : 'Log in to follow'}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.followingContainer}
            >
              {followedArtistsList.map((artist) => (
                <Pressable
                  key={artist.id}
                  style={styles.followingItem}
                  onPress={() => {
                    Haptics.selectionAsync();
                    if (artist.id) {
                      router.push(`/(tabs)/(discover)/artist/${artist.id}`);
                    }
                  }}
                >
                  <Image
                    source={{ uri: artist.image }}
                    style={styles.followingImage}
                    contentFit="cover"
                  />
                  <Text style={styles.followingName} numberOfLines={1}>{artist.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Suggested Artists */}
          <View style={styles.suggestedSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Suggested Artists</Text>
              <Pressable style={styles.seeAllButton}>
                <Text style={styles.seeAllText}>See all</Text>
                <ChevronRight size={14} color={Colors.dark.primary} />
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestedContainer}
            >
              {suggestedArtists.map((artist) => (
                <View key={artist.id} style={styles.suggestedCard}>
                  <Image
                    source={{ uri: artist.image }}
                    style={styles.suggestedImage}
                    contentFit="cover"
                  />
                  <Text style={styles.suggestedName}>{artist.name}</Text>
                  <Pressable
                    style={[
                      styles.followButton,
                      following[artist.id] && styles.followingButton
                    ]}
                    onPress={() => toggleFollow(artist.id)}
                  >
                    {!following[artist.id] && <UserPlus size={14} color="#fff" />}
                    <Text style={styles.followButtonText}>
                      {following[artist.id] ? 'Following' : 'Follow'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Recent Activity Feed */}
          <View style={styles.feedSection}>
            <Text style={styles.feedTitle}>Recent Activity</Text>
            {realFeedItems.length > 0 ? (
              realFeedItems.map((item) => (
                <FeedCard
                  key={item.id}
                  item={item}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/(tabs)/(discover)/${item.set.id}`);
                  }}
                />
              ))
            ) : (
              <View style={styles.emptyFeed}>
                <Text style={styles.emptyFeedText}>No sets yet</Text>
                <Text style={styles.emptyFeedSubtext}>
                  Follow artists to see their latest sets
                </Text>
              </View>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  notifButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  followingSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  sectionCount: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  followingContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  followingItem: {
    alignItems: 'center',
    width: 68,
  },
  followingImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: Colors.dark.border,
  },
  followingName: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  suggestedSection: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: '500' as const,
  },
  suggestedContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  suggestedCard: {
    width: 140,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  suggestedImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
  },
  suggestedName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    width: '100%',
  },
  followingButton: {
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  followButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  feedSection: {
    paddingHorizontal: 16,
  },
  feedTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  feedCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedArtistImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  feedHeaderText: {
    flex: 1,
  },
  feedArtistName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  feedAction: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  feedTime: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  feedContent: {
    flexDirection: 'row',
  },
  feedCoverContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  feedCover: {
    width: '100%',
    height: '100%',
  },
  feedPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedPlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  feedSetInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  feedSetName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  feedSetVenue: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 10,
  },
  feedSetStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedSetDuration: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontWeight: '500' as const,
  },
  feedSetDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.dark.textMuted,
    marginHorizontal: 8,
  },
  feedTracksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedSetTracks: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontWeight: '500' as const,
  },
  socialActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    marginTop: 12,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },
  actionTextActive: {
    color: '#EF4444',
  },
  emptyFeed: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyFeedText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptyFeedSubtext: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
});
