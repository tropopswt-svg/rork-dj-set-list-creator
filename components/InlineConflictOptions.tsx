import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Linking,
} from 'react-native';
import { 
  HelpCircle,
  Check,
  Play,
  Youtube,
  Music2,
  Radio,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { TrackConflict, ConflictOption } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35; // 35% of screen width to trigger selection
const SWIPE_OUT_DURATION = 250;

interface InlineConflictOptionsProps {
  conflict: TrackConflict;
  onSelect: (optionId: string) => Promise<{ success: boolean }>;
  youtubeUrl?: string;
  soundcloudUrl?: string;
}

// Format timestamp
const formatTimestamp = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Single swipeable option card
const SwipeableOption = ({
  option,
  index,
  totalOptions,
  timestamp,
  onSelect,
  onPlay,
  isSelecting,
}: {
  option: ConflictOption;
  index: number;
  totalOptions: number;
  timestamp: number;
  onSelect: () => void;
  onPlay: () => void;
  isSelecting: boolean;
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [swiping, setSwiping] = useState(false);

  const getPlatformIcon = (platform: string, size: number = 14) => {
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isSelecting,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return !isSelecting && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: () => {
        setSwiping(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow right swipe (positive dx)
        if (gestureState.dx > 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setSwiping(false);
        
        if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe threshold reached - select this option
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          // Animate off screen
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: SCREEN_WIDTH,
              duration: SWIPE_OUT_DURATION,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: SWIPE_OUT_DURATION,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onSelect();
          });
        } else {
          // Spring back
          Animated.spring(translateX, {
            toValue: 0,
            friction: 8,
            tension: 100,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        setSwiping(false);
        Animated.spring(translateX, {
          toValue: 0,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Calculate background color based on swipe progress
  const backgroundColor = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD, SCREEN_WIDTH],
    outputRange: [Colors.dark.surface, 'rgba(34, 197, 94, 0.3)', 'rgba(34, 197, 94, 0.5)'],
    extrapolate: 'clamp',
  });

  // Scale hint icon based on swipe
  const hintScale = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [1, 1.5],
    extrapolate: 'clamp',
  });

  const hintOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD / 2, SWIPE_THRESHOLD],
    outputRange: [0.3, 0.7, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.optionWrapper}>
      {/* Swipe hint background */}
      <Animated.View style={[styles.swipeHintBg, { opacity: hintOpacity }]}>
        <Animated.View style={{ transform: [{ scale: hintScale }] }}>
          <Check size={24} color="#22C55E" />
        </Animated.View>
        <Text style={styles.swipeHintText}>This one!</Text>
      </Animated.View>

      {/* The actual option card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.optionCard,
          {
            transform: [{ translateX }],
            opacity,
            backgroundColor,
          },
          swiping && styles.optionCardSwiping,
        ]}
      >
        {/* Timestamp badge */}
        <View style={styles.timestampBadge}>
          <Text style={styles.timestampText}>{formatTimestamp(timestamp)}</Text>
        </View>

        {/* Play button */}
        <Animated.View style={styles.playButton}>
          <Play 
            size={16} 
            color={option.source === 'youtube' ? '#FF0000' : '#FF5500'} 
            fill={option.source === 'youtube' ? '#FF0000' : '#FF5500'}
            onPress={onPlay}
          />
        </Animated.View>

        {/* Track info */}
        <View style={styles.trackInfo}>
          <View style={styles.titleRow}>
            {getPlatformIcon(option.source, 12)}
            <Text style={styles.trackTitle} numberOfLines={1}>
              {option.title}
            </Text>
          </View>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {option.artist}
          </Text>
        </View>

        {/* Option indicator */}
        <View style={styles.optionIndicator}>
          <HelpCircle size={14} color={Colors.dark.primary} />
          <Text style={styles.optionNumber}>{index + 1}/{totalOptions}</Text>
        </View>

        {/* Swipe arrow hint */}
        <View style={styles.swipeArrow}>
          <ChevronRight size={16} color={Colors.dark.textMuted} />
        </View>
      </Animated.View>
    </View>
  );
};

export default function InlineConflictOptions({
  conflict,
  onSelect,
  youtubeUrl,
  soundcloudUrl,
}: InlineConflictOptionsProps) {
  const [selecting, setSelecting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerHeight = useRef(new Animated.Value(conflict.options.length * 64)).current;

  const handleSelect = async (optionId: string) => {
    if (selecting) return;
    
    setSelecting(true);
    setSelectedId(optionId);
    
    try {
      await onSelect(optionId);
      
      // Collapse the container
      Animated.timing(containerHeight, {
        toValue: 64, // Height of one track
        duration: 300,
        useNativeDriver: false,
      }).start();
    } catch (error) {
      console.error('Selection error:', error);
      setSelecting(false);
      setSelectedId(null);
    }
  };

  const handlePlay = (option: ConflictOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (option.source === 'youtube' && youtubeUrl) {
      const url = youtubeUrl.includes('?') 
        ? `${youtubeUrl}&t=${conflict.timestamp}` 
        : `${youtubeUrl}?t=${conflict.timestamp}`;
      Linking.openURL(url);
    } else if (option.source === 'soundcloud' && soundcloudUrl) {
      const url = `${soundcloudUrl}#t=${formatTimestamp(conflict.timestamp)}`;
      Linking.openURL(url);
    }
  };

  // If resolved, show the winner
  if (conflict.status === 'resolved' || selectedId) {
    const winner = conflict.options.find(o => o.id === (selectedId || conflict.winnerId));
    if (winner) {
      return (
        <View style={styles.resolvedCard}>
          <View style={styles.resolvedBadge}>
            <Check size={12} color="#22C55E" />
          </View>
          <View style={styles.timestampBadge}>
            <Text style={styles.timestampText}>{formatTimestamp(conflict.timestamp)}</Text>
          </View>
          <View style={styles.resolvedInfo}>
            <Text style={styles.resolvedTitle} numberOfLines={1}>{winner.title}</Text>
            <Text style={styles.resolvedArtist} numberOfLines={1}>{winner.artist}</Text>
          </View>
          <View style={styles.pointsEarned}>
            <Sparkles size={10} color={Colors.dark.primary} />
            <Text style={styles.pointsText}>+10</Text>
          </View>
        </View>
      );
    }
  }

  return (
    <Animated.View style={[styles.container, { minHeight: containerHeight }]}>
      {/* Header hint */}
      <View style={styles.header}>
        <HelpCircle size={12} color={Colors.dark.primary} />
        <Text style={styles.headerText}>Which track? Swipe right to select</Text>
        <View style={styles.pointsChip}>
          <Sparkles size={8} color={Colors.dark.primary} />
          <Text style={styles.pointsChipText}>+10</Text>
        </View>
      </View>

      {/* Swipeable options */}
      <View style={styles.optionsStack}>
        {conflict.options.map((option, index) => (
          <SwipeableOption
            key={option.id}
            option={option}
            index={index}
            totalOptions={conflict.options.length}
            timestamp={conflict.timestamp}
            onSelect={() => handleSelect(option.id)}
            onPlay={() => handlePlay(option)}
            isSelecting={selecting}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(206, 138, 75, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(206, 138, 75, 0.25)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  headerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  pointsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(206, 138, 75, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pointsChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  optionsStack: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 4,
  },
  optionWrapper: {
    position: 'relative',
    height: 56,
  },
  swipeHintBg: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 10,
  },
  swipeHintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22C55E',
  },
  optionCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  optionCardSwiping: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  timestampBadge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  timestampText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  trackInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  trackArtist: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  optionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(206, 138, 75, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 4,
  },
  optionNumber: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  swipeArrow: {
    opacity: 0.5,
  },
  // Resolved state
  resolvedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 10,
    marginVertical: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
  },
  resolvedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  resolvedInfo: {
    flex: 1,
    marginLeft: 8,
  },
  resolvedTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  resolvedArtist: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  pointsEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(206, 138, 75, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pointsText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
});
