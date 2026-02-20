import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface LottieLoaderProps {
  /** Optional message below the animation */
  message?: string;
  /** Size of the animation container */
  size?: number;
  /** Variant: 'waveform' (music bars), 'pulse' (pulsing circle), 'dots' (bouncing dots) */
  variant?: 'waveform' | 'pulse' | 'dots';
  /** Custom color for the animation elements */
  color?: string;
}

// --- Waveform Bars (music equalizer effect) ---
function WaveformBars({ size, color }: { size: number; color: string }) {
  const barCount = 5;
  const barWidth = size * 0.08;
  const maxBarHeight = size * 0.5;
  const gap = size * 0.04;

  return (
    <View style={[styles.waveformContainer, { width: size, height: size }]}>
      {Array.from({ length: barCount }).map((_, i) => (
        <WaveformBar
          key={i}
          index={i}
          width={barWidth}
          maxHeight={maxBarHeight}
          color={color}
          gap={gap}
        />
      ))}
    </View>
  );
}

function WaveformBar({
  index,
  width,
  maxHeight,
  color,
  gap,
}: {
  index: number;
  width: number;
  maxHeight: number;
  color: string;
  gap: number;
}) {
  const scaleY = useSharedValue(0.3);

  // Each bar has a different timing pattern for organic feel
  const durations = [400, 500, 350, 450, 380];
  const delays = [0, 80, 160, 60, 120];
  const minHeights = [0.25, 0.35, 0.2, 0.4, 0.3];

  useEffect(() => {
    scaleY.value = withDelay(
      delays[index],
      withRepeat(
        withSequence(
          withTiming(1, { duration: durations[index], easing: Easing.inOut(Easing.sin) }),
          withTiming(minHeights[index], { duration: durations[index] * 0.8, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height: maxHeight,
          backgroundColor: color,
          borderRadius: width / 2,
          marginHorizontal: gap / 2,
          transformOrigin: 'bottom',
        },
        animatedStyle,
      ]}
    />
  );
}

// --- Pulsing Circle ---
function PulseCircle({ size, color }: { size: number; color: string }) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.8, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value * 0.3,
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 2 - scale.value }],
    opacity: opacity.value,
  }));

  const circleSize = size * 0.4;

  return (
    <View style={[styles.pulseContainer, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.pulseCircle,
          { width: circleSize * 1.6, height: circleSize * 1.6, borderRadius: circleSize * 0.8, backgroundColor: color },
          outerStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.pulseCircle,
          { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: color },
          innerStyle,
        ]}
      />
    </View>
  );
}

// --- Bouncing Dots ---
function BouncingDots({ size, color }: { size: number; color: string }) {
  const dotSize = size * 0.1;

  return (
    <View style={[styles.dotsContainer, { width: size, height: size }]}>
      {[0, 1, 2].map((i) => (
        <BouncingDot key={i} index={i} size={dotSize} color={color} />
      ))}
    </View>
  );
}

function BouncingDot({
  index,
  size,
  color,
}: {
  index: number;
  size: number;
  color: string;
}) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      index * 150,
      withRepeat(
        withSequence(
          withTiming(-size * 1.5, { duration: 300, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          marginHorizontal: size * 0.4,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function LottieLoader({
  message,
  size = 80,
  variant = 'waveform',
  color = '#C41E3A',
}: LottieLoaderProps) {
  const AnimationComponent = {
    waveform: WaveformBars,
    pulse: PulseCircle,
    dots: BouncingDots,
  }[variant];

  return (
    <View style={styles.container}>
      <AnimationComponent size={size} color={color} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  message: {
    marginTop: 16,
    fontSize: 13,
    color: 'rgba(0,0,0,0.45)',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pulseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircle: {
    position: 'absolute',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
