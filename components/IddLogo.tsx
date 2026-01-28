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

// Generate realistic waveform data for background
const generateWaveformData = (count: number) => {
  const data: { height: number; color: string }[] = [];
  const colors = [
    'rgba(196, 30, 58, 0.4)',
    'rgba(196, 30, 58, 0.55)',
    'rgba(196, 30, 58, 0.75)',
    'rgba(180, 25, 50, 0.5)',
    'rgba(220, 40, 70, 0.5)',
  ];

  for (let i = 0; i < count; i++) {
    const progress = i / count;
    const seed = i * 1.337;
    let baseAmp = 0.3;
    let colorPhase = 0;

    if (progress < 0.08) {
      baseAmp = 0.2 + seededRandom(seed) * 0.15;
      colorPhase = 0;
    } else if (progress < 0.18) {
      baseAmp = 0.3 + (progress - 0.08) * 4 + seededRandom(seed) * 0.2;
      colorPhase = 1;
    } else if (progress < 0.35) {
      baseAmp = 0.7 + seededRandom(seed) * 0.3;
      colorPhase = 2;
    } else if (progress < 0.45) {
      baseAmp = 0.25 + seededRandom(seed) * 0.2;
      colorPhase = 3;
    } else if (progress < 0.55) {
      baseAmp = 0.35 + (progress - 0.45) * 5 + seededRandom(seed) * 0.2;
      colorPhase = 1;
    } else if (progress < 0.72) {
      baseAmp = 0.75 + seededRandom(seed) * 0.25;
      colorPhase = 2;
    } else if (progress < 0.82) {
      baseAmp = 0.3 + seededRandom(seed) * 0.25;
      colorPhase = 4;
    } else {
      const outroProgress = (progress - 0.82) / 0.18;
      baseAmp = 0.35 + (0.2 - 0.35) * outroProgress + seededRandom(seed) * 0.1;
      colorPhase = 0;
    }

    data.push({
      height: Math.max(0.08, Math.min(1, baseAmp + seededRandom(seed + 0.5) * 0.1)),
      color: colors[colorPhase],
    });
  }
  return data;
};

// Full-width scrolling waveform background
const FullWaveform = ({ width, height }: { width: number; height: number }) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const wavePulseAnim = useRef(new Animated.Value(0)).current;
  const waveformData = useRef(generateWaveformData(150)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(scrollAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.delay(6000),
        Animated.timing(wavePulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(wavePulseAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const barWidth = 4;
  const singleSetWidth = waveformData.length * barWidth;

  const translateX = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -singleSetWidth],
  });

  const scaleY = wavePulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.7, 1],
  });

  return (
    <View style={[styles.fullWaveformContainer, { width, height }]}>
      <Animated.View
        style={[
          styles.waveformBars,
          { transform: [{ translateX }, { scaleY }] },
        ]}
      >
        {[...waveformData, ...waveformData].map((bar, i) => (
          <View
            key={i}
            style={[
              styles.waveformBar,
              { height: height * bar.height, backgroundColor: bar.color },
            ]}
          />
        ))}
      </Animated.View>
    </View>
  );
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
  const letterWidth = fontSize * 0.55; // Tighter letter spacing

  return (
    <View style={[styles.letterContainer, { width: letterWidth }]}>
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
    <View style={[styles.vinylDWrapper, { marginLeft: -fontSize * 0.1 }]}>
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

  const letters = ['T', 'R', 'A', 'C', 'K', "'"];
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
      {/* Full-width waveform background */}
      <View style={styles.waveformBackground}>
        <FullWaveform width={SCREEN_WIDTH} height={sizeConfig.waveHeight} />
      </View>

      {/* Logo with animated letters */}
      <View style={[styles.logoWrapper, { width: sizeConfig.logoWidth }]}>
        {/* Scan line */}
        <ScanLine
          scanProgress={scanProgress}
          width={sizeConfig.logoWidth}
          height={sizeConfig.fontSize * 1.2}
        />

        {/* Letters */}
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
  },
  waveformBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  fullWaveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waveformBar: {
    width: 3,
    marginHorizontal: 0.5,
    borderRadius: 1.5,
  },
  logoWrapper: {
    position: 'relative',
    zIndex: 1,
    overflow: 'hidden',
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
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
    color: '#FFFFFF',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    fontFamily: 'System',
  },
  vinylDWrapper: {
    position: 'relative',
  },
  vinylDContainer: {
    position: 'relative',
  },
  vinylD: {
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
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
