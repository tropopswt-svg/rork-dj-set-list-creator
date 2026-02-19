import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Square } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface SetRecordingBannerProps {
  startTime: Date;
  trackCount: number;
  onPress: () => void;
  onStop: () => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function SetRecordingBanner({
  startTime,
  trackCount,
  onPress,
  onStop,
}: SetRecordingBannerProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [elapsed, setElapsed] = useState(0);

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime.getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Pulse the red dot
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Pressable style={styles.banner} onPress={onPress}>
      <View style={styles.leftContent}>
        <Animated.View style={[styles.redDot, { opacity: pulseAnim }]} />
        <Text style={styles.recordingText}>Recording Set</Text>
        <Text style={styles.timerText}>{formatElapsed(elapsed)}</Text>
      </View>
      <View style={styles.rightContent}>
        <Text style={styles.trackCountText}>
          {trackCount} track{trackCount !== 1 ? 's' : ''}
        </Text>
        <Pressable
          style={styles.stopButton}
          onPress={(e) => {
            e.stopPropagation?.();
            onStop();
          }}
          hitSlop={8}
        >
          <Square size={12} color="#fff" fill="#fff" />
          <Text style={styles.stopText}>Stop</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(196, 30, 58, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 54, // account for status bar
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  recordingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    fontVariant: ['tabular-nums'],
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackCountText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  stopText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});
