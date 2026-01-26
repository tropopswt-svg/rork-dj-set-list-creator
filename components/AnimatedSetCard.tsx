import React from 'react';
import { Animated, Dimensions, ViewStyle, StyleSheet } from 'react-native';
import SetFeedCard from './SetFeedCard';
import { SetList } from '@/types';
import Colors from '@/constants/colors';

interface AnimatedSetCardProps {
  setList: SetList;
  index: number;
  scrollY: Animated.Value;
  onPress: () => void;
  onArtistPress: (artist: string) => void;
  centerOffset?: number; // Offset to adjust where "center" is (accounts for header)
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
export const CARD_HEIGHT = 116; // Approximate height of SetFeedCard (80px image + padding + margins)

export default function AnimatedSetCard({
  setList,
  index,
  scrollY,
  onPress,
  onArtistPress,
  centerOffset = 0,
}: AnimatedSetCardProps) {
  // The scroll value when this card should be perfectly centered
  // centerOffset shifts the "center point" down to account for header elements
  const scrollYWhenCentered = index * CARD_HEIGHT - centerOffset;

  // Simple 3-point input range - ONE card is clearly selected at a time
  // Sharp transitions mean only the centered card is fully elevated
  const inputRange = [
    scrollYWhenCentered - CARD_HEIGHT,  // One card away - small
    scrollYWhenCentered,                 // Perfectly centered - BIG
    scrollYWhenCentered + CARD_HEIGHT,  // One card away - small
  ];

  // Clear scale difference - selected card pops out
  const scale = scrollY.interpolate({
    inputRange,
    outputRange: [0.88, 1.05, 0.88],
    extrapolate: 'clamp',
  });

  // Strong opacity contrast - selected card is bright, others faded
  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.5, 1, 0.5],
    extrapolate: 'clamp',
  });

  // Glow only on selected card
  const shadowOpacity = scrollY.interpolate({
    inputRange,
    outputRange: [0, 0.4, 0],
    extrapolate: 'clamp',
  });

  // Shadow spread
  const shadowRadius = scrollY.interpolate({
    inputRange,
    outputRange: [0, 16, 0],
    extrapolate: 'clamp',
  });

  // Subtle lift - no bouncing
  const translateY = scrollY.interpolate({
    inputRange,
    outputRange: [0, -4, 0],
    extrapolate: 'clamp',
  });

  const animatedStyle: Animated.WithAnimatedObject<ViewStyle> = {
    transform: [{ scale }, { translateY }],
    opacity,
    // Glow effect on selected card
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity,
    shadowRadius,
    // Android elevation
    elevation: scrollY.interpolate({
      inputRange,
      outputRange: [1, 8, 1],
      extrapolate: 'clamp',
    }),
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <SetFeedCard
        setList={setList}
        onPress={onPress}
        onArtistPress={onArtistPress}
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
