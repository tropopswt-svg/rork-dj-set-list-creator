import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Image } from 'expo-image';
import { Plus, CheckCircle, User, ThumbsUp, Disc3, Clock, Link2, ExternalLink, X, AlertCircle, Youtube, Music2, ListMusic, Database } from 'lucide-react-native';
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

  // Get platform-specific source icon and color
  const getSourceInfo = () => {
    // Check for specific platforms first
    if (track.source === 'youtube' || track.contributedBy?.includes('youtube')) {
      return { icon: 'youtube', color: '#FF0000', label: 'YT' };
    }
    if (track.source === 'soundcloud' || track.contributedBy?.includes('soundcloud')) {
      return { icon: 'soundcloud', color: '#FF5500', label: 'SC' };
    }
    if (track.source === '1001tracklists' || track.source === 'database') {
      return { icon: '1001', color: '#00D4AA', label: '1001' };
    }
    if (track.source === 'manual' || track.source === 'user') {
      return { icon: 'user', color: '#8B5CF6', label: 'User' };
    }
    if (track.source === 'ai') {
      return { icon: 'ai', color: Colors.dark.primary, label: 'AI' };
    }
    if (track.source === 'social') {
      return { icon: 'user', color: '#10B981', label: 'Comm' };
    }
    return null;
  };

  const renderSourceIcon = () => {
    const info = getSourceInfo();
    if (!info) return null;

    const iconSize = 10;
    let IconComponent = null;

    switch (info.icon) {
      case 'youtube':
        IconComponent = <Youtube size={iconSize} color={info.color} />;
        break;
      case 'soundcloud':
        IconComponent = <Music2 size={iconSize} color={info.color} />;
        break;
      case '1001':
        IconComponent = <ListMusic size={iconSize} color={info.color} />;
        break;
      case 'user':
        IconComponent = <User size={iconSize} color={info.color} />;
        break;
      case 'ai':
        IconComponent = <Database size={iconSize} color={info.color} />;
        break;
      default:
        return null;
    }

    return (
      <View style={[styles.sourceIcon, { backgroundColor: `${info.color}15` }]}>
        {IconComponent}
      </View>
    );
  };

  const getSourceBadge = () => {
    if (track.isUnreleased) {
      return { label: 'Unreleased', color: '#EC4899' };
    }
    // Don't show text badge if we're showing icon
    return null;
  };

  const sourceBadge = getSourceBadge();
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

  return (
    <>
      <Pressable style={styles.container} onPress={handlePress}>
        {showTimestamp && track.timestamp !== undefined && (
          <View style={styles.timestampBadge}>
            <Text style={styles.timestampText}>{formatTimestamp(track.timestamp)}</Text>
          </View>
        )}
        {showIndex !== undefined && !showTimestamp && (
          <Text style={styles.index}>{showIndex}</Text>
        )}
        <Image source={{ uri: track.coverUrl }} style={styles.cover} />
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
            {track.verified && (
              <CheckCircle size={14} color={Colors.dark.success} />
            )}
            {track.isUnreleased && (
              <AlertCircle size={14} color="#EC4899" />
            )}
          </View>
          <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
          {featuredCount > 0 && (
            <Pressable style={styles.featuredRow} onPress={handleFeaturedPress}>
              <Disc3 size={12} color="#F59E0B" />
              <Text style={styles.featuredMainText}>
                In {featuredCount} other set{featuredCount !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          )}
          <View style={styles.meta}>
            {renderSourceIcon()}
            {sourceBadge && (
              <View style={[styles.sourceBadge, { backgroundColor: `${sourceBadge.color}20` }]}>
                <Text style={[styles.sourceBadgeText, { color: sourceBadge.color }]}>
                  {sourceBadge.label}
                </Text>
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
          {onUpvote && !track.verified && (
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
  sourceIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
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
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  featuredMainText: {
    color: '#F59E0B',
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
