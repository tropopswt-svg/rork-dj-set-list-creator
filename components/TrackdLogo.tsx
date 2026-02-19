import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TrackdLogoProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  showTagline?: boolean;
}

// Seeded random for consistent waveform generation
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

// Per-letter width ratios (relative to fontSize)
const LETTER_WIDTHS: Record<string, number> = {
  t: 0.38,
  r: 0.38,
  a: 0.52,
  c: 0.58,
  k: 0.55,
  d: 0.56,
};

// Individual letter with volume bars that animate from bottom
const AnimatedLetter = ({
  letter,
  fontSize,
  scanProgress,
  letterIndex,
  totalLetters,
}: {
  letter: string;
  fontSize: number;
  scanProgress: Animated.Value;
  letterIndex: number;
  totalLetters: number;
}) => {
  const letterStart = letterIndex / totalLetters;
  const letterEnd = (letterIndex + 1) / totalLetters;
  const letterMid = (letterStart + letterEnd) / 2;

  const barHeights = useRef(
    Array.from({ length: 5 }, (_, i) => 0.3 + seededRandom(letterIndex * 10 + i) * 0.7)
  ).current;

  const fadeOut = Math.min(1, letterEnd + 0.08);
  const barScales = barHeights.map(() => {
    return scanProgress.interpolate({
      inputRange: [
        Math.max(0, letterStart - 0.05),
        letterStart,
        letterMid,
        Math.min(letterEnd, fadeOut - 0.01),
        fadeOut,
      ],
      outputRange: [0, 0.2, 1, 0.6, 0],
      extrapolate: 'clamp',
    });
  });

  const barWidth = fontSize * 0.07;
  const barMaxHeight = fontSize * 0.45;
  const letterWidth = fontSize * (LETTER_WIDTHS[letter] || 0.5);

  return (
    <View style={[styles.letterContainer, { width: letterWidth }]}>
      <View style={[styles.volumeBarsContainer, { height: barMaxHeight }]}>
        {barHeights.map((height, i) => (
          <Animated.View
            key={i}
            style={[
              styles.volumeBar,
              {
                width: barWidth,
                height: barMaxHeight * height,
                transform: [{ scaleY: barScales[i] }],
                marginHorizontal: 0.5,
              },
            ]}
          />
        ))}
      </View>
      <Text
        style={[
          styles.logoLetter,
          { fontSize, lineHeight: fontSize },
        ]}
      >
        {letter}
      </Text>
    </View>
  );
};

// Scan line component
const ScanLine = ({
  scanProgress,
  width,
  height,
}: {
  scanProgress: Animated.Value;
  width: number;
  height: number;
}) => {
  const translateX = scanProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, width],
  });

  const opacity = scanProgress.interpolate({
    inputRange: [0, 0.02, 0.98, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.scanLine,
        {
          height,
          transform: [{ translateX }],
          opacity,
        },
      ]}
    />
  );
};

export default function TrackdLogo({ size = 'medium', showTagline = false }: TrackdLogoProps) {
  const scanProgress = useRef(new Animated.Value(0)).current;

  const sizeConfig = {
    small: { fontSize: 42 },
    medium: { fontSize: 56 },
    large: { fontSize: 72 },
    xlarge: { fontSize: 90 },
  }[size];

  const letters = ['t', 'r', 'a', 'k', 'd'];
  const totalLetters = letters.length;

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

    runScan();
    const interval = setInterval(runScan, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.scanLineWrapper}>
        <ScanLine
          scanProgress={scanProgress}
          width={SCREEN_WIDTH}
          height={sizeConfig.fontSize * 1.5}
        />
      </View>

      <View style={styles.lettersRow}>
        {letters.map((letter, index) => (
          <AnimatedLetter
            key={index}
            letter={letter}
            fontSize={sizeConfig.fontSize}
            scanProgress={scanProgress}
            letterIndex={index}
            totalLetters={totalLetters}
          />
        ))}
      </View>

      {showTagline && (
        <Text style={styles.tagline}>Every track. Every set.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  scanLineWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -SCREEN_WIDTH / 2,
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    zIndex: 2,
    pointerEvents: 'none',
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1,
  },
  letterContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  volumeBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  volumeBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    transformOrigin: 'bottom',
  },
  logoLetter: {
    fontWeight: '800',
    color: Colors.dark.primary,
    letterSpacing: -0.3,
    fontFamily: 'System',
  },
  scanLine: {
    position: 'absolute',
    width: 3,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  tagline: {
    marginTop: 12,
    fontSize: 12,
    color: Colors.dark.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
