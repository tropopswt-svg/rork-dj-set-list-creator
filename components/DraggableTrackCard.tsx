import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { GripVertical, Music } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Track } from '@/types';

interface DraggableTrackCardProps {
  track: Track;
  index: number;
  onDragStart?: () => void;
  onDragEnd?: (track: Track, y: number) => void;
  onPress?: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DraggableTrackCard({
  track,
  index,
  onDragStart,
  onDragEnd,
  onPress,
}: DraggableTrackCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const startY = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only start drag if moving vertically more than horizontally
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: (evt) => {
        startY.current = evt.nativeEvent.pageY;
        setIsDragging(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onDragStart?.();

        // Scale up and add shadow effect
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1.05,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.9,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow upward movement (negative dy)
        const newY = Math.min(0, gestureState.dy);
        pan.setValue({ x: 0, y: newY });
      },
      onPanResponderRelease: (evt, gestureState) => {
        setIsDragging(false);

        // Calculate final position for drop detection
        const finalY = evt.nativeEvent.pageY;

        // Reset animations
        Animated.parallel([
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();

        // If dragged significantly upward, trigger drop
        if (gestureState.dy < -50) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onDragEnd?.(track, finalY);
        }
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        Animated.parallel([
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.container,
        isDragging && styles.dragging,
        {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale },
          ],
          opacity,
          zIndex: isDragging ? 1000 : 1,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.dragHandle}>
        <GripVertical size={16} color={Colors.dark.textMuted} />
      </View>

      <View style={styles.indexContainer}>
        <Text style={styles.indexText}>{index + 1}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>

      {isDragging && (
        <View style={styles.dragHint}>
          <Text style={styles.dragHintText}>Drop on gap</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  dragging: {
    backgroundColor: Colors.dark.elevated,
    borderColor: Colors.dark.primary,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dragHandle: {
    paddingRight: 8,
    paddingVertical: 4,
  },
  indexContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  indexText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  artist: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  dragHint: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dragHintText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.dark.background,
  },
});
