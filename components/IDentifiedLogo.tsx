import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Colors from '@/constants/colors';

interface IDentifiedLogoProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
}

const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

const AnimatedBar = ({ index, baseHeight }: { index: number; baseHeight: number }) => {
  const scaleAnim = useRef(new Animated.Value(seededRandom(index * 7) * 0.3 + 0.6)).current;

  useEffect(() => {
    // Random initial delay so bars start out of phase
    const initialDelay = seededRandom(index * 13) * 1000;

    const timeout = setTimeout(() => {
      // Each bar gets completely unique timing and values
      const createRandomSequence = () => {
        const steps = 3 + Math.floor(seededRandom(index * 17) * 3); // 3-5 steps
        const sequence = [];

        for (let i = 0; i < steps; i++) {
          const targetValue = 0.5 + seededRandom(index * 23 + i * 31) * 0.5;
          const duration = 600 + seededRandom(index * 29 + i * 37) * 800;

          sequence.push(
            Animated.timing(scaleAnim, {
              toValue: targetValue,
              duration: duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            })
          );
        }
        return sequence;
      };

      const bounce = Animated.loop(
        Animated.sequence(createRandomSequence())
      );
      bounce.start();
    }, initialDelay);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          height: baseHeight,
          transform: [{ scaleY: scaleAnim }],
        },
      ]}
    />
  );
};

export default function IDentifiedLogo({ size = 'medium' }: IDentifiedLogoProps) {
  const scanProgress = useRef(new Animated.Value(0)).current;

  const sizeConfig = {
    small: { fontSize: 12, paddingH: 6, borderRadius: 6, width: 70 },
    medium: { fontSize: 14, paddingH: 8, borderRadius: 8, width: 85 },
    large: { fontSize: 18, paddingH: 10, borderRadius: 10, width: 105 },
    xlarge: { fontSize: 26, paddingH: 14, borderRadius: 12, width: 145 },
  }[size];

  // Generate unique base heights for each bar (shorter since they're behind text)
  const barHeights = [...Array(16)].map((_, i) =>
    15 + seededRandom(i * 41) * 10
  );

  // Scan animation - runs every 15 seconds
  useEffect(() => {
    const runScan = () => {
      scanProgress.setValue(0);
      Animated.timing(scanProgress, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    };

    // Initial scan after a delay
    const initialTimeout = setTimeout(runScan, 2000);

    // Repeat every 15 seconds
    const interval = setInterval(runScan, 15000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const scanLineTranslate = scanProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, sizeConfig.width + 30],
  });

  const scanLineOpacity = scanProgress.interpolate({
    inputRange: [0, 0.05, 0.95, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: sizeConfig.paddingH,
          borderRadius: sizeConfig.borderRadius,
        },
      ]}
    >
      {/* Row of animated red bars behind text */}
      <View style={styles.barsRow}>
        {barHeights.map((height, i) => (
          <AnimatedBar
            key={i}
            index={i}
            baseHeight={height}
          />
        ))}
      </View>

      {/* Scan line */}
      <Animated.View
        style={[
          styles.scanLine,
          {
            transform: [{ translateX: scanLineTranslate }],
            opacity: scanLineOpacity,
          },
        ]}
      />

      {/* Text on top of bars */}
      <Text style={[styles.text, { fontSize: sizeConfig.fontSize }]}>
        trakd
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
    paddingVertical: 6,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    zIndex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  barsRow: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    opacity: 0.5,
    zIndex: 0,
  },
  bar: {
    width: 3,
    backgroundColor: '#C41E3A',
    borderRadius: 1,
    transformOrigin: 'bottom',
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.dark.primary,
    zIndex: 2,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});
