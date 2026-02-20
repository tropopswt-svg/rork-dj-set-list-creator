import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Linking,
  Easing,
} from 'react-native';
import { 
  HelpCircle,
  Check,
  Play,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { TrackConflict, ConflictOption } from '@/types';

interface InlineConflictOptionsProps {
  conflict: TrackConflict;
  onSelect: (optionId: string) => Promise<{ success: boolean }>;
  youtubeUrl?: string;
  soundcloudUrl?: string;
}

// Clean up malformed track/artist names from scraping artifacts
const cleanTrackName = (name: string | undefined): string => {
  if (!name) return '';
  let cleaned = name;
  cleaned = cleaned.replace(/^\d+\)\s*/, '');
  cleaned = cleaned.replace(/^\d+\.\s*/, '');
  cleaned = cleaned.replace(/^\)\s*/, '');
  let openCount = 0;
  for (const ch of cleaned) {
    if (ch === '(') openCount++;
    if (ch === ')') openCount--;
  }
  if (openCount > 0) {
    for (let k = 0; k < openCount; k++) {
      const lastOpen = cleaned.lastIndexOf('(');
      if (lastOpen !== -1) {
        cleaned = cleaned.substring(0, lastOpen).trim();
      }
    }
  }
  return cleaned.trim();
};

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

// Floating option pill button
const FloatingOptionPill = ({
  option,
  index,
  totalOptions,
  onSelect,
  onPlay,
  isSelecting,
  shakeDelay,
}: {
  option: ConflictOption;
  index: number;
  totalOptions: number;
  onSelect: () => void;
  onPlay: () => void;
  isSelecting: boolean;
  shakeDelay: number;
}) => {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Shake animation - periodic attention grabber
  useEffect(() => {
    const startShake = () => {
      Animated.sequence([
        Animated.delay(shakeDelay),
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -1, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -1, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]),
        Animated.delay(4000 + Math.random() * 2000), // Random delay between shakes
      ]).start(() => startShake());
    };
    
    const timeout = setTimeout(startShake, shakeDelay);
    return () => clearTimeout(timeout);
  }, [shakeDelay]);

  // Floating animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { 
          toValue: -2, 
          duration: 1500 + index * 200, 
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true 
        }),
        Animated.timing(floatAnim, { 
          toValue: 2, 
          duration: 1500 + index * 200, 
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true 
        }),
      ])
    ).start();
  }, [index]);

  const handlePress = () => {
    if (isSelecting) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Scale down animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.1, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      onSelect();
    });
  };

  const handlePlayPress = (e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlay();
  };

  const shakeTranslate = shakeAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-3, 0, 3],
  });

  return (
    <Animated.View
      style={[
        styles.floatingPill,
        {
          transform: [
            { translateX: shakeTranslate },
            { translateY: floatAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <Pressable
        style={styles.pillContent}
        onPress={handlePress}
        disabled={isSelecting}
      >
        {/* Play button */}
        <Pressable style={styles.miniPlayButton} onPress={handlePlayPress}>
          <Play size={10} color="#FFFFFF" fill="#FFFFFF" />
        </Pressable>

        {/* Track info */}
        <View style={styles.pillInfo}>
          <Text style={styles.pillTitle} numberOfLines={1}>
            {cleanTrackName(option.title)}
          </Text>
          <Text style={styles.pillArtist} numberOfLines={1}>
            {cleanTrackName(option.artist)}
          </Text>
        </View>

        {/* Option indicator */}
        <View style={styles.pillIndicator}>
          <HelpCircle size={10} color={Colors.dark.primary} />
          <Text style={styles.pillNumber}>{index + 1}/{totalOptions}</Text>
        </View>
      </Pressable>
    </Animated.View>
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
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;

  const handleSelect = async (optionId: string) => {
    if (selecting) return;
    
    setSelecting(true);
    setSelectedId(optionId);
    
    // Animate the transition
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(expandAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
    
    try {
      await onSelect(optionId);
    } catch (error) {
      console.error('Selection error:', error);
      setSelecting(false);
      setSelectedId(null);
      fadeAnim.setValue(1);
      expandAnim.setValue(0);
    }
  };

  const handlePlay = (option: ConflictOption) => {
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

  // If resolved, show the winner as a regular track
  if (conflict.status === 'resolved' || selectedId) {
    const winner = conflict.options.find(o => o.id === (selectedId || conflict.winnerId));
    if (winner) {
      return (
        <View style={styles.resolvedCard}>
          <View style={styles.timestampBadge}>
            <Text style={styles.timestampText}>{formatTimestamp(conflict.timestamp)}</Text>
          </View>
          <View style={styles.resolvedCover}>
            <Check size={16} color="#22C55E" />
          </View>
          <View style={styles.resolvedInfo}>
            <Text style={styles.resolvedTitle} numberOfLines={1}>{cleanTrackName(winner.title)}</Text>
            <Text style={styles.resolvedArtist} numberOfLines={1}>{cleanTrackName(winner.artist)}</Text>
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
    <View style={styles.container}>
      {/* Ghost track slot - the "empty" track position */}
      <View style={styles.ghostTrackSlot}>
        <View style={styles.timestampBadge}>
          <Text style={styles.timestampText}>{formatTimestamp(conflict.timestamp)}</Text>
        </View>
        
        {/* Placeholder dashed area */}
        <View style={styles.placeholderArea}>
          <View style={styles.dashedBorder}>
            <HelpCircle size={16} color={Colors.dark.textMuted} />
            <Text style={styles.placeholderText}>Tap to identify</Text>
          </View>
        </View>
      </View>

      {/* Floating option pills that overlay the slot */}
      <Animated.View style={[styles.floatingContainer, { opacity: fadeAnim }]}>
        {conflict.options.map((option, index) => (
          <FloatingOptionPill
            key={option.id}
            option={option}
            index={index}
            totalOptions={conflict.options.length}
            onSelect={() => handleSelect(option.id)}
            onPlay={() => handlePlay(option)}
            isSelecting={selecting}
            shakeDelay={index * 500 + 1000}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginVertical: 4,
    minHeight: 70,
  },
  
  // Ghost track slot (the underlying "empty" position)
  ghostTrackSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(206, 138, 75, 0.3)',
    borderStyle: 'dashed',
  },
  timestampBadge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 10,
  },
  timestampText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  placeholderArea: {
    flex: 1,
  },
  dashedBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  placeholderText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },

  // Floating options container
  floatingContainer: {
    position: 'absolute',
    top: -8,
    left: 70,
    right: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    zIndex: 10,
  },

  // Individual floating pill
  floatingPill: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.dark.primary,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
    gap: 6,
  },
  miniPlayButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.dark.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillInfo: {
    maxWidth: 100,
  },
  pillTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  pillArtist: {
    fontSize: 9,
    color: Colors.dark.textSecondary,
  },
  pillIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(206, 138, 75, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pillNumber: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.dark.primary,
  },

  // Resolved state - looks like a normal track
  resolvedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 10,
    marginVertical: 4,
  },
  resolvedCover: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resolvedInfo: {
    flex: 1,
    marginLeft: 10,
  },
  resolvedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  resolvedArtist: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
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
