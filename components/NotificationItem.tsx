import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import {
  UserPlus,
  Heart,
  MessageCircle,
  CheckCircle,
  XCircle,
  Music,
  Bell,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { NotificationWithUser } from '@/lib/supabase/notificationService';

interface NotificationItemProps {
  notification: NotificationWithUser;
  onPress?: () => void;
  onMarkAsRead?: () => void;
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'new_follower':
      return { icon: UserPlus, color: Colors.dark.primary };
    case 'like_on_contribution':
      return { icon: Heart, color: Colors.dark.error };
    case 'comment_reply':
      return { icon: MessageCircle, color: Colors.dark.primary };
    case 'contribution_verified':
      return { icon: CheckCircle, color: Colors.dark.success };
    case 'contribution_rejected':
      return { icon: XCircle, color: Colors.dark.error };
    case 'artist_new_set':
      return { icon: Music, color: Colors.dark.primary };
    default:
      return { icon: Bell, color: Colors.dark.textMuted };
  }
}

export default function NotificationItem({
  notification,
  onPress,
  onMarkAsRead,
}: NotificationItemProps) {
  const router = useRouter();
  const { icon: IconComponent, color: iconColor } = getNotificationIcon(notification.notification_type);

  const handlePress = () => {
    Haptics.selectionAsync();

    // Mark as read if not already
    if (!notification.is_read && onMarkAsRead) {
      onMarkAsRead();
    }

    if (onPress) {
      onPress();
      return;
    }

    // Navigate based on notification type
    switch (notification.notification_type) {
      case 'new_follower':
        if (notification.from_user?.username) {
          router.push(`/user/${notification.from_user.username}`);
        }
        break;
      case 'comment_reply':
      case 'artist_new_set':
        if (notification.set_id) {
          router.push(`/(tabs)/(discover)/${notification.set_id}`);
        }
        break;
      case 'contribution_verified':
      case 'contribution_rejected':
        // Could navigate to contribution details or set
        if (notification.set_id) {
          router.push(`/(tabs)/(discover)/${notification.set_id}`);
        }
        break;
    }
  };

  // Determine the avatar to show
  const avatarUrl = notification.from_user?.avatar_url || 'https://via.placeholder.com/48';

  return (
    <Pressable
      style={[
        styles.container,
        !notification.is_read && styles.unreadContainer,
      ]}
      onPress={handlePress}
    >
      {/* Unread indicator */}
      {!notification.is_read && <View style={styles.unreadDot} />}

      {/* Avatar with icon overlay */}
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: avatarUrl }}
          style={styles.avatar}
          contentFit="cover"
          placeholder={{ blurhash: 'L9B:x]of00ay~qj[M{ay-;j[RjfQ' }}
          transition={250}
        />
        <View style={[styles.iconBadge, { backgroundColor: iconColor }]}>
          <IconComponent size={12} color="#fff" />
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {notification.title}
        </Text>
        {notification.body && (
          <Text style={styles.body} numberOfLines={2}>
            {notification.body}
          </Text>
        )}
        <Text style={styles.time}>{formatTimeAgo(notification.created_at)}</Text>
      </View>
    </Pressable>
  );
}

// Simpler list version
export function NotificationItemCompact({
  notification,
  onPress,
  onMarkAsRead,
}: NotificationItemProps) {
  const { icon: IconComponent, color: iconColor } = getNotificationIcon(notification.notification_type);

  const handlePress = () => {
    Haptics.selectionAsync();
    if (!notification.is_read && onMarkAsRead) {
      onMarkAsRead();
    }
    if (onPress) {
      onPress();
    }
  };

  return (
    <Pressable
      style={[
        styles.compactContainer,
        !notification.is_read && styles.unreadCompactContainer,
      ]}
      onPress={handlePress}
    >
      <View style={[styles.compactIcon, { backgroundColor: `${iconColor}20` }]}>
        <IconComponent size={18} color={iconColor} />
      </View>
      <View style={styles.compactContent}>
        <Text style={styles.compactTitle} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={styles.compactTime}>{formatTimeAgo(notification.created_at)}</Text>
      </View>
      {!notification.is_read && <View style={styles.compactDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  unreadContainer: {
    backgroundColor: `${Colors.dark.primary}08`,
    borderColor: `${Colors.dark.primary}30`,
  },
  unreadDot: {
    position: 'absolute',
    top: 14,
    left: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.primary,
  },
  avatarContainer: {
    position: 'relative',
    marginLeft: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.surfaceLight,
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.surface,
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.text,
    lineHeight: 20,
  },
  body: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  time: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  unreadCompactContainer: {
    backgroundColor: `${Colors.dark.primary}05`,
  },
  compactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactContent: {
    flex: 1,
    marginLeft: 12,
  },
  compactTitle: {
    fontSize: 14,
    color: Colors.dark.text,
  },
  compactTime: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  compactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.primary,
    marginLeft: 8,
  },
});
