import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Linking,
  Dimensions,
  Platform,
} from 'react-native';
import { 
  Zap, 
  Youtube, 
  Music2, 
  Radio, 
  Check, 
  Clock,
  Trophy,
  Sparkles,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Timer,
  Volume2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { TrackConflict, ConflictOption } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const OPTION_WIDTH = CARD_WIDTH - 40;

interface TrackConflictCardProps {
  conflict: TrackConflict;
  onVote: (optionId: string) => Promise<{ success: boolean; resolved?: boolean; winnerId?: string }>;
  userHasVoted: boolean;
  userVotedOptionId?: string;
  youtubeUrl?: string;
  soundcloudUrl?: string;
}

// Inline YouTube Preview Component
const YouTubePreview = ({ 
  videoId, 
  timestamp,
  isPlaying,
  onTogglePlay,
}: { 
  videoId: string; 
  timestamp: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
}) => {
  if (Platform.OS === 'web') {
    return (
      <View style={previewStyles.container}>
        <View style={previewStyles.iframeContainer}>
          {isPlaying ? (
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}?start=${timestamp}&autoplay=1&controls=0&modestbranding=1`}
              frameBorder="0"
              allow="autoplay; encrypted-media"
              style={{ borderRadius: 8 }}
            />
          ) : (
            <Pressable style={previewStyles.playOverlay} onPress={onTogglePlay}>
              <View style={previewStyles.playButton}>
                <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
              </View>
              <Text style={previewStyles.previewText}>Preview</Text>
            </Pressable>
          )}
        </View>
        {isPlaying && (
          <Pressable style={previewStyles.stopButton} onPress={onTogglePlay}>
            <Pause size={14} color="#FFFFFF" fill="#FFFFFF" />
          </Pressable>
        )}
      </View>
    );
  }

  // For native, open in browser
  return (
    <Pressable 
      style={previewStyles.nativeButton}
      onPress={() => Linking.openURL(`https://youtube.com/watch?v=${videoId}&t=${timestamp}`)}
    >
      <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
      <Text style={previewStyles.nativeButtonText}>Preview</Text>
    </Pressable>
  );
};

const previewStyles = StyleSheet.create({
  container: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.dark.surface,
    position: 'relative',
  },
  iframeContainer: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  stopButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF0000',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  nativeButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

// Format duration as m:ss or h:mm:ss
const formatDuration = (seconds: number | undefined) => {
  if (!seconds) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Extract YouTube video ID from URL
const extractYouTubeId = (url: string | undefined): string | null => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&?\s]+)/);
  return match ? match[1] : null;
};

export default function TrackConflictCard({
  conflict,
  onVote,
  userHasVoted,
  userVotedOptionId,
  youtubeUrl,
  soundcloudUrl,
}: TrackConflictCardProps) {
  const [voting, setVoting] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  
  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for the conflict indicator
  useEffect(() => {
    if (!userHasVoted && !voting) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [userHasVoted, voting]);

  // Glow animation
  useEffect(() => {
    if (!userHasVoted && !voting) {
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
        ])
      );
      glow.start();
      return () => glow.stop();
    }
  }, [userHasVoted, voting]);

  const formatTimestamp = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getPlatformIcon = (platform: string, size: number = 16) => {
    switch (platform) {
      case 'youtube':
        return <Youtube size={size} color="#FF0000" />;
      case 'soundcloud':
        return <Music2 size={size} color="#FF5500" />;
      case 'mixcloud':
        return <Radio size={size} color="#5000FF" />;
      default:
        return <Music2 size={size} color={Colors.dark.textMuted} />;
    }
  };

  const getVoteCount = (optionId: string) => {
    return conflict.votes.filter(v => v.optionId === optionId).length;
  };

  const totalVotes = conflict.votes.length;
  const votesNeeded = Math.max(0, 3 - totalVotes);

  const swipeToOption = (index: number) => {
    if (index < 0 || index >= conflict.options.length) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveOptionIndex(index);
    setPlayingPreview(null); // Stop any playing preview
    
    Animated.spring(slideAnim, {
      toValue: -index * OPTION_WIDTH,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const handleVote = async (option: ConflictOption) => {
    if (userHasVoted || voting) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVoting(option.id);

    try {
      const result = await onVote(option.id);
      
      if (result.resolved && result.winnerId) {
        setWinnerId(result.winnerId);
        setShowResult(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Vote error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setVoting(null);
    }
  };

  const togglePreview = (optionId: string) => {
    setPlayingPreview(playingPreview === optionId ? null : optionId);
  };

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(206, 138, 75, 0.1)', 'rgba(206, 138, 75, 0.25)'],
  });

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  // Resolved state
  if (conflict.status === 'resolved' || showResult) {
    const winner = conflict.options.find(o => o.id === (winnerId || conflict.winnerId));
    return (
      <View style={styles.resolvedContainer}>
        <View style={styles.resolvedHeader}>
          <Trophy size={16} color="#FFD700" />
          <Text style={styles.resolvedTitle}>Verified</Text>
        </View>
        {winner && (
          <View style={styles.resolvedTrack}>
            <View style={styles.timestampBadge}>
              <Text style={styles.timestampText}>{formatTimestamp(conflict.timestamp)}</Text>
            </View>
            <View style={styles.resolvedInfo}>
              <Text style={styles.resolvedTrackTitle}>{winner.title}</Text>
              <Text style={styles.resolvedArtist}>{winner.artist}</Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  const youtubeVideoId = extractYouTubeId(youtubeUrl);

  return (
    <Animated.View 
      style={[
        styles.container, 
        { backgroundColor: glowColor, transform: [{ scale: pulseScale }] }
      ]}
    >
      {/* Compact Header Row - Like a track but with conflict indicator */}
      <View style={styles.headerRow}>
        <View style={styles.conflictIndicator}>
          <Zap size={14} color={Colors.dark.primary} />
        </View>
        <View style={styles.timestampBadge}>
          <Text style={styles.timestampText}>{formatTimestamp(conflict.timestamp)}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.conflictLabel}>Which track is this?</Text>
          <Text style={styles.helpText}>Swipe to compare • Tap to vote</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Sparkles size={10} color={Colors.dark.primary} />
          <Text style={styles.pointsText}>+10</Text>
        </View>
      </View>

      {/* Swipeable Options Container */}
      <View style={styles.swipeContainer}>
        {/* Navigation Arrows */}
        {activeOptionIndex > 0 && (
          <Pressable 
            style={[styles.navArrow, styles.navArrowLeft]}
            onPress={() => swipeToOption(activeOptionIndex - 1)}
          >
            <ChevronLeft size={20} color={Colors.dark.text} />
          </Pressable>
        )}
        {activeOptionIndex < conflict.options.length - 1 && (
          <Pressable 
            style={[styles.navArrow, styles.navArrowRight]}
            onPress={() => swipeToOption(activeOptionIndex + 1)}
          >
            <ChevronRight size={20} color={Colors.dark.text} />
          </Pressable>
        )}

        {/* Options Slider */}
        <View style={styles.sliderMask}>
          <Animated.View 
            style={[
              styles.slider,
              { transform: [{ translateX: slideAnim }] }
            ]}
          >
            {conflict.options.map((option, index) => {
              const votes = getVoteCount(option.id);
              const isVoted = userVotedOptionId === option.id;
              const isActive = index === activeOptionIndex;
              const isWinning = totalVotes > 0 && votes === Math.max(...conflict.options.map(o => getVoteCount(o.id)));

              return (
                <View 
                  key={option.id} 
                  style={[
                    styles.optionSlide,
                    { width: OPTION_WIDTH },
                  ]}
                >
                  <View style={[
                    styles.optionCard,
                    isVoted && styles.optionCardVoted,
                  ]}>
                    {/* Platform & Duration Row */}
                    <View style={styles.optionHeader}>
                      <View style={styles.platformBadge}>
                        {getPlatformIcon(option.source, 14)}
                        <Text style={styles.platformText}>
                          {option.source.charAt(0).toUpperCase() + option.source.slice(1)}
                        </Text>
                      </View>
                      <View style={styles.durationBadge}>
                        <Timer size={12} color={Colors.dark.textMuted} />
                        <Text style={styles.durationText}>
                          {formatDuration(option.duration || Math.floor(Math.random() * 300) + 180)}
                        </Text>
                      </View>
                      {isWinning && totalVotes > 0 && (
                        <View style={styles.leadingBadge}>
                          <Text style={styles.leadingText}>Leading</Text>
                        </View>
                      )}
                    </View>

                    {/* Track Info */}
                    <View style={styles.trackInfo}>
                      <Text style={styles.optionTitle} numberOfLines={2}>
                        {option.title}
                      </Text>
                      <Text style={styles.optionArtist} numberOfLines={1}>
                        {option.artist}
                      </Text>
                    </View>

                    {/* Preview Player */}
                    {option.source === 'youtube' && youtubeVideoId && (
                      <View style={styles.previewSection}>
                        <View style={styles.previewHeader}>
                          <Volume2 size={12} color={Colors.dark.textMuted} />
                          <Text style={styles.previewLabel}>Quick Preview</Text>
                        </View>
                        <YouTubePreview
                          videoId={youtubeVideoId}
                          timestamp={conflict.timestamp}
                          isPlaying={playingPreview === option.id}
                          onTogglePlay={() => togglePreview(option.id)}
                        />
                      </View>
                    )}

                    {option.source === 'soundcloud' && soundcloudUrl && (
                      <Pressable 
                        style={styles.soundcloudPreview}
                        onPress={() => {
                          const url = `${soundcloudUrl}#t=${formatTimestamp(conflict.timestamp)}`;
                          Linking.openURL(url);
                        }}
                      >
                        <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                        <Text style={styles.soundcloudPreviewText}>
                          Open in SoundCloud @ {formatTimestamp(conflict.timestamp)}
                        </Text>
                      </Pressable>
                    )}

                    {/* Vote Button */}
                    <Pressable
                      style={[
                        styles.voteButton,
                        isVoted && styles.voteButtonVoted,
                        voting === option.id && styles.voteButtonVoting,
                      ]}
                      onPress={() => handleVote(option)}
                      disabled={userHasVoted || voting !== null}
                    >
                      {userHasVoted ? (
                        <>
                          {isVoted && <Check size={16} color={Colors.dark.primary} />}
                          <Text style={[
                            styles.voteButtonText,
                            isVoted && styles.voteButtonTextVoted
                          ]}>
                            {votes} {votes === 1 ? 'vote' : 'votes'}
                          </Text>
                        </>
                      ) : (
                        <>
                          {voting === option.id ? (
                            <Text style={styles.voteButtonText}>Voting...</Text>
                          ) : (
                            <>
                              <Sparkles size={14} color="#FFFFFF" />
                              <Text style={styles.voteButtonText}>This is it!</Text>
                            </>
                          )}
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </Animated.View>
        </View>

        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {conflict.options.map((option, index) => (
            <Pressable 
              key={option.id}
              onPress={() => swipeToOption(index)}
            >
              <View 
                style={[
                  styles.paginationDot,
                  index === activeOptionIndex && styles.paginationDotActive
                ]} 
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Option {activeOptionIndex + 1} of {conflict.options.length}
        </Text>
        {votesNeeded > 0 ? (
          <Text style={styles.footerHint}>
            {votesNeeded} more to resolve
          </Text>
        ) : (
          <Text style={styles.footerHint}>Deciding...</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    marginVertical: 4,
    marginHorizontal: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(206, 138, 75, 0.4)',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
    gap: 10,
  },
  conflictIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(206, 138, 75, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timestampBadge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  timestampText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  headerInfo: {
    flex: 1,
  },
  conflictLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  helpText: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    marginTop: 1,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(206, 138, 75, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pointsText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  swipeContainer: {
    position: 'relative',
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -16,
  },
  navArrowLeft: {
    left: 4,
  },
  navArrowRight: {
    right: 4,
  },
  sliderMask: {
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
  slider: {
    flexDirection: 'row',
  },
  optionSlide: {
    paddingHorizontal: 4,
  },
  optionCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionCardVoted: {
    borderColor: Colors.dark.primary,
    backgroundColor: 'rgba(206, 138, 75, 0.08)',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.dark.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  platformText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  durationText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  leadingBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  leadingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFD700',
  },
  trackInfo: {
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  optionArtist: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  previewSection: {
    marginBottom: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  previewLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  soundcloudPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF5500',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  soundcloudPreviewText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  voteButtonVoted: {
    backgroundColor: 'rgba(206, 138, 75, 0.15)',
  },
  voteButtonVoting: {
    opacity: 0.7,
  },
  voteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  voteButtonTextVoted: {
    color: Colors.dark.primary,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.surfaceLight,
  },
  paginationDotActive: {
    backgroundColor: Colors.dark.primary,
    width: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.surfaceLight,
  },
  footerText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  footerHint: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  // Resolved styles
  resolvedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: 12,
    padding: 10,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  resolvedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 10,
  },
  resolvedTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22C55E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resolvedTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resolvedInfo: {
    flex: 1,
  },
  resolvedTrackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  resolvedArtist: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
});
