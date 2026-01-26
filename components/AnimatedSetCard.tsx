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

  // EXTRA STICKY input range - card stays "locked" at full size much longer
  // Wide center plateau creates a "snap" feel - requires more scroll to transition
  const inputRange = [
    scrollYWhenCentered - CARD_HEIGHT * 4,    // Card is far below - very small
    scrollYWhenCentered - CARD_HEIGHT * 2,    // Approaching - start growing slowly
    scrollYWhenCentered - CARD_HEIGHT * 0.6,  // Nearly centered - accelerate
    scrollYWhenCentered + CARD_HEIGHT * 0.6,  // At center plateau - stay BIG (wider = stickier)
    scrollYWhenCentered + CARD_HEIGHT * 2,    // Moving away - start shrinking
    scrollYWhenCentered + CARD_HEIGHT * 4,    // Card is far above - very small
  ];

  // STRONGER scale difference - much clearer which card is selected
  const scale = scrollY.interpolate({
    inputRange,
    outputRange: [0.78, 0.85, 1.08, 1.08, 0.85, 0.78],
    extrapolate: 'clamp',
  });

  // STRONGER opacity contrast
  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.4, 0.6, 1, 1, 0.6, 0.4],
    extrapolate: 'clamp',
  });

  // STRONGER shadow/glow intensity
  const shadowOpacity = scrollY.interpolate({
    inputRange,
    outputRange: [0, 0.1, 0.5, 0.5, 0.1, 0],
    extrapolate: 'clamp',
  });

  // Larger shadow spread for elevated card
  const shadowRadius = scrollY.interpolate({
    inputRange,
    outputRange: [0, 4, 24, 24, 4, 0],
    extrapolate: 'clamp',
  });

  // More pronounced lift effect
  const translateY = scrollY.interpolate({
    inputRange,
    outputRange: [4, 2, -8, -8, 2, 4],
    extrapolate: 'clamp',
  });

  // Add horizontal translateX for depth effect (cards offset slightly when not centered)
  const translateX = scrollY.interpolate({
    inputRange,
    outputRange: [8, 4, 0, 0, 4, 8],
    extrapolate: 'clamp',
  });

  const animatedStyle: Animated.WithAnimatedObject<ViewStyle> = {
    transform: [{ scale }, { translateY }, { translateX }],
    opacity,
    // Strong glow effect - orange tinted shadow for elevated card
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity,
    shadowRadius,
    // Android elevation - stronger for centered card
    elevation: scrollY.interpolate({
      inputRange,
      outputRange: [0, 2, 12, 12, 2, 0],
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
