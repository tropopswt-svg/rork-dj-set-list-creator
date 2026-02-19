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

  // 5-point input range for scroll wheel effect
  const wideInputRange = [
    scrollYWhenCentered - CARD_HEIGHT * 2,  // Two cards away
    scrollYWhenCentered - CARD_HEIGHT,       // One card away
    scrollYWhenCentered,                      // Centered
    scrollYWhenCentered + CARD_HEIGHT,       // One card away
    scrollYWhenCentered + CARD_HEIGHT * 2,   // Two cards away
  ];

  // Scale - centered card pops, neighbors slightly smaller
  const scale = scrollY.interpolate({
    inputRange: wideInputRange,
    outputRange: [0.92, 0.96, 1.05, 0.96, 0.92],
    extrapolate: 'clamp',
  });

  // Opacity - fade out further from center
  const opacity = scrollY.interpolate({
    inputRange: wideInputRange,
    outputRange: [0.5, 0.75, 1, 0.75, 0.5],
    extrapolate: 'clamp',
  });

  // Scroll wheel curve - neighbors tilt away, center lifts up
  const translateY = scrollY.interpolate({
    inputRange: wideInputRange,
    outputRange: [14, 6, -8, 6, 14],
    extrapolate: 'clamp',
  });

  // Accent bar white overlay opacity - 1 when centered, 0 when away
  // Uses opacity which is native-driver compatible
  const accentOpacity = scrollY.interpolate({
    inputRange: wideInputRange,
    outputRange: [0, 0, 1, 0, 0],
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
        isSelected={isSelectedProp}
        accentOpacity={accentOpacity}
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
