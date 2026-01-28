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
  const sizeConfig = {
    small: { fontSize: 12, paddingH: 6, borderRadius: 6 },
    medium: { fontSize: 14, paddingH: 8, borderRadius: 8 },
    large: { fontSize: 18, paddingH: 10, borderRadius: 10 },
    xlarge: { fontSize: 26, paddingH: 14, borderRadius: 12 },
  }[size];

  // Generate unique base heights for each bar
  const barHeights = [...Array(20)].map((_, i) =>
    35 + seededRandom(i * 41) * 15
  );

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
      {/* Text */}
      <Text style={[styles.text, { fontSize: sizeConfig.fontSize }]}>
        TRACK'D
      </Text>

      {/* Row of animated red bars at the bottom */}
      <View style={styles.barsRow}>
        {barHeights.map((height, i) => (
          <AnimatedBar
            key={i}
            index={i}
            baseHeight={height}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
    paddingTop: 8,
  },
  text: {
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    height: 50,
  },
  bar: {
    width: 3,
    backgroundColor: Colors.dark.primary,
    borderRadius: 1,
  },
});
