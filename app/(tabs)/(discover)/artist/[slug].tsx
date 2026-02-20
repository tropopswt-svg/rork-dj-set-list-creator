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
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Play,
  ExternalLink,
  CheckCircle,
  MapPin,
  Headphones,
} from 'lucide-react-native';
import TrackdLogo from '@/components/TrackdLogo';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { getArtistBySlug, getArtistTracks, getArtistSets } from '@/lib/supabase';
import type { DbArtist, DbTrack } from '@/lib/supabase/types';
import ArtistHeatMap from '@/components/ArtistHeatMap';

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
  const [activeTab, setActiveTab] = useState<'tracks' | 'sets'>('sets');

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
      if (__DEV__) console.error('[ArtistProfile] Error loading artist:', error);
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
        {/* Header with Heatmap Background */}
        <View style={styles.headerWrapper}>
          {/* Map background layer */}
          <View style={styles.mapBg}>
            <ArtistHeatMap artistSlug={slug} backgroundMode />
          </View>

          {/* Gradient overlay for readability — passes touches through to map */}
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.7)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Artist info overlaid — box-none lets empty areas pass touches to map */}
          <View style={styles.header} pointerEvents="box-none">
            <Pressable
              style={styles.backButtonHeader}
              onPress={() => router.back()}
            >
              <ArrowLeft size={24} color="#fff" />
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
                  <Headphones size={48} color="rgba(255,255,255,0.5)" />
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
                <MapPin size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.countryText}>{artist.country}</Text>
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
                    style={[styles.socialButton, { backgroundColor: `${link.color}30` }]}
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
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <Pressable
            style={[styles.setsTab, activeTab === 'sets' && styles.setsTabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('sets');
            }}
          >
            <Text style={[styles.setsTabText, activeTab === 'sets' && styles.setsTabTextActive]}>
              Sets ({sets.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tracksToggle, activeTab === 'tracks' && styles.tracksToggleActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('tracks');
            }}
          >
            <Text style={[styles.tracksToggleText, activeTab === 'tracks' && styles.tracksToggleTextActive]}>
              Tracks
            </Text>
          </Pressable>
        </View>
        
        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'tracks' && (
            <>
              {tracks.length === 0 ? (
                <View style={styles.emptyState}>
                  <TrackdLogo size="small" />
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
                  <TrackdLogo size="small" />
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
                      router.push(`/(tabs)/(discover)/${set.id}`);
                    }}
                  >
                    {(set.cover_url || set.youtube_url) && (
                      <Image
                        source={{ uri: set.cover_url || (set.youtube_url ? `https://img.youtube.com/vi/${set.youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]}/mqdefault.jpg` : undefined) }}
                        style={styles.setCover}
                        contentFit="cover"
                      />
                    )}
                    <View style={styles.setInfo}>
                      <Text style={styles.setName} numberOfLines={1}>
                        {set.title || set.name}
                      </Text>
                      <Text style={styles.setMeta}>
                        {set.venue || 'Unknown Venue'}
                        {set.event_date && ` • ${new Date(set.event_date).getFullYear()}`}
                      </Text>
                    </View>
                    {(set.track_count || 0) > 0 && (
                      <View style={styles.trakdBadge}>
                        <CheckCircle size={10} color="#fff" />
                        <Text style={styles.trakdText}>trakd</Text>
                      </View>
                    )}
                    <View style={styles.setStats}>
                      <Text style={styles.setTracksCount}>{set.track_count || 0} tracks</Text>
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
  headerWrapper: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 380,
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
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
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: '#333',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artistName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  countryText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
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
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    gap: 12,
  },
  setsTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: '#DC2626',
    gap: 10,
  },
  setsTabActive: {
    backgroundColor: '#DC2626',
  },
  setsTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  setsTabTextActive: {
    color: '#fff',
  },
  tracksToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tracksToggleActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
  },
  tracksToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.dark.textMuted,
  },
  tracksToggleTextActive: {
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
  trakdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.dark.primary,
    borderRadius: 6,
    marginRight: 6,
  },
  trakdText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
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
