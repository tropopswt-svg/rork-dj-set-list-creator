import React from 'react';
import { Animated, Dimensions, ViewStyle, StyleSheet, View } from 'react-native';
import SetFeedCard from './SetFeedCard';
import { SetList } from '@/types';
import Colors from '@/constants/colors';

interface AnimatedSetCardProps {
  setList: SetList;
  index: number;
  scrollY: Animated.Value;
  onPress: () => void;
  onLongPress?: () => void;
  onArtistPress: (artist: string) => void;
  onEventPress?: (eventId: string) => void;
  centerOffset?: number; // Offset to adjust where "center" is (accounts for header)
  isSelected?: boolean; // Whether this card is the currently selected/centered one
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
export const CARD_HEIGHT = 120; // Height of SetFeedCard (108px row + 12px margin)

export default function AnimatedSetCard({
  setList,
  index,
  scrollY,
  onPress,
  onLongPress,
  onArtistPress,
  onEventPress,
  centerOffset = 0,
  isSelected: isSelectedProp = false,
}: AnimatedSetCardProps) {
  // The scroll value when this card should be perfectly centered
  const scrollYWhenCentered = index * CARD_HEIGHT - centerOffset;

  // Use prop directly - no local state to avoid re-renders
  const isSelected = isSelectedProp;

  // 3-point input range - simpler, smoother transitions
  const inputRange = [
    scrollYWhenCentered - CARD_HEIGHT,  // One card away
    scrollYWhenCentered,                 // Centered
    scrollYWhenCentered + CARD_HEIGHT,  // One card away
  ];

  // Scale - subtle difference, surrounding cards still prominent
  const scale = scrollY.interpolate({
    inputRange,
    outputRange: [0.95, 1.05, 0.95],
    extrapolate: 'clamp',
  });

  // Opacity - surrounding cards more visible
  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.7, 1, 0.7],
    extrapolate: 'clamp',
  });

  // Lift effect - subtle float
  const translateY = scrollY.interpolate({
    inputRange,
    outputRange: [0, -6, 0],
    extrapolate: 'clamp',
  });

  // Simplified fill progress
  const fillProgress = scrollY.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  const animatedStyle: Animated.WithAnimatedObject<ViewStyle> = {
    transform: [{ scale }, { translateY }],
    opacity,
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <SetFeedCard
        setList={setList}
        onPress={onPress}
        onLongPress={onLongPress}
        onArtistPress={onArtistPress}
        onEventPress={onEventPress}
        isSelected={isSelected}
        fillProgress={fillProgress}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
});
