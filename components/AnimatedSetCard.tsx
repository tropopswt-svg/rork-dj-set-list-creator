import React, { useState, useEffect, useRef } from 'react';
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
  onEventPress?: (eventId: string) => void;
  centerOffset?: number; // Offset to adjust where "center" is (accounts for header)
  isSelected?: boolean; // Whether this card is the currently selected/centered one
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
export const CARD_HEIGHT = 116; // Approximate height of SetFeedCard (80px image + padding + margins)

export default function AnimatedSetCard({
  setList,
  index,
  scrollY,
  onPress,
  onArtistPress,
  onEventPress,
  centerOffset = 0,
  isSelected: isSelectedProp = false,
}: AnimatedSetCardProps) {
  // Local state for quick deselection - prevents lag when scrolling away
  const [localSelected, setLocalSelected] = useState(isSelectedProp);
  const lastScrollValue = useRef(0);

  // The scroll value when this card should be perfectly centered
  // centerOffset shifts the "center point" down to account for header elements
  const scrollYWhenCentered = index * CARD_HEIGHT - centerOffset;

  // Sync with prop when it becomes true (parent says we're selected)
  useEffect(() => {
    if (isSelectedProp) {
      setLocalSelected(true);
    }
  }, [isSelectedProp]);

  // Listen to scroll to quickly deselect when scrolling away
  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      const centeredIndex = Math.round((value + centerOffset) / CARD_HEIGHT);
      const shouldBeSelected = centeredIndex === index;

      // Quickly deselect if we're no longer centered
      if (!shouldBeSelected && localSelected) {
        setLocalSelected(false);
      }
      // Only select if prop says so (parent is source of truth for selection)
      else if (shouldBeSelected && isSelectedProp && !localSelected) {
        setLocalSelected(true);
      }

      lastScrollValue.current = value;
    });

    return () => scrollY.removeListener(listenerId);
  }, [scrollY, centerOffset, index, localSelected, isSelectedProp]);

  // Use local state for rendering (faster response)
  const isSelected = localSelected && isSelectedProp;

  // 5-point input range - selected card is BIG and requires more scroll to transition
  // Small center plateau keeps one card selected, wide transitions = more scroll needed
  const inputRange = [
    scrollYWhenCentered - CARD_HEIGHT * 1.8,  // Far - very small
    scrollYWhenCentered - CARD_HEIGHT * 0.4,  // Approaching center
    scrollYWhenCentered,                       // Centered - MAX size
    scrollYWhenCentered + CARD_HEIGHT * 0.4,  // Leaving center
    scrollYWhenCentered + CARD_HEIGHT * 1.8,  // Far - very small
  ];

  // BIG scale difference - selected card really pops out
  const scale = scrollY.interpolate({
    inputRange,
    outputRange: [0.82, 0.92, 1.12, 0.92, 0.82],
    extrapolate: 'clamp',
  });

  // Strong opacity contrast
  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.4, 0.7, 1, 0.7, 0.4],
    extrapolate: 'clamp',
  });

  // Strong glow on selected card
  const shadowOpacity = scrollY.interpolate({
    inputRange,
    outputRange: [0, 0.15, 0.6, 0.15, 0],
    extrapolate: 'clamp',
  });

  // Shadow spread - big glow on selected
  const shadowRadius = scrollY.interpolate({
    inputRange,
    outputRange: [0, 6, 28, 6, 0],
    extrapolate: 'clamp',
  });

  // Lift effect - selected card floats up
  const translateY = scrollY.interpolate({
    inputRange,
    outputRange: [2, 0, -10, 0, 2],
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
        onArtistPress={onArtistPress}
        onEventPress={onEventPress}
        isSelected={isSelected}
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
