import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Bell, UserPlus, Play, ChevronRight, Music } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useSets } from '@/contexts/SetsContext';
import AnimatedLogo from '@/components/AnimatedLogo';

interface Artist {
  id: string;
  name: string;
  image: string;
  following: boolean;
  latestSet?: {
    id: string;
    name: string;
    venue: string;
    date: string;
    image: string;
  };
}

interface FeedItem {
  id: string;
  type: 'new_set' | 'live_now';
  artist: Artist;
  set: {
    id: string;
    name: string;
    venue: string;
    date: string;
    image: string;
    duration: string;
    tracksIdentified: number;
  };
  timestamp: Date;
}

const followedArtists: Artist[] = [
  { 
    id: '1', 
    name: 'Dixon', 
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
    following: true,
    latestSet: {
      id: '1',
      name: 'Boiler Room Berlin',
      venue: 'Kreuzberg Warehouse',
      date: '2d ago',
      image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
    }
  },
  { 
    id: '2', 
    name: 'Âme', 
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop',
    following: true,
  },
  { 
    id: '3', 
    name: 'Hunee', 
    image: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=200&h=200&fit=crop',
    following: true,
  },
  { 
    id: '4', 
    name: 'Ben Böhmer', 
    image: 'https://images.unsplash.com/photo-1508854710579-5cecc3a9ff17?w=200&h=200&fit=crop',
    following: true,
  },
];

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

const feedItems: FeedItem[] = [
  {
    id: '1',
    type: 'new_set',
    artist: followedArtists[0],
    set: {
      id: '1',
      name: 'Boiler Room Berlin 2024',
      venue: 'Kreuzberg Warehouse, Berlin',
      date: '2 hours ago',
      image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
      duration: '2h 15m',
      tracksIdentified: 24,
    },
    timestamp: new Date(),
  },
  {
    id: '2',
    type: 'new_set',
    artist: followedArtists[1],
    set: {
      id: '2',
      name: 'Cercle Festival Sunset',
      venue: 'French Alps',
      date: '1 day ago',
      image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
      duration: '1h 30m',
      tracksIdentified: 16,
    },
    timestamp: new Date(Date.now() - 86400000),
  },
  {
    id: '3',
    type: 'new_set',
    artist: followedArtists[2],
    set: {
      id: '3',
      name: 'Dekmantel Festival 2024',
      venue: 'Amsterdamse Bos',
      date: '3 days ago',
      image: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400&h=400&fit=crop',
      duration: '2h 00m',
      tracksIdentified: 28,
    },
    timestamp: new Date(Date.now() - 259200000),
  },
  {
    id: '4',
    type: 'new_set',
    artist: followedArtists[3],
    set: {
      id: '4',
      name: 'Anjunadeep Open Air',
      venue: 'The Brooklyn Mirage, NYC',
      date: '5 days ago',
      image: 'https://images.unsplash.com/photo-1508854710579-5cecc3a9ff17?w=400&h=400&fit=crop',
      duration: '1h 45m',
      tracksIdentified: 20,
    },
    timestamp: new Date(Date.now() - 432000000),
  },
];

export default function FeedScreen() {
  const router = useRouter();
  const { sets } = useSets();
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const toggleFollow = (artistId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFollowing(prev => ({ ...prev, [artistId]: !prev[artistId] }));
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <AnimatedLogo size="medium" />
          <Pressable style={styles.notifButton}>
            <Bell size={22} color={Colors.dark.text} />
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
          <View style={styles.followingSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Following</Text>
              <Text style={styles.sectionCount}>{followedArtists.length} artists</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.followingContainer}
            >
              {followedArtists.map((artist) => (
                <Pressable 
                  key={artist.id} 
                  style={styles.followingItem}
                  onPress={() => {
                    Haptics.selectionAsync();
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

          <View style={styles.feedSection}>
            <Text style={styles.feedTitle}>Recent Activity</Text>
            {realFeedItems.length > 0 ? (
              realFeedItems.map((item) => (
                <Pressable 
                  key={item.id}
                  style={styles.feedCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/(tabs)/(discover)/${item.set.id}`);
                  }}
                >
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
                        <View style={styles.feedSetDivider} />
                        <View style={styles.feedTracksRow}>
                          <Music size={12} color={Colors.dark.textMuted} />
                          <Text style={styles.feedSetTracks}>{item.set.tracksIdentified} tracks</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))
            ) : null}
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
});
