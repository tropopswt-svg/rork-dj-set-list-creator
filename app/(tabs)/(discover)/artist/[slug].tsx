import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  Music,
  Disc3,
  Play,
  ExternalLink,
  CheckCircle,
  MapPin,
  Headphones,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { getArtistBySlug, getArtistTracks, getArtistSets } from '@/lib/supabase';
import type { DbArtist, DbTrack } from '@/lib/supabase/types';

// Social icons mapping
const SOCIAL_LINKS = [
  { key: 'spotify_url', label: 'Spotify', color: '#1DB954' },
  { key: 'soundcloud_url', label: 'SoundCloud', color: '#FF5500' },
  { key: 'instagram_url', label: 'Instagram', color: '#E4405F' },
  { key: 'beatport_url', label: 'Beatport', color: '#94D500' },
  { key: 'bandcamp_url', label: 'Bandcamp', color: '#629AA9' },
  { key: 'resident_advisor_url', label: 'RA', color: '#000000' },
];

export default function ArtistProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  
  const [artist, setArtist] = useState<DbArtist | null>(null);
  const [tracks, setTracks] = useState<DbTrack[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tracks' | 'sets'>('tracks');

  useEffect(() => {
    loadArtist();
  }, [slug]);

  const loadArtist = async () => {
    if (!slug) return;
    
    setIsLoading(true);
    try {
      const artistData = await getArtistBySlug(slug);
      if (artistData) {
        setArtist(artistData);
        
        // Load tracks and sets in parallel
        const [artistTracks, artistSets] = await Promise.all([
          getArtistTracks(artistData.id, 50),
          getArtistSets(artistData.id, 20),
        ]);
        
        setTracks(artistTracks || []);
        setSets(artistSets || []);
      }
    } catch (error) {
      console.error('[ArtistProfile] Error loading artist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenLink = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={styles.loadingText}>Loading artist...</Text>
      </View>
    );
  }

  if (!artist) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>Artist not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const socialLinks = SOCIAL_LINKS.filter(
    (link) => artist[link.key as keyof DbArtist]
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButtonHeader}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={Colors.dark.text} />
          </Pressable>
          
          {/* Artist Image/Avatar */}
          <View style={styles.avatarContainer}>
            {artist.image_url ? (
              <Image
                source={{ uri: artist.image_url }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Headphones size={48} color={Colors.dark.textMuted} />
              </View>
            )}
            {artist.verified && (
              <View style={styles.verifiedBadge}>
                <CheckCircle size={20} color="#fff" fill={Colors.dark.primary} />
              </View>
            )}
          </View>
          
          {/* Artist Name */}
          <Text style={styles.artistName}>{artist.name}</Text>
          
          {/* Country */}
          {artist.country && (
            <View style={styles.countryRow}>
              <MapPin size={14} color={Colors.dark.textMuted} />
              <Text style={styles.countryText}>{artist.country}</Text>
            </View>
          )}
          
          {/* Genres */}
          {artist.genres && artist.genres.length > 0 && (
            <View style={styles.genresContainer}>
              {artist.genres.map((genre, index) => (
                <View key={index} style={styles.genreTag}>
                  <Text style={styles.genreText}>{genre}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{tracks.length}</Text>
              <Text style={styles.statLabel}>Tracks</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{sets.length}</Text>
              <Text style={styles.statLabel}>Sets</Text>
            </View>
          </View>
          
          {/* Social Links */}
          {socialLinks.length > 0 && (
            <View style={styles.socialLinks}>
              {socialLinks.map((link) => (
                <Pressable
                  key={link.key}
                  style={[styles.socialButton, { backgroundColor: `${link.color}20` }]}
                  onPress={() => handleOpenLink(artist[link.key as keyof DbArtist] as string)}
                >
                  <Text style={[styles.socialButtonText, { color: link.color }]}>
                    {link.label}
                  </Text>
                  <ExternalLink size={12} color={link.color} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
        
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <Pressable
            style={[styles.tab, activeTab === 'tracks' && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('tracks');
            }}
          >
            <Music size={16} color={activeTab === 'tracks' ? Colors.dark.primary : Colors.dark.textMuted} />
            <Text style={[styles.tabText, activeTab === 'tracks' && styles.tabTextActive]}>
              Tracks ({tracks.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'sets' && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('sets');
            }}
          >
            <Disc3 size={16} color={activeTab === 'sets' ? Colors.dark.primary : Colors.dark.textMuted} />
            <Text style={[styles.tabText, activeTab === 'sets' && styles.tabTextActive]}>
              Sets ({sets.length})
            </Text>
          </Pressable>
        </View>
        
        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'tracks' && (
            <>
              {tracks.length === 0 ? (
                <View style={styles.emptyState}>
                  <Music size={32} color={Colors.dark.textMuted} />
                  <Text style={styles.emptyText}>No tracks in database yet</Text>
                </View>
              ) : (
                tracks.map((track, index) => (
                  <View key={track.id} style={styles.trackItem}>
                    <View style={styles.trackIndex}>
                      <Text style={styles.trackIndexText}>{index + 1}</Text>
                    </View>
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackTitle} numberOfLines={1}>
                        {track.title}
                        {track.remix_artist_name && (
                          <Text style={styles.remixText}>
                            {' '}({track.remix_artist_name} {track.remix_type || 'Remix'})
                          </Text>
                        )}
                      </Text>
                      <Text style={styles.trackMeta} numberOfLines={1}>
                        {track.label || 'Unknown Label'}
                        {track.release_year && ` • ${track.release_year}`}
                      </Text>
                    </View>
                    {track.is_unreleased && (
                      <View style={styles.unreleasedBadge}>
                        <Text style={styles.unreleasedText}>Unreleased</Text>
                      </View>
                    )}
                    <View style={styles.playsBadge}>
                      <Play size={10} color={Colors.dark.textMuted} />
                      <Text style={styles.playsText}>{track.times_played}</Text>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
          
          {activeTab === 'sets' && (
            <>
              {sets.length === 0 ? (
                <View style={styles.emptyState}>
                  <Disc3 size={32} color={Colors.dark.textMuted} />
                  <Text style={styles.emptyText}>No sets linked yet</Text>
                  <Text style={styles.emptySubtext}>
                    Sets will appear here when imported
                  </Text>
                </View>
              ) : (
                sets.map((set) => (
                  <Pressable
                    key={set.id}
                    style={styles.setItem}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      // Navigate to set if we have external_id
                      if (set.external_id) {
                        router.push(`/(tabs)/(discover)/${set.external_id}`);
                      }
                    }}
                  >
                    {set.cover_url && (
                      <Image
                        source={{ uri: set.cover_url }}
                        style={styles.setCover}
                        contentFit="cover"
                      />
                    )}
                    <View style={styles.setInfo}>
                      <Text style={styles.setName} numberOfLines={1}>
                        {set.name}
                      </Text>
                      <Text style={styles.setMeta}>
                        {set.venue || 'Unknown Venue'}
                        {set.set_date && ` • ${new Date(set.set_date).getFullYear()}`}
                      </Text>
                    </View>
                    <View style={styles.setStats}>
                      <Music size={12} color={Colors.dark.textMuted} />
                      <Text style={styles.setTracksCount}>{set.tracks_count}</Text>
                    </View>
                  </Pressable>
                ))
              )}
            </>
          )}
        </View>
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: Colors.dark.textMuted,
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.dark.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  backButtonHeader: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.dark.surface,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artistName: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  countryText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  genreTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
  },
  genreText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.dark.border,
  },
  socialLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  socialButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    gap: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.textMuted,
  },
  tabTextActive: {
    color: Colors.dark.primary,
  },
  content: {
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.dark.textMuted,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  trackIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trackIndexText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  remixText: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.dark.textSecondary,
  },
  trackMeta: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  unreleasedBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  unreleasedText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  playsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 6,
  },
  playsText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  setItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  setCover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceLight,
    marginRight: 12,
  },
  setInfo: {
    flex: 1,
  },
  setName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  setMeta: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  setStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 6,
  },
  setTracksCount: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  bottomPadding: {
    height: 100,
  },
});
