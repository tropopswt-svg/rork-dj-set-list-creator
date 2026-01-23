import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Heart, MessageCircle, Music, Clock, CheckCircle, Users, Share2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface Friend {
  id: string;
  name: string;
  username: string;
  avatar: string;
}

interface SocialActivity {
  id: string;
  type: 'liked_set' | 'contributed_track' | 'verified_track' | 'commented';
  friend: Friend;
  set?: {
    id: string;
    name: string;
    artist: string;
    image: string;
  };
  track?: {
    title: string;
    artist: string;
    timestamp: string;
  };
  comment?: string;
  timestamp: Date;
}

const friends: Friend[] = [
  { id: '1', name: 'Marcus Weber', username: 'techno_head', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' },
  { id: '2', name: 'Sarah Johnson', username: 'dance_lover92', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop' },
  { id: '3', name: 'Mike Thompson', username: 'basshead_mike', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop' },
  { id: '4', name: 'Emma Chen', username: 'emma_beats', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop' },
];

const socialActivities: SocialActivity[] = [
  {
    id: '1',
    type: 'contributed_track',
    friend: friends[0],
    set: {
      id: '1',
      name: 'Boiler Room Berlin',
      artist: 'Dixon',
      image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
    },
    track: {
      title: 'Strobe',
      artist: 'deadmau5',
      timestamp: '32:15',
    },
    timestamp: new Date(Date.now() - 1800000),
  },
  {
    id: '2',
    type: 'liked_set',
    friend: friends[1],
    set: {
      id: '2',
      name: 'Cercle Festival Sunset',
      artist: 'Âme',
      image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
    },
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: '3',
    type: 'verified_track',
    friend: friends[2],
    set: {
      id: '3',
      name: 'Dekmantel Festival 2024',
      artist: 'Hunee',
      image: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400&h=400&fit=crop',
    },
    track: {
      title: 'Cola',
      artist: 'CamelPhat & Elderbrook',
      timestamp: '45:20',
    },
    timestamp: new Date(Date.now() - 7200000),
  },
  {
    id: '4',
    type: 'contributed_track',
    friend: friends[3],
    set: {
      id: '4',
      name: 'HÖR Berlin Marathon',
      artist: 'Sama\' Abdulhadi',
      image: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=400&h=400&fit=crop',
    },
    track: {
      title: 'Opus',
      artist: 'Eric Prydz',
      timestamp: '1:15:30',
    },
    timestamp: new Date(Date.now() - 14400000),
  },
  {
    id: '5',
    type: 'liked_set',
    friend: friends[0],
    set: {
      id: '5',
      name: 'Warehouse Project Opening',
      artist: 'Ben Böhmer',
      image: 'https://images.unsplash.com/photo-1508854710579-5cecc3a9ff17?w=400&h=400&fit=crop',
    },
    timestamp: new Date(Date.now() - 28800000),
  },
  {
    id: '6',
    type: 'verified_track',
    friend: friends[1],
    set: {
      id: '1',
      name: 'Boiler Room Berlin',
      artist: 'Dixon',
      image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
    },
    track: {
      title: 'Sandstorm',
      artist: 'Darude',
      timestamp: '58:45',
    },
    timestamp: new Date(Date.now() - 43200000),
  },
];

export default function SocialScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [likedActivities, setLikedActivities] = useState<Record<string, boolean>>({});

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const toggleLike = (activityId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLikedActivities(prev => ({ ...prev, [activityId]: !prev[activityId] }));
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'liked_set':
        return <Heart size={14} color={Colors.dark.error} fill={Colors.dark.error} />;
      case 'contributed_track':
        return <Music size={14} color={Colors.dark.primary} />;
      case 'verified_track':
        return <CheckCircle size={14} color={Colors.dark.success} />;
      default:
        return <MessageCircle size={14} color={Colors.dark.textSecondary} />;
    }
  };

  const getActivityText = (activity: SocialActivity) => {
    switch (activity.type) {
      case 'liked_set':
        return 'liked a set';
      case 'contributed_track':
        return 'contributed a track ID';
      case 'verified_track':
        return 'verified a track';
      case 'commented':
        return 'commented';
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Social</Text>
          <Pressable style={styles.friendsButton}>
            <Users size={22} color={Colors.dark.text} />
          </Pressable>
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
          <View style={styles.friendsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Friends</Text>
              <Text style={styles.sectionCount}>{friends.length}</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.friendsContainer}
            >
              {friends.map((friend) => (
                <Pressable 
                  key={friend.id} 
                  style={styles.friendItem}
                  onPress={() => {
                    Haptics.selectionAsync();
                  }}
                >
                  <Image 
                    source={{ uri: friend.avatar }} 
                    style={styles.friendAvatar}
                    contentFit="cover"
                  />
                  <View style={styles.friendOnline} />
                  <Text style={styles.friendName} numberOfLines={1}>@{friend.username}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.addFriendItem}>
                <View style={styles.addFriendCircle}>
                  <Users size={22} color={Colors.dark.primary} />
                </View>
                <Text style={styles.addFriendText}>Find</Text>
              </Pressable>
            </ScrollView>
          </View>

          <View style={styles.activitySection}>
            <Text style={styles.activityTitle}>Activity</Text>
            {socialActivities.map((activity) => (
              <Pressable 
                key={activity.id}
                style={styles.activityCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (activity.set) {
                    router.push(`/(tabs)/(discover)/${activity.set.id}`);
                  }
                }}
              >
                <View style={styles.activityHeader}>
                  <Image 
                    source={{ uri: activity.friend.avatar }} 
                    style={styles.activityAvatar}
                    contentFit="cover"
                  />
                  <View style={styles.activityHeaderText}>
                    <View style={styles.activityNameRow}>
                      <Text style={styles.activityFriendName}>{activity.friend.name}</Text>
                      {getActivityIcon(activity.type)}
                    </View>
                    <Text style={styles.activityAction}>{getActivityText(activity)}</Text>
                  </View>
                  <Text style={styles.activityTime}>{formatTimeAgo(activity.timestamp)}</Text>
                </View>

                {activity.set && (
                  <View style={styles.activityContent}>
                    <Image 
                      source={{ uri: activity.set.image }} 
                      style={styles.activitySetImage}
                      contentFit="cover"
                    />
                    <View style={styles.activitySetInfo}>
                      <Text style={styles.activitySetName} numberOfLines={1}>{activity.set.name}</Text>
                      <Text style={styles.activitySetArtist}>{activity.set.artist}</Text>
                      {activity.track && (
                        <View style={styles.trackBadge}>
                          <Music size={11} color={Colors.dark.primary} />
                          <Text style={styles.trackBadgeText}>
                            {activity.track.artist} - {activity.track.title}
                          </Text>
                          <View style={styles.trackTimestamp}>
                            <Clock size={10} color={Colors.dark.textMuted} />
                            <Text style={styles.trackTimestampText}>{activity.track.timestamp}</Text>
                          </View>
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
                      toggleLike(activity.id);
                    }}
                  >
                    <Heart 
                      size={18} 
                      color={likedActivities[activity.id] ? Colors.dark.error : Colors.dark.textMuted}
                      fill={likedActivities[activity.id] ? Colors.dark.error : 'transparent'}
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
            ))}
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
    fontWeight: '700' as const,
    color: Colors.dark.text,
    letterSpacing: -0.3,
  },
  friendsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  friendsSection: {
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
    fontWeight: '600' as const,
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
  friendsContainer: {
    paddingHorizontal: 16,
    gap: 14,
  },
  friendItem: {
    alignItems: 'center',
    width: 68,
  },
  friendAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 6,
  },
  friendOnline: {
    position: 'absolute',
    top: 40,
    right: 8,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.dark.success,
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },
  friendName: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  addFriendItem: {
    alignItems: 'center',
    width: 68,
  },
  addFriendCircle: {
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
  addFriendText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.dark.primary,
  },
  activitySection: {
    paddingHorizontal: 16,
  },
  activityTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 14,
    paddingHorizontal: 4,
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
    fontWeight: '600' as const,
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
    fontWeight: '600' as const,
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
    fontWeight: '500' as const,
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
