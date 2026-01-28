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

  // 5-point input range - smooth transitions
  const inputRange = [
    scrollYWhenCentered - CARD_HEIGHT * 1.8,  // Far - very small
    scrollYWhenCentered - CARD_HEIGHT * 0.4,  // Approaching center
    scrollYWhenCentered,                       // Centered - MAX size
    scrollYWhenCentered + CARD_HEIGHT * 0.4,  // Leaving center
    scrollYWhenCentered + CARD_HEIGHT * 1.8,  // Far - very small
  ];

  // Scale difference - selected card pops out
  const scale = scrollY.interpolate({
    inputRange,
    outputRange: [0.85, 0.94, 1.1, 0.94, 0.85],
    extrapolate: 'clamp',
  });

  // Strong opacity contrast - non-selected more faded
  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.35, 0.6, 1, 0.6, 0.35],
    extrapolate: 'clamp',
  });

  // Glow on selected card - prominent
  const shadowOpacity = scrollY.interpolate({
    inputRange,
    outputRange: [0, 0.2, 0.65, 0.2, 0],
    extrapolate: 'clamp',
  });

  // Shadow spread - strong glow on selected
  const shadowRadius = scrollY.interpolate({
    inputRange,
    outputRange: [0, 6, 24, 6, 0],
    extrapolate: 'clamp',
  });

  // Lift effect - selected card floats up
  const translateY = scrollY.interpolate({
    inputRange,
    outputRange: [2, 0, -10, 0, 2],
    extrapolate: 'clamp',
  });

  // Fill progress for the "liquid fill" effect on artist/venue chips
  // Tight range for snappy response - only show fill when very close to center
  const fillInputRange = [
    scrollYWhenCentered - CARD_HEIGHT * 0.5,  // Start filling
    scrollYWhenCentered - CARD_HEIGHT * 0.15, // Nearly full
    scrollYWhenCentered,                       // Full
    scrollYWhenCentered + CARD_HEIGHT * 0.15, // Nearly full
    scrollYWhenCentered + CARD_HEIGHT * 0.5,  // End draining
  ];
  const fillProgress = scrollY.interpolate({
    inputRange: fillInputRange,
    outputRange: [0, 0.9, 1, 0.9, 0], // Sharp on/off - no fill when not centered
    extrapolate: 'clamp',
  });

  // Direction of fill: 1 = filling from bottom (approaching), -1 = draining from top (leaving)
  // Cards above center drain downward, cards below center fill upward
  const fillDirection = scrollY.interpolate({
    inputRange: [
      scrollYWhenCentered - CARD_HEIGHT * 2,
      scrollYWhenCentered,
      scrollYWhenCentered + CARD_HEIGHT * 2,
    ],
    outputRange: [1, 0, -1], // 1 = above (drains down), -1 = below (fills up)
    extrapolate: 'clamp',
  });

  const animatedStyle: Animated.WithAnimatedObject<ViewStyle> = {
    transform: [{ scale }, { translateY }],
    opacity,
    // Strong glow effect on selected card
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity,
    shadowRadius,
    // Android elevation
    elevation: scrollY.interpolate({
      inputRange,
      outputRange: [1, 4, 16, 4, 1],
      extrapolate: 'clamp',
    }),
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
        fillDirection={fillDirection}
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
