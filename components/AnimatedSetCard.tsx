import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, ViewStyle } from 'react-native';
import SetFeedCard from './SetFeedCard';
import { SetList } from '@/types';

interface AnimatedSetCardProps {
  setList: SetList;
  index: number;
  scrollY: Animated.Value;
  onPress: () => void;
  onArtistPress: (artist: string) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = 116; // Approximate height of SetFeedCard (80px image + padding + margins)
const HEADER_HEIGHT = 180; // Space above the cards (header, search, filters)

export default function AnimatedSetCard({
  setList,
  index,
  scrollY,
  onPress,
  onArtistPress,
}: AnimatedSetCardProps) {
  // Calculate the Y position where this card starts
  const cardStartY = HEADER_HEIGHT + (index * CARD_HEIGHT);

  // Center of the viewport (where we want max scale)
  const viewportCenter = SCREEN_HEIGHT / 2;

  // Input range: when card is above center, at center, below center
  const inputRange = [
    cardStartY - viewportCenter - CARD_HEIGHT,  // Card is well above viewport center
    cardStartY - viewportCenter,                 // Card is at viewport center
    cardStartY - viewportCenter + CARD_HEIGHT,  // Card is well below viewport center
  ];

  // Scale: slightly smaller when away from center, normal at center
  const scale = scrollY.interpolate({
    inputRange,
    outputRange: [0.96, 1.02, 0.96],
    extrapolate: 'clamp',
  });

  // Opacity: slightly dimmed when away from center
  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.85, 1, 0.85],
    extrapolate: 'clamp',
  });

  // Elevation shadow (via translateZ simulation with shadow)
  const shadowOpacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.05, 0.15, 0.05],
    extrapolate: 'clamp',
  });

  const animatedStyle: Animated.WithAnimatedObject<ViewStyle> = {
    transform: [{ scale }],
    opacity,
  };

  return (
    <Animated.View style={animatedStyle}>
      <SetFeedCard
        setList={setList}
        onPress={onPress}
        onArtistPress={onArtistPress}
      />
    </Animated.View>
  );
}
