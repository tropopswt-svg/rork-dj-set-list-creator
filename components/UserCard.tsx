import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { UserPlus, UserCheck, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useFollowUser } from '@/hooks/useSocial';

interface UserCardProps {
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    bio?: string | null;
    followers_count?: number;
  };
  showFollowButton?: boolean;
  showBio?: boolean;
  showStats?: boolean;
  mutualCount?: number;
  reason?: string;
  onPress?: () => void;
  compact?: boolean;
}

export default function UserCard({
  user,
  showFollowButton = true,
  showBio = false,
  showStats = false,
  mutualCount,
  reason,
  onPress,
  compact = false,
}: UserCardProps) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { isFollowing, isLoading: followLoading, toggleFollow } = useFollowUser(user.id);

  const isOwnProfile = currentUser?.id === user.id;

  const handlePress = () => {
    Haptics.selectionAsync();
    if (onPress) {
      onPress();
    } else if (user.username) {
      router.push(`/user/${user.username}`);
    }
  };

  const handleFollow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleFollow();
  };

  const displayName = user.display_name || user.username || 'Unknown User';

  if (compact) {
    return (
      <Pressable style={styles.compactContainer} onPress={handlePress}>
        <Image
          source={{ uri: user.avatar_url || 'https://via.placeholder.com/44' }}
          style={styles.compactAvatar}
          contentFit="cover"
          placeholder={{ blurhash: 'L9B:x]of00ay~qj[M{ay-;j[RjfQ' }}
          transition={250}
        />
        <View style={styles.compactInfo}>
          <Text style={styles.compactName} numberOfLines={1}>
            {displayName}
          </Text>
          {user.username && (
            <Text style={styles.compactUsername} numberOfLines={1}>
              @{user.username}
            </Text>
          )}
        </View>
        {showFollowButton && !isOwnProfile && currentUser && (
          <Pressable
            style={[
              styles.compactFollowButton,
              isFollowing && styles.compactFollowingButton,
            ]}
            onPress={handleFollow}
            disabled={followLoading}
          >
            {followLoading ? (
              <ActivityIndicator size="small" color={isFollowing ? Colors.dark.primary : '#fff'} />
            ) : isFollowing ? (
              <UserCheck size={16} color={Colors.dark.primary} />
            ) : (
              <UserPlus size={16} color="#fff" />
            )}
          </Pressable>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <Image
        source={{ uri: user.avatar_url || 'https://via.placeholder.com/56' }}
        style={styles.avatar}
        contentFit="cover"
        placeholder={{ blurhash: 'L9B:x]of00ay~qj[M{ay-;j[RjfQ' }}
        transition={250}
      />

      <View style={styles.info}>
        <Text style={styles.displayName} numberOfLines={1}>
          {displayName}
        </Text>

        {user.username && (
          <Text style={styles.username} numberOfLines={1}>
            @{user.username}
          </Text>
        )}

        {showBio && user.bio && (
          <Text style={styles.bio} numberOfLines={2}>
            {user.bio}
          </Text>
        )}

        {showStats && user.followers_count !== undefined && (
          <Text style={styles.stats}>
            {user.followers_count} followers
          </Text>
        )}

        {mutualCount !== undefined && mutualCount > 0 && (
          <View style={styles.mutualRow}>
            <Users size={12} color={Colors.dark.textMuted} />
            <Text style={styles.mutualText}>
              {mutualCount} mutual follower{mutualCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {reason && (
          <Text style={styles.reason} numberOfLines={1}>
            {reason}
          </Text>
        )}
      </View>

      {showFollowButton && !isOwnProfile && currentUser && (
        <Pressable
          style={[
            styles.followButton,
            isFollowing && styles.followingButton,
          ]}
          onPress={handleFollow}
          disabled={followLoading}
        >
          {followLoading ? (
            <ActivityIndicator size="small" color={isFollowing ? Colors.dark.primary : '#fff'} />
          ) : isFollowing ? (
            <>
              <UserCheck size={16} color={Colors.dark.primary} />
              <Text style={styles.followingText}>Following</Text>
            </>
          ) : (
            <>
              <UserPlus size={16} color="#fff" />
              <Text style={styles.followText}>Follow</Text>
            </>
          )}
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.surfaceLight,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  username: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 1,
  },
  bio: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  stats: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  mutualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  mutualText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  reason: {
    fontSize: 12,
    color: Colors.dark.primary,
    marginTop: 4,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginLeft: 8,
  },
  followingButton: {
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  followText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  followingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  compactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.surfaceLight,
  },
  compactInfo: {
    flex: 1,
    marginLeft: 10,
  },
  compactName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  compactUsername: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  compactFollowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactFollowingButton: {
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
});
