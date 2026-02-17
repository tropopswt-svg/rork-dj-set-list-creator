import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// TRACK'D Logo with scanning effect and volume bars

interface IddLogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
}

// Seeded random for consistent waveform generation
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
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
  // Each letter gets activated at a specific point in the scan
  const letterStart = letterIndex / totalLetters;
  const letterEnd = (letterIndex + 1) / totalLetters;
  const letterMid = (letterStart + letterEnd) / 2;

  // Volume bars heights (random for each letter)
  const barHeights = useRef(
    Array.from({ length: 5 }, (_, i) => 0.3 + seededRandom(letterIndex * 10 + i) * 0.7)
  ).current;

  // Animate bar scale based on scan progress
  const barScales = barHeights.map((_, barIndex) => {
    return scanProgress.interpolate({
      inputRange: [
        Math.max(0, letterStart - 0.05),
        letterStart,
        letterMid,
        letterEnd,
        Math.min(1, letterEnd + 0.1),
      ],
      outputRange: [0, 0.2, 1, 0.8, 0],
      extrapolate: 'clamp',
    });
  });

  const barWidth = fontSize * 0.08;
  const barMaxHeight = fontSize * 0.5;
  // Each letter gets width based on character - wider for A, C, K
  const letterWidth = letter === "'" ? fontSize * 0.3 : fontSize * 0.65;
  const letterSpacing = 2; // Gap between letters

  return (
    <View style={[styles.letterContainer, { width: letterWidth, marginHorizontal: letterSpacing }]}>
      {/* Volume bars behind the letter */}
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
                marginHorizontal: 1,
              },
            ]}
          />
        ))}
      </View>
      {/* The letter on top */}
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

// Static D with vinyl needle (no spinning, no volume bars)
const VinylD = ({ fontSize = 56 }: { fontSize?: number }) => {
  const needleSize = fontSize * 0.12;
  const needleArmLength = fontSize * 0.18;

  return (
    <View style={[styles.vinylDWrapper, { width: fontSize * 0.65, marginLeft: 2 }]}>
      <Text
        style={[
          styles.vinylD,
          {
            fontSize,
            lineHeight: fontSize,
          },
        ]}
      >
        D
      </Text>
      <View style={[styles.needleContainer, { width: fontSize, height: fontSize }]}>
        <View
          style={[
            styles.needleArm,
            {
              width: needleArmLength,
              height: 2,
              top: fontSize * 0.48,
              left: fontSize * 0.35,
            },
          ]}
        />
        <View
          style={[
            styles.needleHead,
            {
              width: needleSize,
              height: needleSize,
              borderRadius: needleSize / 2,
              top: fontSize * 0.44,
              left: fontSize * 0.32,
            },
          ]}
        />
      </View>
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

export default function IddLogo({ size = 'medium', showTagline = false }: IddLogoProps) {
  const scanProgress = useRef(new Animated.Value(0)).current;

  const sizeConfig = {
    small: { fontSize: 42, spacing: 2, waveHeight: 70, logoWidth: 200 },
    medium: { fontSize: 56, spacing: 3, waveHeight: 90, logoWidth: 260 },
    large: { fontSize: 72, spacing: 4, waveHeight: 110, logoWidth: 340 },
  }[size];

  const letters = ['T', 'R', 'A', 'C', 'K'];
  const totalLetters = letters.length + 1; // +1 for D

  useEffect(() => {
    // Run scan animation every 15 seconds
    const runScan = () => {
      scanProgress.setValue(0);
      Animated.timing(scanProgress, {
        toValue: 1,
        duration: 2500, // Scan takes 2.5 seconds
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    };

    // Initial scan
    runScan();

    // Repeat every 15 seconds
    const interval = setInterval(runScan, 15000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {/* Scan line - positioned to extend full screen width */}
      <View style={styles.scanLineWrapper}>
        <ScanLine
          scanProgress={scanProgress}
          width={SCREEN_WIDTH}
          height={sizeConfig.fontSize * 1.5}
        />
      </View>

      {/* Letters with volume bars that rise from bottom */}
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
        {/* D with needle */}
        <VinylD fontSize={sizeConfig.fontSize} />
      </View>

      {showTagline && (
        <Text style={styles.tagline}>Every track. Every set.</Text>
      )}
    </View>
  );
}

// Badge version
export function IddBadge({ size = 'small' }: { size?: 'small' | 'medium' }) {
  const sizeConfig = {
    small: { fontSize: 10, padding: 4 },
    medium: { fontSize: 12, padding: 6 },
  }[size];

  return (
    <View style={[styles.badge, { paddingHorizontal: sizeConfig.padding + 2, paddingVertical: sizeConfig.padding }]}>
      <Text style={[styles.badgeText, { fontSize: sizeConfig.fontSize }]}>TRACK'D</Text>
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
    backgroundColor: Colors.dark.primary,
    borderRadius: 2,
    transformOrigin: 'bottom',
  },
  logoLetter: {
    fontWeight: '800',
    color: '#0A0A0A',
    letterSpacing: 0,
    fontFamily: 'System',
  },
  vinylDWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  vinylDContainer: {
    position: 'relative',
  },
  vinylD: {
    fontWeight: '800',
    color: '#0A0A0A',
    fontFamily: 'System',
  },
  needleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
  },
  needleArm: {
    position: 'absolute',
    backgroundColor: '#6B6B6B',
    transform: [{ rotate: '-35deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  needleHead: {
    position: 'absolute',
    backgroundColor: '#9E1830',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
  scanLine: {
    position: 'absolute',
    width: 3,
    backgroundColor: Colors.dark.primary,
    zIndex: 10,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  tagline: {
    marginTop: 12,
    fontSize: 12,
    color: Colors.dark.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  badge: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
