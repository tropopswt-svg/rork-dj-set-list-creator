import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  Users,
  UserPlus,
  UserCheck,
  Music,
  Heart,
  Award,
  MapPin,
  Link as LinkIcon,
  Calendar,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useFollowUser, useUserProfile, useMutualFollowers } from '@/hooks/useSocial';

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { profile, isLoading } = useUserProfile(username || '');
  const { isFollowing, isLoading: followLoading, toggleFollow } = useFollowUser(profile?.id || '');
  const { mutualFollowers, mutualCount, isLoading: mutualLoading } = useMutualFollowers(profile?.id || '', 3);

  const [activeTab, setActiveTab] = useState<'contributions' | 'likes'>('contributions');

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const handleFollow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleFollow();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>User not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
          title: `@${profile.username}`,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={24} color={Colors.dark.text} />
            </Pressable>
          ),
        }}
      />

      <ScrollView style={styles.container}>
        {/* Profile Header */}
        <View style={styles.header}>
          <Image
            source={{ uri: profile.avatar_url || undefined }}
            style={styles.avatar}
            placeholder={{ blurhash: 'L9B:x]of00ay~qj[M{ay-;j[RjfQ' }}
            transition={250}
          />

          <View style={styles.headerInfo}>
            <Text style={styles.displayName}>{profile.display_name || profile.username}</Text>
            <Text style={styles.username}>@{profile.username}</Text>

            {profile.bio && (
              <Text style={styles.bio}>{profile.bio}</Text>
            )}

            {profile.website && (
              <View style={styles.infoRow}>
                <LinkIcon size={14} color={Colors.dark.primary} />
                <Text style={styles.websiteText}>{profile.website}</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Calendar size={14} color={Colors.dark.textMuted} />
              <Text style={styles.joinedText}>Joined {formatDate(profile.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Pressable
            style={styles.statItem}
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/(tabs)/(social)/followers/${profile.id}`);
            }}
          >
            <Text style={styles.statNumber}>{profile.followers_count}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
          <Pressable
            style={styles.statItem}
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/(tabs)/(social)/following/${profile.id}`);
            }}
          >
            <Text style={styles.statNumber}>{profile.following_count}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.contributions_count}</Text>
            <Text style={styles.statLabel}>Contributions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.points}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
        </View>

        {/* Mutual Followers (only shown for other users) */}
        {!isOwnProfile && currentUser && mutualCount > 0 && (
          <Pressable
            style={styles.mutualSection}
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/(tabs)/(social)/followers/${profile.id}`);
            }}
          >
            <View style={styles.mutualAvatars}>
              {mutualFollowers.slice(0, 3).map((follower: any, index: number) => (
                <View
                  key={follower.id}
                  style={[
                    styles.mutualAvatar,
                    { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index },
                  ]}
                >
                  <Image
                    source={{ uri: follower.avatar_url || undefined }}
                    style={styles.mutualAvatarImage}
                    placeholder={{ blurhash: 'L9B:x]of00ay~qj[M{ay-;j[RjfQ' }}
                    transition={250}
                  />
                </View>
              ))}
            </View>
            <Text style={styles.mutualText}>
              Followed by {mutualFollowers[0]?.display_name || mutualFollowers[0]?.username}
              {mutualCount > 1 && ` and ${mutualCount - 1} other${mutualCount > 2 ? 's' : ''} you follow`}
            </Text>
          </Pressable>
        )}

        {/* Follow Button */}
        {!isOwnProfile && currentUser && (
          <View style={styles.actionRow}>
            <Pressable
              style={[
                styles.followButton,
                isFollowing && styles.followingButton,
              ]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : isFollowing ? (
                <>
                  <UserCheck size={18} color={Colors.dark.primary} />
                  <Text style={styles.followingButtonText}>Following</Text>
                </>
              ) : (
                <>
                  <UserPlus size={18} color="#fff" />
                  <Text style={styles.followButtonText}>Follow</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Edit Profile Button (own profile) */}
        {isOwnProfile && (
          <View style={styles.actionRow}>
            <Pressable
              style={styles.editButton}
              onPress={() => router.push('/(tabs)/(profile)/settings')}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </Pressable>
          </View>
        )}

        {/* Favorite Genres */}
        {profile.favorite_genres && profile.favorite_genres.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Favorite Genres</Text>
            <View style={styles.genresRow}>
              {profile.favorite_genres.map((genre: string, index: number) => (
                <View key={index} style={styles.genreTag}>
                  <Text style={styles.genreText}>{genre}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === 'contributions' && styles.activeTab]}
            onPress={() => setActiveTab('contributions')}
          >
            <Award size={18} color={activeTab === 'contributions' ? Colors.dark.primary : Colors.dark.textMuted} />
            <Text style={[styles.tabText, activeTab === 'contributions' && styles.activeTabText]}>
              Contributions
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'likes' && styles.activeTab]}
            onPress={() => setActiveTab('likes')}
          >
            <Heart size={18} color={activeTab === 'likes' ? Colors.dark.primary : Colors.dark.textMuted} />
            <Text style={[styles.tabText, activeTab === 'likes' && styles.activeTabText]}>
              Liked Sets
            </Text>
          </Pressable>
        </View>

        {/* Tab Content */}
        {activeTab === 'contributions' && profile.show_contributions && (
          <View style={styles.tabContent}>
            {profile.contributions && profile.contributions.length > 0 ? (
              profile.contributions.map((contribution: any, index: number) => (
                <Pressable
                  key={index}
                  style={styles.contributionItem}
                  onPress={() => router.push(`/(tabs)/(discover)/${contribution.set?.id}`)}
                >
                  <View style={styles.contributionIcon}>
                    <Music size={16} color={Colors.dark.primary} />
                  </View>
                  <View style={styles.contributionInfo}>
                    <Text style={styles.contributionTrack} numberOfLines={1}>
                      {contribution.track_title} - {contribution.track_artist}
                    </Text>
                    <Text style={styles.contributionSet} numberOfLines={1}>
                      in {contribution.set?.name}
                    </Text>
                  </View>
                  <View style={styles.contributionPoints}>
                    <Text style={styles.pointsText}>+{contribution.points_awarded}</Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyText}>No contributions yet</Text>
            )}
          </View>
        )}

        {activeTab === 'likes' && profile.show_favorites && (
          <View style={styles.tabContent}>
            {profile.likedSets && profile.likedSets.length > 0 ? (
              profile.likedSets.map((like: any, index: number) => (
                <Pressable
                  key={index}
                  style={styles.likedSetItem}
                  onPress={() => router.push(`/(tabs)/(discover)/${like.set?.id}`)}
                >
                  <Image
                    source={{ uri: like.set?.cover_url || undefined }}
                    style={styles.likedSetCover}
                    placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                    transition={250}
                  />
                  <View style={styles.likedSetInfo}>
                    <Text style={styles.likedSetName} numberOfLines={1}>
                      {like.set?.name}
                    </Text>
                    <Text style={styles.likedSetArtist} numberOfLines={1}>
                      {like.set?.artist_name}
                    </Text>
                  </View>
                  <Heart size={16} color={Colors.dark.primary} fill={Colors.dark.primary} />
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyText}>No liked sets yet</Text>
            )}
          </View>
        )}

        {/* Privacy notice */}
        {activeTab === 'contributions' && !profile.show_contributions && !isOwnProfile && (
          <View style={styles.privacyNotice}>
            <Text style={styles.privacyText}>Contributions are private</Text>
          </View>
        )}
        {activeTab === 'likes' && !profile.show_favorites && !isOwnProfile && (
          <View style={styles.privacyNotice}>
            <Text style={styles.privacyText}>Liked sets are private</Text>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
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
    backgroundColor: Colors.dark.background,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: Colors.dark.text,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.surface,
  },
  headerInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  username: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  bio: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  websiteText: {
    fontSize: 13,
    color: Colors.dark.primary,
  },
  joinedText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.dark.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  mutualSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderColor: Colors.dark.border,
  },
  mutualAvatars: {
    flexDirection: 'row',
  },
  mutualAvatar: {
    borderWidth: 2,
    borderColor: Colors.dark.background,
    borderRadius: 14,
  },
  mutualAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  mutualText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  actionRow: {
    padding: 16,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  followingButton: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  followingButtonText: {
    color: Colors.dark.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  editButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreTag: {
    backgroundColor: `${Colors.dark.primary}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${Colors.dark.primary}40`,
  },
  genreText: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: '500',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: Colors.dark.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.dark.primary,
  },
  tabText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.dark.primary,
  },
  tabContent: {
    padding: 16,
  },
  contributionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  contributionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.dark.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contributionInfo: {
    flex: 1,
  },
  contributionTrack: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.text,
  },
  contributionSet: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  contributionPoints: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  likedSetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 12,
  },
  likedSetCover: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceLight,
  },
  likedSetInfo: {
    flex: 1,
  },
  likedSetName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.text,
  },
  likedSetArtist: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    paddingVertical: 32,
  },
  privacyNotice: {
    padding: 32,
    alignItems: 'center',
  },
  privacyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  bottomPadding: {
    height: 32,
  },
});
