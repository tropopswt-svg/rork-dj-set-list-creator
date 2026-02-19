import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Linking, ScrollView, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { Audio } from 'expo-av';
import {
  X,
  Play,
  Pause,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Music,
  Disc3,
  Calendar,
  BarChart3,
  Shield,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { Track, TrackLink } from '@/types';

interface TrackDetailModalProps {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
  onPlayTimestamp?: () => void;
}

// Platform icons/colors
const PLATFORM_CONFIG: Record<string, { label: string; color: string; icon?: string }> = {
  spotify: { label: 'Spotify', color: '#1DB954' },
  beatport: { label: 'Beatport', color: '#94D500' },
  soundcloud: { label: 'SoundCloud', color: '#FF5500' },
  bandcamp: { label: 'Bandcamp', color: '#629AA9' },
  youtube: { label: 'YouTube', color: '#FF0000' },
  apple_music: { label: 'Apple Music', color: '#FC3C44' },
  other: { label: 'Link', color: Colors.dark.textMuted },
};

export default function TrackDetailModal({
  visible,
  track,
  onClose,
  onPlayTimestamp,
}: TrackDetailModalProps) {
  const router = useRouter();
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Clean up audio on close
  useEffect(() => {
    if (!visible) {
      stopPreview();
    }
    return () => { stopPreview(); };
  }, [visible]);

  const stopPreview = async () => {
    if (progressAnimRef.current) {
      progressAnimRef.current.stop();
      progressAnimRef.current = null;
    }
    progressAnim.setValue(0);
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    setIsPlayingPreview(false);
  };

  const playPreview = async () => {
    if (!track?.previewUrl) return;

    if (isPlayingPreview) {
      await stopPreview();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.previewUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setIsPlayingPreview(true);

      // Animate progress bar over 30 seconds
      progressAnim.setValue(0);
      const anim = Animated.timing(progressAnim, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      progressAnimRef.current = anim;
      anim.start();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          stopPreview();
        }
      });
    } catch {
      setIsPlayingPreview(false);
    }
  };

  if (!track) return null;

  const formatTimestamp = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOpenLink = (link: TrackLink) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(link.url);
  };

  const handleArtistPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    const slug = track.artist.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    router.push(`/artist/${slug}`);
  };

  const handlePlayTimestamp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    onPlayTimestamp?.();
  };

  const isSpotifyVerified = !!track.isReleased;

  const getSourceBadge = () => {
    if (track.isId) {
      return { label: 'Unidentified', color: Colors.dark.primary, icon: AlertCircle };
    }
    if (track.isUnreleased) {
      return { label: 'Unreleased', color: '#EC4899', icon: AlertCircle };
    }
    if (isSpotifyVerified) {
      return { label: 'Verified on Spotify', color: '#1DB954', icon: Shield };
    }
    return { label: 'Released', color: Colors.dark.success, icon: CheckCircle };
  };

  const statusBadge = getSourceBadge();
  const StatusIcon = statusBadge.icon;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Track Details</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={24} color={Colors.dark.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Track Info */}
            <View style={styles.trackInfo}>
              <Image 
                source={{ uri: track.coverUrl }} 
                style={styles.cover}
              />
              <View style={styles.trackDetails}>
                <Text style={styles.title} numberOfLines={2}>{track.title}</Text>
                
                {/* Artist - Clickable */}
                <Pressable style={styles.artistRow} onPress={handleArtistPress}>
                  <Text style={styles.artist}>{track.artist}</Text>
                  <ChevronRight size={16} color={Colors.dark.primary} />
                </Pressable>

                {/* Status Badge */}
                <View style={[styles.statusBadge, { backgroundColor: `${statusBadge.color}20` }]}>
                  <StatusIcon size={12} color={statusBadge.color} />
                  <Text style={[styles.statusText, { color: statusBadge.color }]}>
                    {statusBadge.label}
                  </Text>
                </View>
              </View>
            </View>

            {/* Timestamp & Play Button */}
            {track.timestamp !== undefined && (
              <Pressable style={styles.timestampSection} onPress={handlePlayTimestamp}>
                <View style={styles.timestampInfo}>
                  <Clock size={16} color={Colors.dark.primary} />
                  <Text style={styles.timestampLabel}>Timestamp</Text>
                  <Text style={styles.timestampValue}>{formatTimestamp(track.timestamp)}</Text>
                </View>
                <View style={styles.playButton}>
                  <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.playButtonText}>Play at Timestamp</Text>
                </View>
              </Pressable>
            )}

            {/* Spotify Preview Player */}
            {track.previewUrl && (
              <Pressable style={styles.previewSection} onPress={playPreview}>
                <View style={styles.previewLeft}>
                  <View style={[styles.previewPlayBtn, isPlayingPreview && styles.previewPlayBtnActive]}>
                    {isPlayingPreview ?
                      <Pause size={16} color="#FFFFFF" fill="#FFFFFF" /> :
                      <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                    }
                  </View>
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewLabel}>
                      {isPlayingPreview ? 'Playing Preview' : '30-Second Preview'}
                    </Text>
                    <View style={styles.previewBarBg}>
                      <Animated.View style={[styles.previewBarFill, {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      }]} />
                    </View>
                  </View>
                </View>
                <Text style={styles.previewPowered}>Spotify</Text>
              </Pressable>
            )}

            {/* Track Metadata */}
            <View style={styles.metaSection}>
              {track.album && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Album</Text>
                  <Text style={styles.metaValue} numberOfLines={1}>{track.album}</Text>
                </View>
              )}
              {track.releaseDate && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Released</Text>
                  <Text style={styles.metaValue}>{track.releaseDate.substring(0, 4)}</Text>
                </View>
              )}
              {track.bpm ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>BPM</Text>
                  <Text style={styles.metaValue}>{track.bpm}</Text>
                </View>
              ) : null}
              {track.key ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Key</Text>
                  <Text style={styles.metaValue}>{track.key}</Text>
                </View>
              ) : null}
              {(track.popularity !== undefined && track.popularity > 0) && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Popularity</Text>
                  <View style={styles.popularityBar}>
                    <View style={[styles.popularityFill, { width: `${track.popularity}%` }]} />
                  </View>
                </View>
              )}
            </View>

            {/* Listen Links */}
            <View style={styles.linksSection}>
              <Text style={styles.sectionLabel}>Listen On</Text>
              <View style={styles.linksGrid}>
                {track.trackLinks && track.trackLinks.length > 0 ? (
                  track.trackLinks.map((link, index) => {
                    const config = PLATFORM_CONFIG[link.platform] || PLATFORM_CONFIG.other;
                    return (
                      <Pressable
                        key={`${link.platform}-${index}`}
                        style={[styles.linkCard, { borderColor: `${config.color}40` }]}
                        onPress={() => handleOpenLink(link)}
                      >
                        <View style={[styles.linkIcon, { backgroundColor: `${config.color}20` }]}>
                          <Music size={16} color={config.color} />
                        </View>
                        <Text style={[styles.linkText, { color: config.color }]}>
                          {config.label}
                        </Text>
                        <ExternalLink size={12} color={config.color} />
                      </Pressable>
                    );
                  })
                ) : (
                  <Pressable
                    style={[styles.linkCard, styles.spotifySearchCard]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const query = encodeURIComponent(`${track.artist} ${track.title}`);
                      Linking.openURL(`https://open.spotify.com/search/${query}`);
                    }}
                  >
                    <View style={[styles.linkIcon, { backgroundColor: 'rgba(29, 185, 84, 0.2)' }]}>
                      <Music size={16} color="#1DB954" />
                    </View>
                    <Text style={[styles.linkText, { color: '#1DB954' }]}>
                      Search on Spotify
                    </Text>
                    <ExternalLink size={12} color="#1DB954" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Artist Section */}
            <View style={styles.artistSection}>
              <Text style={styles.sectionLabel}>Artist</Text>
              <Pressable style={styles.artistCard} onPress={handleArtistPress}>
                <View style={styles.artistIconContainer}>
                  <Disc3 size={24} color={Colors.dark.primary} />
                </View>
                <View style={styles.artistCardInfo}>
                  <Text style={styles.artistCardName}>{track.artist}</Text>
                  <Text style={styles.artistCardSubtext}>View all tracks & sets</Text>
                </View>
                <ChevronRight size={20} color={Colors.dark.textMuted} />
              </Pressable>
            </View>

            {/* Contributor Credit */}
            {track.contributedBy && (
              <View style={styles.contributorSection}>
                <Text style={styles.contributorText}>
                  Track ID contributed by <Text style={styles.contributorName}>@{track.contributedBy}</Text>
                </Text>
              </View>
            )}

            {/* Featured In Sets */}
            {track.featuredIn && track.featuredIn.length > 0 && (
              <View style={styles.featuredSection}>
                <Text style={styles.sectionLabel}>
                  Featured In {track.featuredIn.length} Other Set{track.featuredIn.length !== 1 ? 's' : ''}
                </Text>
                {track.featuredIn.slice(0, 3).map((set, index) => (
                  <Pressable
                    key={`${set.setId}-${index}`}
                    style={styles.featuredSetCard}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                      router.push(`/${set.setId}`);
                    }}
                  >
                    <Image
                      source={{ uri: set.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop' }}
                      style={styles.featuredSetCover}
                    />
                    <View style={styles.featuredSetInfo}>
                      <Text style={styles.featuredSetName} numberOfLines={1}>{set.setName}</Text>
                      <Text style={styles.featuredSetArtist} numberOfLines={1}>{set.artist}</Text>
                    </View>
                    <View style={styles.featuredSetTimestamp}>
                      <Clock size={10} color={Colors.dark.primary} />
                      <Text style={styles.featuredSetTime}>{formatTimestamp(set.timestamp)}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  trackInfo: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  cover: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceLight,
  },
  trackDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 6,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  artist: {
    fontSize: 15,
    color: Colors.dark.primary,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timestampSection: {
    backgroundColor: Colors.dark.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  timestampInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  timestampLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  timestampValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.primary,
    fontVariant: ['tabular-nums'],
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metaSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metaItem: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  linksSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  linkIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  spotifySearchCard: {
    borderColor: 'rgba(29, 185, 84, 0.4)',
    flex: 1,
  },
  previewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.25)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  previewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  previewPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlayBtnActive: {
    backgroundColor: '#16a34a',
  },
  previewInfo: {
    flex: 1,
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1DB954',
    marginBottom: 6,
  },
  previewBarBg: {
    height: 3,
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  previewBarFill: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 2,
  },
  previewPowered: {
    fontSize: 10,
    color: 'rgba(29, 185, 84, 0.6)',
    fontWeight: '600',
    marginLeft: 8,
  },
  popularityBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  popularityFill: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 2,
  },
  artistSection: {
    marginBottom: 20,
  },
  artistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  artistIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artistCardInfo: {
    flex: 1,
  },
  artistCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  artistCardSubtext: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  contributorSection: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  contributorText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  contributorName: {
    color: Colors.dark.primary,
    fontWeight: '600',
  },
  featuredSection: {
    marginBottom: 20,
  },
  featuredSetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  featuredSetCover: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceLight,
  },
  featuredSetInfo: {
    flex: 1,
  },
  featuredSetName: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.dark.text,
  },
  featuredSetArtist: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  featuredSetTimestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredSetTime: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
});
