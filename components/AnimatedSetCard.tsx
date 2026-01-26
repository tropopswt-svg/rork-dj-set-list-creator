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
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = 116; // Approximate height of SetFeedCard (80px image + padding + margins)

export default function AnimatedSetCard({
  setList,
  index,
  scrollY,
  onPress,
  onArtistPress,
}: AnimatedSetCardProps) {
  // The scroll value when this card should be perfectly centered
  // Card is centered when: cardTopInList - scrollY = screenCenter - cardHeight/2
  // Simplified: scrollY = index * CARD_HEIGHT (offset to put card at screen center)
  const scrollYWhenCentered = index * CARD_HEIGHT;

  // Input range with a wider "plateau" for more weight/stickiness
  // The card stays at peak scale for a larger scroll distance
  const inputRange = [
    scrollYWhenCentered - CARD_HEIGHT * 2,    // Card is below center - small
    scrollYWhenCentered - CARD_HEIGHT * 0.5,  // Approaching center - start growing
    scrollYWhenCentered + CARD_HEIGHT * 0.5,  // At center plateau - stay big
    scrollYWhenCentered + CARD_HEIGHT * 2,    // Card is above center - small again
  ];

  // Scale: smaller when far from center, larger at center with plateau
  const scale = scrollY.interpolate({
    inputRange,
    outputRange: [0.88, 1.05, 1.05, 0.88],
    extrapolate: 'clamp',
  });

  // Opacity: dimmed when away from center, with plateau at full opacity
  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.65, 1, 1, 0.65],
    extrapolate: 'clamp',
  });

  // Shadow/glow intensity for elevation effect
  const shadowOpacity = scrollY.interpolate({
    inputRange,
    outputRange: [0, 0.35, 0.35, 0],
    extrapolate: 'clamp',
  });

  // Shadow radius for glow spread
  const shadowRadius = scrollY.interpolate({
    inputRange,
    outputRange: [0, 16, 16, 0],
    extrapolate: 'clamp',
  });

  // Slight lift effect (translateY)
  const translateY = scrollY.interpolate({
    inputRange,
    outputRange: [0, -4, -4, 0],
    extrapolate: 'clamp',
  });

  const animatedStyle: Animated.WithAnimatedObject<ViewStyle> = {
    transform: [{ scale }, { translateY }],
    opacity,
    // Glow effect - orange tinted shadow
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity,
    shadowRadius,
    // Android elevation
    elevation: scrollY.interpolate({
      inputRange,
      outputRange: [0, 8, 8, 0],
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
