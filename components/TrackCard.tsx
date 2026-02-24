import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Plus, CheckCircle, User, ThumbsUp, Disc3, Clock, Link2, ExternalLink, X, AlertCircle, Youtube, Music2, Wand2, ShieldCheck, HelpCircle, CircleDot, Sparkles, Volume2, Play, Pause } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { Track } from '@/types';
import { getPublicTrackStatus } from '@/lib/trackStatus';

interface TrackCardProps {
  track: Track;
  onPress?: () => void;
  onAddToSet?: () => void;
  showIndex?: number;
  showTimestamp?: boolean;
  compact?: boolean;
  slim?: boolean; // Thin rendering for unidentified tracks
  onUpvote?: () => void;
  onContributorPress?: (username: string) => void;
  onIdentify?: () => void;
  onListen?: () => void; // Play audio preview to help identify
  onIDThis?: () => void; // Open crowd-sourcing modal for unknown track
  onPlayPreview?: () => void; // Play/pause Deezer/Spotify preview
  isCurrentlyPlaying?: boolean;
  isPreviewLoading?: boolean;
  hasPreview?: boolean;
  previewFailed?: boolean; // Brief "no preview" feedback
}

export default function TrackCard({
  track,
  onPress,
  onAddToSet,
  showIndex,
  showTimestamp,
  compact,
  slim,
  onUpvote,
  onContributorPress,
  onIdentify,
  onListen,
  onIDThis,
  onPlayPreview,
  isCurrentlyPlaying,
  isPreviewLoading,
  hasPreview,
  previewFailed,
}: TrackCardProps) {
  const router = useRouter();
  const [showFeaturedModal, setShowFeaturedModal] = useState(false);

  const formatTimestamp = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const handleAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddToSet?.();
  };

  const handleFeaturedPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFeaturedModal(true);
  };

  const handleNavigateToSet = (setId: string) => {
    setShowFeaturedModal(false);
    router.push(`/${setId}`);
  };

  // Determine how many distinct platforms identified this track
  const getVerificationLevel = () => {
    let sources: string[] = [];

    // Only count actual identification sources/platforms, not flags
    if (track.source === '1001tracklists' || track.source === 'database') {
      sources.push('unverified');
    }
    if (track.source === 'youtube') {
      sources.push('youtube');
    }
    if (track.source === 'soundcloud') {
      sources.push('soundcloud');
    }
    if (track.source === 'manual' || track.source === 'user') {
      sources.push('user');
    }

    // Check if track was also confirmed by other platforms (stored in metadata)
    if ((track as any).confirmedBy) {
      const confirmedBy = (track as any).confirmedBy as string[];
      confirmedBy.forEach((platform: string) => {
        if (!sources.includes(platform)) {
          sources.push(platform);
        }
      });
    }

    return sources;
  };

  // Get platform-specific source icon and color
  // Clear hierarchy:
  // - 1001tracklists = baseline, not yet confirmed by user comments
  // - youtube/soundcloud = CONFIRMED by comment analysis (most trusted)
  // - manual/user = added by community
  const getSourceInfo = () => {
    // CONFIRMED: Track was validated by YouTube comment analysis
    if (track.source === 'youtube') {
      return { icon: 'confirmed', color: '#22C55E', label: 'Confirmed', subIcon: 'youtube' };
    }

    // CONFIRMED: Track was validated by SoundCloud comment analysis
    if (track.source === 'soundcloud') {
      return { icon: 'confirmed', color: '#22C55E', label: 'Confirmed', subIcon: 'soundcloud' };
    }

    // User manually added this track
    if (track.source === 'manual' || track.source === 'user') {
      return { icon: 'user', color: '#8B5CF6', label: 'Added' };
    }

    // Community/social contributions
    if (track.source === 'social') {
      return { icon: 'user', color: '#10B981', label: 'Community' };
    }

    // BASELINE: From 1001Tracklists - not yet confirmed by comments
    if (track.source === '1001tracklists' || track.source === 'database') {
      return { icon: 'unverified', color: Colors.dark.textMuted, label: 'Unverified' };
    }

    // Fallback for ID tracks (unidentified)
    if (track.isId) {
      return { icon: 'unknown', color: Colors.dark.textMuted, label: '?' };
    }

    // Default: baseline data
    return { icon: 'unverified', color: Colors.dark.textMuted, label: 'Unverified' };
  };

  const renderSourceIcon = () => {
    const info = getSourceInfo();
    if (!info) return null;

    const iconSize = 11;
    let IconComponent = null;

    switch (info.icon) {
      case 'confirmed':
        // Confirmed by YouTube or SoundCloud analysis - show checkmark with platform indicator
        IconComponent = <CheckCircle size={iconSize} color={info.color} />;
        break;
      case 'unverified':
        // Baseline data - not yet confirmed by comments
        IconComponent = <AlertCircle size={iconSize} color={info.color} />;
        break;
      case 'youtube':
        IconComponent = <Youtube size={iconSize} color={info.color} />;
        break;
      case 'soundcloud':
        IconComponent = <Music2 size={iconSize} color={info.color} />;
        break;
      case 'user':
        IconComponent = <User size={iconSize} color={info.color} />;
        break;
      case 'unknown':
        IconComponent = <AlertCircle size={iconSize} color={info.color} />;
        break;
      default:
        return null;
    }

    // For confirmed tracks, show T'D badge with platform indicator
    if (info.icon === 'confirmed' && (info as any).subIcon) {
      const subIconSize = 9;
      const SubIcon = (info as any).subIcon === 'youtube'
        ? <Youtube size={subIconSize} color="#FF0000" />
        : <Music2 size={subIconSize} color="#FF5500" />;

      return (
        <View style={styles.confirmedContainer}>
          <View style={styles.tdBadge}>
            <Text style={styles.tdBadgeText}>trakd</Text>
          </View>
          <View style={styles.subIconContainer}>
            {SubIcon}
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.sourceTag, { backgroundColor: `${info.color}18` }]}>
        {IconComponent}
        <Text style={[styles.sourceTagText, { color: info.color }]}>{info.label}</Text>
      </View>
    );
  };

  // Render verification badge showing how many sources confirmed this track
  const renderVerificationBadge = () => {
    const sources = getVerificationLevel();

    // Don't show if only 1 source or none
    if (sources.length <= 1) return null;

    // Multiple sources verified this track
    return (
      <View style={styles.verificationBadge}>
        <ShieldCheck size={10} color="#22C55E" />
        <Text style={styles.verificationText}>x{sources.length}</Text>
      </View>
    );
  };

  const featuredCount = track.featuredIn?.length || 0;

  if (compact) {
    return (
      <Pressable style={styles.compactContainer} onPress={handlePress}>
        <Image source={{ uri: track.coverUrl }} style={styles.compactCover} placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} transition={250} />
        <View style={styles.compactInfo}>
          <Text style={styles.compactTitle} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.compactArtist} numberOfLines={1}>{track.artist}</Text>
        </View>
      </Pressable>
    );
  }

  if (slim) {
    return (
      <Pressable style={styles.slimContainer} onPress={handlePress}>
        {showTimestamp && track.timestamp !== undefined && (
          <View style={styles.slimTimestamp}>
            <Text style={styles.slimTimestampText}>{formatTimestamp(track.timestamp)}</Text>
          </View>
        )}
        <View style={styles.slimDash} />
        <Text style={styles.slimTitle} numberOfLines={1}>Unknown Track</Text>
      </Pressable>
    );
  }

  const publicStatus = getPublicTrackStatus(track);

  // Check if this is an unidentified track that needs to be filled in
  const isUnidentified = publicStatus === 'id';

  // Check if this is a partial ID - we have the artist but the title is unknown
  // These should be treated as unreleased since we have some info to work with
  const isPartialId = isUnidentified &&
    track.artist &&
    track.artist.toLowerCase() !== 'id' &&
    track.artist.toLowerCase() !== 'unknown' &&
    track.artist.toLowerCase() !== 'unknown artist';

  // Detect "unreleased" baked into artist name (e.g. "unreleased M" → real artist is "M")
  const unreleasedArtistMatch = !isUnidentified && track.artist
    ? track.artist.match(/^unreleased\s+(.+)$/i)
    : null;
  const realArtist = unreleasedArtistMatch ? unreleasedArtistMatch[1].trim() : null;

  // Clean up malformed track/artist names from scraping
  const cleanName = (name: string | undefined): string => {
    if (!name) return '';
    let cleaned = name;
    // Strip leading track numbers like "75) " or "12. "
    cleaned = cleaned.replace(/^\d+\)\s*/, '');
    cleaned = cleaned.replace(/^\d+\.\s*/, '');
    // Remove leading close paren
    cleaned = cleaned.replace(/^\)\s*/, '');
    // Fix unbalanced parentheses — remove trailing unclosed opens
    let openCount = 0;
    for (const ch of cleaned) {
      if (ch === '(') openCount++;
      if (ch === ')') openCount--;
    }
    if (openCount > 0) {
      // Remove trailing unclosed open parens
      for (let k = 0; k < openCount; k++) {
        const lastOpen = cleaned.lastIndexOf('(');
        if (lastOpen !== -1) {
          cleaned = cleaned.substring(0, lastOpen).trim();
        }
      }
    }
    return cleaned.trim();
  };

  const displayTitle = cleanName(track.title);
  const displayArtist = realArtist || cleanName(track.artist);

  // Released badge is explicit only; unknown remains ID.
  const hasConfirmedRelease = publicStatus === 'released';

  // Determine release badges from 3-state public status model
  // Never show unreleased if the track has a confirmed release (e.g. found on Spotify)
  const showUnreleasedBadge = !hasConfirmedRelease && (publicStatus === 'unreleased' || (!isUnidentified && !!realArtist));
  const showPartialIdBadge = !hasConfirmedRelease && isPartialId;

  return (
    <>
      <Pressable style={[styles.container, isUnidentified && styles.unidentifiedContainer]} onPress={handlePress}>
        {showTimestamp && track.timestamp !== undefined && (
          <View style={[styles.timestampBadge, isUnidentified && styles.unidentifiedTimestamp]}>
            <Text style={styles.timestampText}>{formatTimestamp(track.timestamp)}</Text>
          </View>
        )}
        {showIndex !== undefined && !showTimestamp && (
          <Text style={styles.index}>{showIndex}</Text>
        )}
        <Image source={{ uri: track.coverUrl }} style={[styles.cover, isUnidentified && styles.unidentifiedCover]} placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} transition={250} />
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, isUnidentified && styles.unidentifiedTitle]} numberOfLines={1}>
              {isPartialId ? 'Unknown Title' : (isUnidentified ? 'Unknown Track' : displayTitle)}
            </Text>
            {isUnidentified && (
              <View style={styles.questionBadge3d}>
                <View style={styles.questionBadgeShadow} />
                <View style={styles.questionBadgeFace}>
                  <Text style={styles.questionBadgeText}>?</Text>
                </View>
              </View>
            )}
          </View>
          <Text style={[styles.artist, isUnidentified && styles.unidentifiedArtist]} numberOfLines={1}>
            {isPartialId ? track.artist : (isUnidentified ? 'Help identify this track' : displayArtist)}
          </Text>
          {featuredCount > 0 && (
            <Pressable style={styles.featuredRow} onPress={handleFeaturedPress}>
              <Disc3 size={12} color="#C41E3A" />
              <Text style={styles.featuredMainText}>
                In {featuredCount} other set{featuredCount !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          )}
          <View style={styles.meta}>
            {renderSourceIcon()}
            {renderVerificationBadge()}
            {/* Release status badges */}
            {showUnreleasedBadge && (
              <View style={styles.unreleasedBadge3d}>
                <View style={styles.unreleasedBadgeShadow} />
                <View style={styles.unreleasedBadgeFace}>
                  <Sparkles size={9} color="#FFD700" />
                  <Text style={styles.unreleasedBadgeText}>Unreleased</Text>
                </View>
              </View>
            )}
            {showPartialIdBadge && (
              <View style={styles.unreleasedBadge3d}>
                <View style={styles.unreleasedBadgeShadow} />
                <View style={styles.unreleasedBadgeFace}>
                  <Sparkles size={9} color="#FFD700" />
                  <Text style={styles.unreleasedBadgeText}>Unreleased</Text>
                </View>
              </View>
            )}
            {/* Spotify verified badge — track matched to Spotify */}
            {!isUnidentified && !showUnreleasedBadge && !showPartialIdBadge && hasConfirmedRelease && (
              <View style={styles.spotifyVerifiedBadge}>
                <Music2 size={9} color="#1DB954" />
                <Text style={styles.spotifyVerifiedText}>Spotify</Text>
              </View>
            )}
            {track.trackLinks && track.trackLinks.length > 0 && (
              <View style={styles.linkBadge}>
                <Link2 size={10} color="#3B82F6" />
              </View>
            )}
            {track.contributedBy && (
              <Pressable
                style={styles.contributorTag}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onContributorPress?.(track.contributedBy!);
                }}
              >
                <User size={10} color={Colors.dark.textMuted} />
                <Text style={styles.contributorText}>{track.contributedBy}</Text>
              </Pressable>
            )}
          </View>
        </View>
        <View style={styles.actions}>
          {/* Play/pause preview button for identified tracks */}
          {!isUnidentified && hasPreview && onPlayPreview && (
            <Pressable
              style={[
                styles.previewButton,
                isCurrentlyPlaying && styles.previewButtonActive,
                previewFailed && styles.previewButtonFailed,
              ]}
              onPress={() => {
                if (previewFailed) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onPlayPreview();
              }}
            >
              {isPreviewLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : previewFailed ? (
                <X size={14} color="rgba(255,255,255,0.5)" />
              ) : isCurrentlyPlaying ? (
                <Pause size={14} color="#FFF" />
              ) : (
                <Play size={14} color="#FFF" />
              )}
            </Pressable>
          )}
          {/* Show listen button for unidentified tracks when source is available */}
          {isUnidentified && onListen && (
            <Pressable
              style={styles.listenButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onListen();
              }}
            >
              <Volume2 size={14} color="#FFF" />
              <Text style={styles.listenButtonText}>Listen</Text>
            </Pressable>
          )}
          {/* Show ID This button for unidentified tracks */}
          {isUnidentified && onIDThis && (
            <Pressable
              style={styles.idThisButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onIDThis();
              }}
            >
              <HelpCircle size={12} color={Colors.dark.primary} />
              <Text style={styles.idThisButtonText}>ID This</Text>
            </Pressable>
          )}
          {/* Show identify button for unidentified tracks */}
          {isUnidentified && onIdentify && !onListen && (
            <Pressable
              style={styles.identifyButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onIdentify();
              }}
            >
              <Wand2 size={14} color="#FFF" />
              <Text style={styles.identifyButtonText}>ID</Text>
            </Pressable>
          )}
          {onUpvote && !track.verified && !isUnidentified && (
            <Pressable
              style={styles.upvoteButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onUpvote();
              }}
            >
              <ThumbsUp size={16} color={Colors.dark.textSecondary} />
            </Pressable>
          )}
          {onAddToSet && (
            <Pressable style={styles.actionButton} onPress={handleAddPress}>
              <Plus size={20} color={Colors.dark.primary} />
            </Pressable>
          )}
        </View>
      </Pressable>

      <Modal
        visible={showFeaturedModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFeaturedModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowFeaturedModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Featured In Sets</Text>
              <Pressable onPress={() => setShowFeaturedModal(false)} hitSlop={8}>
                <X size={24} color={Colors.dark.textSecondary} />
              </Pressable>
            </View>
            
            <View style={styles.modalTrackInfo}>
              <Image source={{ uri: track.coverUrl }} style={styles.modalTrackCover} placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} transition={250} />
              <View style={styles.modalTrackDetails}>
                <Text style={styles.modalTrackTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.modalTrackArtist} numberOfLines={1}>{track.artist}</Text>
              </View>
            </View>

            <View style={styles.featuredList}>
              {track.featuredIn?.map((set, index) => (
                <Pressable 
                  key={`${set.setId}-${index}`}
                  style={styles.featuredSetItem}
                  onPress={() => handleNavigateToSet(set.setId)}
                >
                  {set.coverUrl ? (
                    <Image
                      source={{ uri: set.coverUrl }}
                      style={styles.featuredSetCover}
                      placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                      transition={250}
                    />
                  ) : (
                    <View style={[styles.featuredSetCover, { backgroundColor: Colors.dark.surface, justifyContent: 'center', alignItems: 'center' }]}>
                      <Disc3 size={16} color={Colors.dark.textMuted} />
                    </View>
                  )}
                  <View style={styles.featuredSetInfo}>
                    <Text style={styles.featuredSetName} numberOfLines={1}>{set.setName}</Text>
                    <Text style={styles.featuredSetArtist} numberOfLines={1}>{set.artist}</Text>
                  </View>
                  <View style={styles.featuredSetTimestamp}>
                    <Clock size={12} color={Colors.dark.primary} />
                    <Text style={styles.featuredSetTime}>{formatTimestamp(set.timestamp)}</Text>
                  </View>
                  <ExternalLink size={16} color={Colors.dark.textMuted} />
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 240, 232, 0.85)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderTopColor: 'rgba(255, 255, 255, 0.7)',
    borderBottomColor: 'rgba(232, 226, 217, 0.6)',
    shadowColor: 'rgba(45, 42, 38, 0.15)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  unidentifiedContainer: {
    backgroundColor: 'rgba(10, 10, 10, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  timestampBadge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 10,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timestampText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800' as const,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  index: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontWeight: '600' as const,
    width: 22,
    textAlign: 'center',
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  info: {
    flex: 1,
    marginLeft: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600' as const,
    flex: 1,
  },
  artist: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 1,
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaText: {
    color: Colors.dark.textMuted,
    fontSize: 11,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceTagText: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  confirmedTag: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  confirmedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tdBadge: {
    backgroundColor: 'rgba(196, 30, 58, 0.55)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(196, 30, 58, 0.3)',
    shadowColor: '#C41E3A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  tdBadgeText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(196, 30, 58, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subIconContainer: {
    marginLeft: 2,
    opacity: 0.8,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  verificationText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#22C55E',
  },
  unreleasedBadge3d: {
    position: 'relative' as const,
    paddingBottom: 2,
  },
  unreleasedBadgeShadow: {
    position: 'absolute' as const,
    top: 2,
    left: 1,
    right: -1,
    bottom: -1,
    borderRadius: 7,
    backgroundColor: 'rgba(180, 130, 0, 0.4)',
  },
  unreleasedBadgeFace: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: 'rgba(10, 10, 10, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderTopColor: 'rgba(255, 223, 120, 0.5)',
    borderBottomColor: 'rgba(255, 215, 0, 0.15)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  unreleasedBadgeText: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#FFD700',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(255, 215, 0, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  releasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  releasedBadgeText: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: '#22C55E',
  },
  spotifyVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
  },
  spotifyVerifiedText: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: '#1DB954',
  },
  linkBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    padding: 4,
    borderRadius: 4,
  },
  contributorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(240, 235, 227, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  contributorText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  featuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(205, 106, 111, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  featuredMainText: {
    color: '#C41E3A',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    padding: 8,
  },
  previewButton: {
    padding: 8,
    backgroundColor: 'rgba(10, 10, 10, 0.55)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  previewButtonActive: {
    backgroundColor: 'rgba(196, 30, 58, 0.7)',
    borderColor: 'rgba(196, 30, 58, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  previewButtonFailed: {
    backgroundColor: 'rgba(10, 10, 10, 0.3)',
    borderColor: 'rgba(255,255,255,0.05)',
    opacity: 0.6,
  },
  upvoteButton: {
    padding: 8,
    backgroundColor: 'rgba(10, 10, 10, 0.55)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  idThisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 10, 10, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  idThisButtonText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  identifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 10, 10, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  identifyButtonText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  listenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 10, 10, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  listenButtonText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  questionBadge3d: {
    width: 26,
    height: 30,
    position: 'relative',
  },
  questionBadgeShadow: {
    position: 'absolute',
    bottom: 0,
    left: 1,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(196, 30, 58, 0.3)',
  },
  questionBadgeFace: {
    position: 'absolute',
    top: 0,
    left: 1,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(196, 30, 58, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    borderBottomColor: 'rgba(196, 30, 58, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C41E3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  questionBadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  unidentifiedTimestamp: {
    backgroundColor: 'rgba(196, 30, 58, 0.2)',
  },
  unidentifiedCover: {
    opacity: 0.5,
  },
  unidentifiedTitle: {
    color: '#C41E3A',
    fontStyle: 'italic',
  },
  unidentifiedArtist: {
    color: 'rgba(205, 106, 111, 0.7)',
    fontStyle: 'italic',
  },
  slimContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  slimTimestamp: {
    backgroundColor: 'rgba(196, 30, 58, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  slimTimestampText: {
    color: 'rgba(196, 30, 58, 0.5)',
    fontSize: 11,
    fontWeight: '600' as const,
    fontVariant: ['tabular-nums'],
  },
  slimDash: {
    width: 16,
    height: 1,
    backgroundColor: 'rgba(196, 30, 58, 0.2)',
    marginRight: 8,
  },
  slimTitle: {
    color: 'rgba(196, 30, 58, 0.45)',
    fontSize: 12,
    fontStyle: 'italic',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
  },
  compactCover: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  compactInfo: {
    flex: 1,
    marginLeft: 8,
  },
  compactTitle: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  compactArtist: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  modalTrackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  modalTrackCover: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  modalTrackDetails: {
    flex: 1,
    marginLeft: 12,
  },
  modalTrackTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  modalTrackArtist: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  featuredList: {
    gap: 10,
  },
  featuredSetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  featuredSetCover: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  featuredSetInfo: {
    flex: 1,
  },
  featuredSetName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.dark.text,
  },
  featuredSetArtist: {
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
});
