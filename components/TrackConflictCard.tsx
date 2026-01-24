import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Linking,
  Platform,
} from 'react-native';
import { 
  Zap, 
  Youtube, 
  Music2, 
  Check, 
  Trophy,
  Sparkles,
  Play,
  Pause,
  HelpCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { TrackConflict, ConflictOption } from '@/types';

interface TrackConflictCardProps {
  conflict: TrackConflict;
  onVote: (optionId: string) => Promise<{ success: boolean; resolved?: boolean; winnerId?: string }>;
  userHasVoted: boolean;
  userVotedOptionId?: string;
  youtubeUrl?: string;
  soundcloudUrl?: string;
}

// Format timestamp as m:ss or h:mm:ss
const formatTimestamp = (seconds: number) => {
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

// Mini play button component for inline preview
const PlayButton = ({ 
  onPress, 
  isPlaying, 
  platform,
  size = 'small',
}: { 
  onPress: () => void; 
  isPlaying: boolean;
  platform: string;
  size?: 'small' | 'medium';
}) => {
  const buttonSize = size === 'small' ? 32 : 40;
  const iconSize = size === 'small' ? 14 : 18;
  
  const getPlatformColor = () => {
    switch (platform) {
      case 'youtube': return '#FF0000';
      case 'soundcloud': return '#FF5500';
      default: return Colors.dark.primary;
    }
  };

  return (
    <Pressable 
      style={[
        playStyles.button, 
        { 
          width: buttonSize, 
          height: buttonSize, 
          borderRadius: buttonSize / 2,
          backgroundColor: isPlaying ? getPlatformColor() : Colors.dark.surfaceLight,
        }
      ]}
      onPress={onPress}
    >
      {isPlaying ? (
        <Pause size={iconSize} color="#FFFFFF" fill="#FFFFFF" />
      ) : (
        <Play size={iconSize} color={getPlatformColor()} fill={getPlatformColor()} />
      )}
    </Pressable>
  );
};

const playStyles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
});

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
  const [playingOption, setPlayingOption] = useState<string | null>(null);
  
  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Floating animation
  useEffect(() => {
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -3, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    float.start();
    return () => float.stop();
  }, []);

  // Pulse animation
  useEffect(() => {
    if (!userHasVoted && !voting) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
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

  const getPlatformIcon = (platform: string, size: number = 12) => {
    switch (platform) {
      case 'youtube':
        return <Youtube size={size} color="#FF0000" />;
      case 'soundcloud':
        return <Music2 size={size} color="#FF5500" />;
      default:
        return <Music2 size={size} color={Colors.dark.textMuted} />;
    }
  };

  const getVoteCount = (optionId: string) => {
    return conflict.votes.filter(v => v.optionId === optionId).length;
  };

  const totalVotes = conflict.votes.length;
  const youtubeVideoId = extractYouTubeId(youtubeUrl);

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

  const handlePlay = (option: ConflictOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (playingOption === option.id) {
      setPlayingOption(null);
      return;
    }
    
    setPlayingOption(option.id);
    
    // Open the appropriate platform at the timestamp
    if (option.source === 'youtube' && youtubeUrl) {
      const url = youtubeUrl.includes('?') 
        ? `${youtubeUrl}&t=${conflict.timestamp}` 
        : `${youtubeUrl}?t=${conflict.timestamp}`;
      Linking.openURL(url);
    } else if (option.source === 'soundcloud' && soundcloudUrl) {
      const url = `${soundcloudUrl}#t=${formatTimestamp(conflict.timestamp)}`;
      Linking.openURL(url);
    }
    
    // Reset playing state after a short delay
    setTimeout(() => setPlayingOption(null), 500);
  };

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(206, 138, 75, 0.05)', 'rgba(206, 138, 75, 0.15)'],
  });

  const indicatorScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  // Resolved state - very compact
  if (conflict.status === 'resolved' || showResult) {
    const winner = conflict.options.find(o => o.id === (winnerId || conflict.winnerId));
    return (
      <View style={styles.resolvedContainer}>
        <View style={styles.resolvedBadge}>
          <Trophy size={10} color="#22C55E" />
        </View>
        <View style={styles.resolvedTimestamp}>
          <Text style={styles.resolvedTimestampText}>{formatTimestamp(conflict.timestamp)}</Text>
        </View>
        {winner && (
          <View style={styles.resolvedInfo}>
            <Text style={styles.resolvedTitle} numberOfLines={1}>{winner.title}</Text>
            <Text style={styles.resolvedArtist} numberOfLines={1}>{winner.artist}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        { 
          backgroundColor: glowColor,
          transform: [{ translateY: floatAnim }],
        }
      ]}
    >
      {/* Compact Header */}
      <View style={styles.header}>
        <Animated.View style={[styles.conflictIcon, { transform: [{ scale: indicatorScale }] }]}>
          <HelpCircle size={14} color={Colors.dark.primary} />
        </Animated.View>
        <View style={styles.timestampBadge}>
          <Text style={styles.timestampText}>{formatTimestamp(conflict.timestamp)}</Text>
        </View>
        <Text style={styles.questionText}>Which track?</Text>
        <View style={styles.pointsChip}>
          <Sparkles size={8} color={Colors.dark.primary} />
          <Text style={styles.pointsChipText}>+10</Text>
        </View>
      </View>

      {/* Compact Options */}
      <View style={styles.optionsContainer}>
        {conflict.options.map((option, index) => {
          const votes = getVoteCount(option.id);
          const isVoted = userVotedOptionId === option.id;
          const isWinning = totalVotes > 0 && votes === Math.max(...conflict.options.map(o => getVoteCount(o.id)));
          const isVoting = voting === option.id;
          
          return (
            <Pressable
              key={option.id}
              style={[
                styles.optionPill,
                isVoted && styles.optionPillVoted,
                isVoting && styles.optionPillVoting,
              ]}
              onPress={() => handleVote(option)}
              disabled={userHasVoted || voting !== null}
            >
              {/* Play button */}
              <PlayButton
                onPress={() => handlePlay(option)}
                isPlaying={playingOption === option.id}
                platform={option.source}
                size="small"
              />
              
              {/* Track info */}
              <View style={styles.optionInfo}>
                <View style={styles.optionTopRow}>
                  {getPlatformIcon(option.source, 10)}
                  <Text style={styles.optionTitle} numberOfLines={1}>
                    {option.title}
                  </Text>
                  {isWinning && totalVotes > 0 && (
                    <View style={styles.leadingDot} />
                  )}
                </View>
                <Text style={styles.optionArtist} numberOfLines={1}>
                  {option.artist}
                </Text>
              </View>
              
              {/* Vote indicator / button */}
              <View style={styles.voteArea}>
                {userHasVoted ? (
                  <View style={[styles.voteBadge, isVoted && styles.voteBadgeActive]}>
                    {isVoted && <Check size={10} color={Colors.dark.primary} />}
                    <Text style={[styles.voteBadgeText, isVoted && styles.voteBadgeTextActive]}>
                      {votes}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.tapToVote}>
                    {isVoting ? (
                      <Text style={styles.tapToVoteText}>...</Text>
                    ) : (
                      <Text style={styles.tapToVoteText}>TAP</Text>
                    )}
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      
      {/* Embedded YouTube Preview (Web only) */}
      {Platform.OS === 'web' && youtubeVideoId && playingOption && (
        <View style={styles.previewContainer}>
          <iframe
            width="100%"
            height="60"
            src={`https://www.youtube.com/embed/${youtubeVideoId}?start=${conflict.timestamp}&autoplay=1&controls=1&modestbranding=1`}
            frameBorder="0"
            allow="autoplay; encrypted-media"
            style={{ borderRadius: 8 }}
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginVertical: 6,
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(206, 138, 75, 0.35)',
    // Risen/floating shadow effect
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  conflictIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(206, 138, 75, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timestampBadge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timestampText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  questionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  pointsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(206, 138, 75, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pointsChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  optionsContainer: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 6,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionPillVoted: {
    borderColor: Colors.dark.primary,
    backgroundColor: 'rgba(206, 138, 75, 0.08)',
  },
  optionPillVoting: {
    opacity: 0.7,
  },
  optionInfo: {
    flex: 1,
    marginRight: 8,
  },
  optionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  optionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  leadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD700',
  },
  optionArtist: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  voteArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.dark.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 32,
    justifyContent: 'center',
  },
  voteBadgeActive: {
    backgroundColor: 'rgba(206, 138, 75, 0.15)',
  },
  voteBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  voteBadgeTextActive: {
    color: Colors.dark.primary,
  },
  tapToVote: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tapToVoteText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  previewContainer: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  // Resolved state - inline compact
  resolvedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
    borderRadius: 10,
    marginVertical: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
  },
  resolvedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resolvedTimestamp: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  resolvedTimestampText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22C55E',
    fontVariant: ['tabular-nums'],
  },
  resolvedInfo: {
    flex: 1,
  },
  resolvedTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  resolvedArtist: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
  },
});
