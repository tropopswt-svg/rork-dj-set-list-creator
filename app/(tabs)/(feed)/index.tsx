import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Animated, Easing, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Bell, UserPlus, Play, ChevronRight, Music, Heart, MessageCircle, Share2, LogIn, MapPin, Headphones, Archive } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import Colors from '@/constants/colors';
import { useSets } from '@/contexts/SetsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFollowing, useNotifications, useLikeSet, useFollowArtist } from '@/hooks/useSocial';
import IDentifiedLogo from '@/components/IDentifiedLogo';
import { getPopularVenues, type VenueInfo } from '@/lib/supabase/venueService';
import { getPopularArtists, getArtistSets, type DbArtist } from '@/lib/supabase/artistService';

// Spinning vinyl record component
function SpinningVinyl({ size = 40 }: { size?: number }) {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, []);

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const grooveCount = 3;
  const grooves = [];
  for (let i = 0; i < grooveCount; i++) {
    const grooveSize = size * (0.85 - i * 0.15);
    grooves.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          width: grooveSize,
          height: grooveSize,
          borderRadius: grooveSize / 2,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.3)',
        }}
      />
    );
  }

  return (
    <Animated.View
      style={[
        styles.vinylContainer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ rotate }],
        },
      ]}
    >
      {/* Vinyl grooves */}
      {grooves}
      {/* Center label */}
      <View
        style={[
          styles.vinylLabel,
          {
            width: size * 0.35,
            height: size * 0.35,
            borderRadius: (size * 0.35) / 2,
          },
        ]}
      >
        {/* Center hole */}
        <View
          style={[
            styles.vinylHole,
            {
              width: size * 0.08,
              height: size * 0.08,
              borderRadius: (size * 0.08) / 2,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

// Auto-scrolling horizontal list component
function AutoScrollList({ children, speed = 30 }: { children: React.ReactNode; speed?: number }) {
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const contentWidth = useRef(0);
  const containerWidth = useRef(0);
  const animationRef = useRef<number | null>(null);
  const isPaused = useRef(false);

  useEffect(() => {
    const scroll = () => {
      if (!isPaused.current && scrollViewRef.current && contentWidth.current > containerWidth.current) {
        scrollX.current += 1;

        // Reset to beginning when reaching end
        if (scrollX.current >= contentWidth.current - containerWidth.current) {
          scrollX.current = 0;
        }

        scrollViewRef.current.scrollTo({ x: scrollX.current, animated: false });
      }
      animationRef.current = requestAnimationFrame(scroll);
    };

    const timer = setTimeout(() => {
      animationRef.current = requestAnimationFrame(scroll);
    }, 2000); // Start auto-scroll after 2 seconds

    return () => {
      clearTimeout(timer);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleScrollBeginDrag = () => {
    isPaused.current = true;
  };

  const handleScrollEndDrag = () => {
    // Resume auto-scroll after 3 seconds of no interaction
    setTimeout(() => {
      isPaused.current = false;
    }, 3000);
  };

  const handleScroll = (event: any) => {
    scrollX.current = event.nativeEvent.contentOffset.x;
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.discoverContainer}
      onContentSizeChange={(w) => { contentWidth.current = w; }}
      onLayout={(e) => { containerWidth.current = e.nativeEvent.layout.width; }}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleScrollEndDrag}
      onScroll={handleScroll}
      scrollEventThrottle={16}
    >
      {children}
    </ScrollView>
  );
}

// Helper to detect B2B/B3B from artist name
function getB2BInfo(artistName: string): { isB2B: boolean; count: number } {
  // Check for explicit b2b/b3b patterns
  const b2bMatch = artistName.toLowerCase().match(/b(\d)b/);
  if (b2bMatch) {
    return { isB2B: true, count: parseInt(b2bMatch[1], 10) };
  }

  // Normalize the name for checking
  const normalized = artistName.toLowerCase();

  // Check for various separators (with or without spaces)
  // Use regex to split by common separators
  const separatorRegex = /\s*(&|(\sx\s)|(\svs\.?\s)|(\sand\s))\s*/gi;

  // Count how many parts we get when splitting
  const parts = artistName.split(separatorRegex).filter(p => {
    // Filter out the separator matches and empty strings
    return p && p.trim().length > 1 && !p.match(/^(&|x|vs\.?|and)$/i);
  });

  if (parts.length >= 2) {
    return { isB2B: true, count: parts.length };
  }

  // Also check for simple "&" that might not have spaces
  // e.g., "&ME & Black Coffee" - the middle & separates two artists
  const ampersandCount = (artistName.match(/&/g) || []).length;
  if (ampersandCount >= 1) {
    // Check if there's a pattern like "Name & Name" (not just "&ME" which starts with &)
    const hasMiddleAmpersand = artistName.match(/[a-zA-Z]\s*&\s*[a-zA-Z]/);
    if (hasMiddleAmpersand) {
      // Count artists by splitting on & but being smart about it
      const artistParts = artistName.split(/\s*&\s*/).filter(p => p.trim().length > 0);
      if (artistParts.length >= 2) {
        return { isB2B: true, count: artistParts.length };
      }
    }
  }

  return { isB2B: false, count: 1 };
}

// Discover artist card component with follow functionality
function DiscoverArtistCard({ artist }: { artist: DbArtist }) {
  const router = useRouter();
  const { user } = useAuth();
  const { isFollowing, isLoading, toggleFollow } = useFollowArtist(artist.id);
  const b2bInfo = getB2BInfo(artist.name);

  const handlePress = () => {
    Haptics.selectionAsync();
    router.push(`/(tabs)/(discover)/artist/${artist.slug}`);
  };

  const handleFollow = () => {
    Haptics.selectionAsync();
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    toggleFollow();
  };

  return (
    <Pressable style={styles.discoverCard} onPress={handlePress}>
      <View style={styles.discoverImageWrapper}>
        {artist.image_url ? (
          <Image
            source={{ uri: artist.image_url }}
            style={styles.discoverImage}
            contentFit="cover"
          />
        ) : (
          <SpinningVinyl size={40} />
        )}
        {b2bInfo.isB2B && (
          <View style={styles.b2bBadge}>
            <Text style={styles.b2bBadgeText}>B{b2bInfo.count}B</Text>
          </View>
        )}
      </View>
      <View style={styles.discoverInfo}>
        <Text style={styles.discoverName} numberOfLines={2}>{artist.name}</Text>
      </View>
      <Pressable onPress={handleFollow} disabled={isLoading} hitSlop={8}>
        {isLoading ? (
          <ActivityIndicator size="small" color={Colors.dark.primary} />
        ) : isFollowing ? (
          <View style={styles.followedBadge}>
            <Text style={styles.followedText}>✓</Text>
          </View>
        ) : (
          <UserPlus size={18} color={Colors.dark.primary} />
        )}
      </Pressable>
    </Pressable>
  );
}

// Feed item component with like functionality
function FeedCard({ item, onPress }: { item: any; onPress: () => void }) {
  const { user } = useAuth();
  const { isLiked, isLoading: likeLoading, toggleLike } = useLikeSet(item.set.id);
  const router = useRouter();

  const handleLike = () => {
    if (!user) {
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
        await Sharing.shareAsync(`https://trackd.app/set/${item.set.id}`, {
          dialogTitle: `Check out ${item.set.name} on TRACK'D`,
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
  const { user, profile } = useAuth();
  const { followedArtists, isLoading: followingLoading } = useFollowing();
  const { unreadCount } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [popularVenues, setPopularVenues] = useState<VenueInfo[]>([]);
  const [discoverArtists, setDiscoverArtists] = useState<DbArtist[]>([]);
  const [discoverTab, setDiscoverTab] = useState<'artists' | 'venues'>('artists');
  const [followedArtistSets, setFollowedArtistSets] = useState<any[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);

  // Load popular venues and artists
  useEffect(() => {
    loadDiscoverData();
  }, []);

  // Load sets from database for followed artists
  useEffect(() => {
    if (user && followedArtists.length > 0 && !followingLoading) {
      loadFollowedArtistSets();
    }
  }, [user, followedArtists, followingLoading]);

  const loadFollowedArtistSets = async () => {
    setLoadingSets(true);
    try {
      // Get artist IDs from followed artists
      const artistIds = followedArtists
        .map(f => f.following_artist?.id)
        .filter(Boolean) as string[];

      // Fetch sets for each artist from the database
      const setsPromises = artistIds.map(id => getArtistSets(id, 10));
      const setsResults = await Promise.all(setsPromises);

      // Flatten and dedupe sets
      const allSets = setsResults.flat();
      const uniqueSets = allSets.filter((set, index, self) =>
        index === self.findIndex(s => s.id === set.id)
      );

      setFollowedArtistSets(uniqueSets);
    } catch (error) {
      console.error('[Feed] Error loading followed artist sets:', error);
    }
    setLoadingSets(false);
  };

  const loadDiscoverData = async () => {
    const [venues, artists] = await Promise.all([
      getPopularVenues(10),
      getPopularArtists(10),
    ]);
    setPopularVenues(venues);
    setDiscoverArtists(artists);
  };

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

  // Get names of followed artists for filtering
  const followedArtistNames = useMemo(() => {
    if (!user || followedArtists.length === 0) return [];
    return followedArtists
      .map(f => f.following_artist?.name?.toLowerCase())
      .filter(Boolean) as string[];
  }, [user, followedArtists]);

  // Use database sets from followed artists, fall back to local sets
  const realFeedItems = useMemo(() => {
    // If user is logged in and we have sets from followed artists in database
    if (user && followedArtistSets.length > 0) {
      return followedArtistSets
        .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())
        .slice(0, 20)
        .map(set => ({
          id: set.id,
          type: 'new_set' as const,
          artist: {
            id: set.dj_name || set.artist_name,
            name: set.dj_name || set.artist_name,
            image: set.cover_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
            following: true,
          },
          set: {
            id: set.id,
            name: set.name,
            venue: set.venue || '',
            date: formatDate(new Date(set.created_at || set.date)),
            image: set.cover_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
            duration: set.duration ? formatDuration(set.duration) : '',
            tracksIdentified: set.tracks_count || 0,
          },
          timestamp: new Date(set.created_at || set.date),
        }));
    }

    // Fall back to local sets (show all if not logged in)
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
  }, [sets, user, followedArtistSets]);

  // Artists the user follows
  const followedArtistsList = useMemo(() => {
    if (!user || followedArtists.length === 0) {
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
  }, [user, followedArtists]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadDiscoverData(),
      user && followedArtists.length > 0 ? loadFollowedArtistSets() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [user, followedArtists]);

  const handleNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    router.push('/(tabs)/(social)/notifications');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft} />
          <IDentifiedLogo size="medium" />
          <View style={styles.headerRight}>
            {!user && (
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
          {/* Quick Navigation Buttons */}
          <View style={styles.quickNavSection}>
            <Pressable
              style={styles.quickNavButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(tabs)/(discover)');
              }}
            >
              <Music size={14} color="#fff" />
              <Text style={styles.quickNavText}>Sets</Text>
            </Pressable>

            <Pressable
              style={styles.quickNavButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(tabs)/(social)');
              }}
            >
              <Archive size={14} color="#fff" />
              <Text style={styles.quickNavText}>Crate</Text>
            </Pressable>
          </View>

          {/* Discover Section - Artists & Venues */}
          <View style={styles.discoverSection}>
            <View style={styles.discoverHeaderRow}>
              <Text style={styles.sectionTitle}>Discover</Text>
              <View style={styles.discoverToggle}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    discoverTab === 'artists' && styles.toggleButtonActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDiscoverTab('artists');
                  }}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      discoverTab === 'artists' && styles.toggleButtonTextActive,
                    ]}
                  >
                    Artists
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    discoverTab === 'venues' && styles.toggleButtonActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDiscoverTab('venues');
                  }}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      discoverTab === 'venues' && styles.toggleButtonTextActive,
                    ]}
                  >
                    Venues
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.seeAllButton}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(discoverTab === 'artists' ? '/(tabs)/(feed)/artists' : '/(tabs)/(feed)/venues');
                }}
              >
                <Text style={styles.seeAllText}>See all</Text>
                <ChevronRight size={14} color={Colors.dark.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.discoverContainer}
              key={discoverTab}
            >
              {/* Artists */}
              {discoverTab === 'artists' && discoverArtists.map((artist) => (
                <DiscoverArtistCard key={artist.id} artist={artist} />
              ))}
              {discoverTab === 'artists' && discoverArtists.length === 0 && (
                <View style={styles.discoverEmpty}>
                  <Text style={styles.discoverEmptyText}>No artists found</Text>
                </View>
              )}
              {/* Venues */}
              {discoverTab === 'venues' && popularVenues.map((venue) => (
                <Pressable
                  key={`venue-${venue.name}`}
                  style={styles.discoverCard}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push({
                      pathname: '/(tabs)/(feed)/venue/[name]',
                      params: { name: venue.name },
                    });
                  }}
                >
                  {venue.imageUrl ? (
                    <Image
                      source={{ uri: venue.imageUrl }}
                      style={[styles.discoverImage, styles.venueImageStyle]}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.discoverImage, styles.discoverImagePlaceholder]}>
                      <MapPin size={18} color={Colors.dark.textMuted} />
                    </View>
                  )}
                  <View style={styles.discoverInfo}>
                    <Text style={styles.discoverName} numberOfLines={2}>{venue.name}</Text>
                  </View>
                  <ChevronRight size={16} color={Colors.dark.textMuted} />
                </Pressable>
              ))}
              {discoverTab === 'venues' && popularVenues.length === 0 && (
                <View style={styles.discoverEmpty}>
                  <Text style={styles.discoverEmptyText}>No venues found</Text>
                </View>
              )}
            </ScrollView>
          </View>

          {/* Recent Activity Feed */}
          <View style={styles.feedSection}>
            <Text style={styles.feedTitle}>
              {user && followedArtists.length > 0 ? 'From Artists You Follow' : 'Recent Activity'}
            </Text>
            {loadingSets ? (
              <View style={styles.loadingFeed}>
                <ActivityIndicator color={Colors.dark.primary} />
                <Text style={styles.loadingFeedText}>Loading sets...</Text>
              </View>
            ) : realFeedItems.length > 0 ? (
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
                <Text style={styles.emptyFeedText}>
                  {user && followedArtists.length > 0
                    ? 'No sets from followed artists'
                    : 'No sets yet'}
                </Text>
                <Text style={styles.emptyFeedSubtext}>
                  {user && followedArtists.length > 0
                    ? 'Sets from artists you follow will appear here'
                    : 'Follow artists to see their latest sets'}
                </Text>
                <Pressable
                  style={styles.browseButton}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/(tabs)/(discover)');
                  }}
                >
                  <Text style={styles.browseButtonText}>Browse All Sets</Text>
                </Pressable>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    width: 90, // Match headerRight width for centering
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    width: 90,
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
  quickNavSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  quickNavButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C41E3A',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  quickNavText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
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
  discoverSection: {
    marginBottom: 24,
  },
  discoverHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
    gap: 12,
    zIndex: 10,
  },
  discoverToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  toggleButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  toggleButtonActive: {
    backgroundColor: Colors.dark.primary,
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textMuted,
  },
  toggleButtonTextActive: {
    color: '#fff',
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
  discoverContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  discoverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
    minWidth: 180,
    maxWidth: 220,
  },
  discoverImageWrapper: {
    position: 'relative',
    overflow: 'visible',
  },
  discoverImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surfaceLight,
  },
  discoverImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  vinylContainer: {
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  vinylLabel: {
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylHole: {
    backgroundColor: '#1a1a1a',
  },
  venueImageStyle: {
    borderRadius: 8,
  },
  b2bBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: Colors.dark.primary,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: Colors.dark.surface,
  },
  b2bBadgeText: {
    fontSize: 8,
    fontWeight: '700' as const,
    color: '#fff',
  },
  discoverInfo: {
    flex: 1,
    minWidth: 0,
  },
  discoverName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    lineHeight: 16,
  },
  discoverType: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  followedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followedText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600' as const,
  },
  discoverEmpty: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  discoverEmptyText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
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
  browseButton: {
    marginTop: 16,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  browseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  loadingFeed: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingFeedText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
});
