import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';

interface DoubleTapHeartProps {
  visible: boolean;
  onComplete: () => void;
}

export default function DoubleTapHeart({ visible, onComplete }: DoubleTapHeartProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    scale.setValue(0);
    opacity.setValue(1);

    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.3,
          speed: 50,
          bounciness: 12,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start(() => onComplete());
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { transform: [{ scale }], opacity }]}
    >
      <Heart size={80} color="#EF4444" fill="#EF4444" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
