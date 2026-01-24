import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
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
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { TrackConflict, ConflictOption } from '@/types';

interface TrackConflictCardProps {
  conflict: TrackConflict;
  onVote: (optionId: string) => Promise<{ success: boolean; resolved?: boolean; winnerId?: string }>;
  userHasVoted: boolean;
  userVotedOptionId?: string;
}

export default function TrackConflictCard({
  conflict,
  onVote,
  userHasVoted,
  userVotedOptionId,
}: TrackConflictCardProps) {
  const [voting, setVoting] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  
  // Animations
  const optionAScale = useRef(new Animated.Value(1)).current;
  const optionBScale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const sparkleRotation = useRef(new Animated.Value(0)).current;

  // Sparkle animation
  useEffect(() => {
    if (!userHasVoted && !voting) {
      const sparkle = Animated.loop(
        Animated.timing(sparkleRotation, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      sparkle.start();
      return () => sparkle.stop();
    }
  }, [userHasVoted, voting]);

  // Glow animation when ready to vote
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

  const handleVote = async (option: ConflictOption) => {
    if (userHasVoted || voting) return;

    const scaleAnim = option.id === conflict.options[0].id ? optionAScale : optionBScale;
    
    // Bounce animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1.05, friction: 3, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();

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

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0, 212, 170, 0.1)', 'rgba(0, 212, 170, 0.3)'],
  });

  const sparkleRotate = sparkleRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Resolved state
  if (conflict.status === 'resolved' || showResult) {
    const winner = conflict.options.find(o => o.id === (winnerId || conflict.winnerId));
    return (
      <View style={styles.resolvedContainer}>
        <View style={styles.resolvedHeader}>
          <Trophy size={18} color="#FFD700" />
          <Text style={styles.resolvedTitle}>Community Verified</Text>
        </View>
        {winner && (
          <View style={styles.winnerCard}>
            <Text style={styles.winnerTitle}>{winner.title}</Text>
            <Text style={styles.winnerArtist}>{winner.artist}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: glowColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Animated.View style={{ transform: [{ rotate: sparkleRotate }] }}>
            <Zap size={18} color="#FB923C" />
          </Animated.View>
          <Text style={styles.headerTitle}>TRACK CONFLICT</Text>
        </View>
        <View style={styles.timestampBadge}>
          <Clock size={12} color={Colors.dark.textMuted} />
          <Text style={styles.timestampText}>@ {formatTimestamp(conflict.timestamp)}</Text>
        </View>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {conflict.options.map((option, index) => {
          const isOptionA = index === 0;
          const scaleAnim = isOptionA ? optionAScale : optionBScale;
          const votes = getVoteCount(option.id);
          const isVoted = userVotedOptionId === option.id;
          const isWinning = totalVotes > 0 && votes === Math.max(...conflict.options.map(o => getVoteCount(o.id)));

          return (
            <Animated.View
              key={option.id}
              style={[
                styles.optionCard,
                { transform: [{ scale: scaleAnim }] },
                isVoted && styles.optionCardVoted,
                voting === option.id && styles.optionCardVoting,
              ]}
            >
              <Pressable
                style={styles.optionPressable}
                onPress={() => handleVote(option)}
                disabled={userHasVoted || voting !== null}
              >
                {/* Platform badge */}
                <View style={styles.platformBadge}>
                  {getPlatformIcon(option.source)}
                  <Text style={styles.platformText}>
                    {option.source.charAt(0).toUpperCase() + option.source.slice(1)}
                  </Text>
                </View>

                {/* Track info */}
                <Text style={styles.optionTitle} numberOfLines={2}>
                  {option.title}
                </Text>
                <Text style={styles.optionArtist} numberOfLines={1}>
                  {option.artist}
                </Text>

                {/* Vote button / status */}
                <View style={styles.voteSection}>
                  {userHasVoted ? (
                    <View style={[styles.votedIndicator, isVoted && styles.votedIndicatorActive]}>
                      {isVoted && <Check size={14} color={Colors.dark.primary} />}
                      <Text style={[styles.voteCount, isVoted && styles.voteCountActive]}>
                        {votes} {votes === 1 ? 'vote' : 'votes'}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.voteButton, voting === option.id && styles.voteButtonVoting]}>
                      {voting === option.id ? (
                        <Text style={styles.voteButtonText}>...</Text>
                      ) : (
                        <>
                          <Sparkles size={14} color={Colors.dark.background} />
                          <Text style={styles.voteButtonText}>VOTE</Text>
                        </>
                      )}
                    </View>
                  )}
                  
                  {isWinning && totalVotes > 0 && (
                    <View style={styles.leadingBadge}>
                      <Text style={styles.leadingText}>Leading</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {votesNeeded > 0 ? (
          <Text style={styles.footerText}>
            {votesNeeded} more {votesNeeded === 1 ? 'vote' : 'votes'} to resolve
          </Text>
        ) : (
          <Text style={styles.footerText}>Waiting for majority...</Text>
        )}
        <View style={styles.pointsHint}>
          <Sparkles size={12} color={Colors.dark.primary} />
          <Text style={styles.pointsHintText}>+10 pts if right</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.3)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FB923C',
    letterSpacing: 1,
  },
  timestampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timestampText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  optionCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  optionCardVoted: {
    borderWidth: 2,
    borderColor: Colors.dark.primary,
  },
  optionCardVoting: {
    opacity: 0.8,
  },
  optionPressable: {
    padding: 14,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  platformText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 4,
    lineHeight: 18,
  },
  optionArtist: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  voteSection: {
    alignItems: 'center',
    gap: 6,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    width: '100%',
  },
  voteButtonVoting: {
    opacity: 0.7,
  },
  voteButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.background,
    letterSpacing: 0.5,
  },
  votedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.dark.surfaceLight,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    width: '100%',
  },
  votedIndicatorActive: {
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
  },
  voteCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  voteCountActive: {
    color: Colors.dark.primary,
  },
  leadingBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  leadingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFD700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.surfaceLight,
  },
  footerText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  pointsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointsHintText: {
    fontSize: 11,
    color: Colors.dark.primary,
    fontWeight: '500',
  },
  resolvedContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 14,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  resolvedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  resolvedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
  winnerCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 12,
  },
  winnerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  winnerArtist: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
});
