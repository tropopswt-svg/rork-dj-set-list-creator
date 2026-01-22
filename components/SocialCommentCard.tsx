import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Heart, Plus, Music } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { SocialComment } from '@/types';

interface SocialCommentCardProps {
  comment: SocialComment;
  onAddTrack?: () => void;
}

const platformColors = {
  instagram: Colors.dark.platforms.instagram,
  tiktok: Colors.dark.platforms.tiktok,
  twitter: Colors.dark.platforms.twitter,
  youtube: Colors.dark.platforms.youtube,
};

const platformNames = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  twitter: 'Twitter',
  youtube: 'YouTube',
};

export default function SocialCommentCard({ comment, onAddTrack }: SocialCommentCardProps) {
  const timeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  const handleAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddTrack?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image source={{ uri: comment.avatarUrl }} style={styles.avatar} />
        <View style={styles.userInfo}>
          <View style={styles.usernameRow}>
            <Text style={styles.username}>@{comment.username}</Text>
            <View style={[styles.platformBadge, { backgroundColor: platformColors[comment.platform] }]}>
              <Text style={styles.platformText}>{platformNames[comment.platform]}</Text>
            </View>
          </View>
          <Text style={styles.timestamp}>{timeAgo(comment.timestamp)}</Text>
        </View>
      </View>
      
      <Text style={styles.comment}>{comment.comment}</Text>
      
      {comment.suggestedTrack && (
        <View style={styles.trackSuggestion}>
          <Image source={{ uri: comment.suggestedTrack.coverUrl }} style={styles.trackCover} />
          <View style={styles.trackInfo}>
            <View style={styles.trackLabel}>
              <Music size={12} color={Colors.dark.primary} />
              <Text style={styles.trackLabelText}>Identified Track</Text>
            </View>
            <Text style={styles.trackTitle} numberOfLines={1}>{comment.suggestedTrack.title}</Text>
            <Text style={styles.trackArtist} numberOfLines={1}>{comment.suggestedTrack.artist}</Text>
          </View>
          <Pressable style={styles.addButton} onPress={handleAddPress}>
            <Plus size={18} color={Colors.dark.background} />
          </Pressable>
        </View>
      )}
      
      <View style={styles.footer}>
        <View style={styles.likesRow}>
          <Heart size={14} color={Colors.dark.accent} fill={Colors.dark.accent} />
          <Text style={styles.likesText}>{comment.likes}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  username: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  platformText: {
    color: Colors.dark.text,
    fontSize: 10,
    fontWeight: '600' as const,
  },
  timestamp: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  comment: {
    color: Colors.dark.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  trackSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.primary + '30',
  },
  trackCover: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
  },
  trackLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  trackLabelText: {
    color: Colors.dark.primary,
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
  },
  trackTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  trackArtist: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  likesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likesText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
});
