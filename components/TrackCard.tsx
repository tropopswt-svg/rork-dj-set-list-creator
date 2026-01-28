import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Image } from 'expo-image';
import { Plus, CheckCircle, User, ThumbsUp, Disc3, Clock, Link2, ExternalLink, X, AlertCircle, Youtube, Music2, Wand2, ShieldCheck, HelpCircle, CircleDot, Sparkles, Volume2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { Track } from '@/types';

interface TrackCardProps {
  track: Track;
  onPress?: () => void;
  onAddToSet?: () => void;
  showIndex?: number;
  showTimestamp?: boolean;
  compact?: boolean;
  onUpvote?: () => void;
  onContributorPress?: (username: string) => void;
  onIdentify?: () => void;
  onListen?: () => void; // Play audio preview to help identify
}

export default function TrackCard({
  track,
  onPress,
  onAddToSet,
  showIndex,
  showTimestamp,
  compact,
  onUpvote,
  onContributorPress,
  onIdentify,
  onListen,
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
            <Text style={styles.tdBadgeText}>T'D</Text>
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
        <Image source={{ uri: track.coverUrl }} style={styles.compactCover} />
        <View style={styles.compactInfo}>
          <Text style={styles.compactTitle} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.compactArtist} numberOfLines={1}>{track.artist}</Text>
        </View>
      </Pressable>
    );
  }

  // Check if this is an unidentified track that needs to be filled in
  const isUnidentified = track.isId || track.title?.toLowerCase() === 'id';

  // Check if this is a partial ID - we have the artist but the title is unknown
  // These should be treated as unreleased since we have some info to work with
  const isPartialId = isUnidentified &&
    track.artist &&
    track.artist.toLowerCase() !== 'id' &&
    track.artist.toLowerCase() !== 'unknown' &&
    track.artist.toLowerCase() !== 'unknown artist';

  // Determine if we should show unreleased badge
  // Show for: explicitly marked unreleased OR partial IDs (we have artist but not title)
  const showUnreleasedBadge = !isUnidentified && track.isUnreleased;
  const showPartialIdBadge = isPartialId;

  // Only show "Released" when we have explicit database confirmation
  // For now, we don't have this matching, so we'll use a placeholder check
  // This could be: track.isReleased, track.matchedToDatabase, etc.
  const hasConfirmedRelease = (track as any).isReleased === true || (track as any).matchedToDatabase === true;

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
        <Image source={{ uri: track.coverUrl }} style={[styles.cover, isUnidentified && styles.unidentifiedCover]} />
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, isUnidentified && styles.unidentifiedTitle]} numberOfLines={1}>
              {isPartialId ? 'Unknown Title' : (isUnidentified ? 'Unknown Track' : track.title)}
            </Text>
            {isUnidentified && (
              <HelpCircle size={14} color="#C41E3A" />
            )}
          </View>
          <Text style={[styles.artist, isUnidentified && styles.unidentifiedArtist]} numberOfLines={1}>
            {isPartialId ? track.artist : (isUnidentified ? 'Help identify this track' : track.artist)}
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
              <View style={styles.unreleasedBadge}>
                <Sparkles size={9} color="#EC4899" />
                <Text style={styles.unreleasedBadgeText}>Unreleased</Text>
              </View>
            )}
            {showPartialIdBadge && (
              <View style={styles.unreleasedBadge}>
                <Sparkles size={9} color="#EC4899" />
                <Text style={styles.unreleasedBadgeText}>Unreleased</Text>
              </View>
            )}
            {/* Only show Released badge when we have confirmed database match */}
            {!isUnidentified && !showUnreleasedBadge && !showPartialIdBadge && hasConfirmedRelease && (
              <View style={styles.releasedBadge}>
                <CircleDot size={9} color="#22C55E" />
                <Text style={styles.releasedBadgeText}>Released</Text>
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
              <Image source={{ uri: track.coverUrl }} style={styles.modalTrackCover} />
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
                  <Image 
                    source={{ uri: set.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop' }} 
                    style={styles.featuredSetCover} 
                  />
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
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  unidentifiedContainer: {
    backgroundColor: 'rgba(205, 106, 111, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(205, 106, 111, 0.2)',
    borderStyle: 'dashed',
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
    backgroundColor: '#C41E3A',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tdBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
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
  unreleasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  unreleasedBadgeText: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: '#EC4899',
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
  linkBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    padding: 4,
    borderRadius: 4,
  },
  contributorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.dark.surfaceLight,
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
  upvoteButton: {
    padding: 8,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 8,
  },
  identifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#C41E3A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
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
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  listenButtonText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  unidentifiedTimestamp: {
    backgroundColor: 'rgba(205, 106, 111, 0.3)',
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
