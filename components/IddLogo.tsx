import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// TRACK'D Logo
// Clean TRACK'D text with spinning vinyl D and full-width waveform background

interface IddLogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
}

// Seeded random for consistent waveform generation
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

// Generate realistic waveform data - seamless loop (end matches start)
const generateWaveformData = (count: number) => {
  const data: { height: number; color: string }[] = [];

  // Circoloco red (#C41E3A) with varying shades
  const colors = [
    'rgba(196, 30, 58, 0.4)',     // Circoloco red - lighter (intro/outro)
    'rgba(196, 30, 58, 0.55)',    // Circoloco red - medium (buildup)
    'rgba(196, 30, 58, 0.75)',    // Circoloco red - strong (drop)
    'rgba(180, 25, 50, 0.5)',     // Slightly darker red (breakdown)
    'rgba(220, 40, 70, 0.5)',     // Slightly lighter/brighter red (breakdown 2)
  ];

  // Simulate a real track with intro, buildup, drop, breakdown, outro
  // Outro transitions back to intro values for seamless loop
  for (let i = 0; i < count; i++) {
    const progress = i / count;
    const seed = i * 1.337; // Consistent seed for each bar

    let baseAmp = 0.3;
    let colorPhase = 0;

    // Intro (quiet) - blue
    if (progress < 0.08) {
      baseAmp = 0.2 + seededRandom(seed) * 0.15;
      colorPhase = 0;
    }
    // Buildup - pink
    else if (progress < 0.18) {
      baseAmp = 0.3 + (progress - 0.08) * 4 + seededRandom(seed) * 0.2;
      colorPhase = 1;
    }
    // Drop (loud) - red
    else if (progress < 0.35) {
      baseAmp = 0.7 + seededRandom(seed) * 0.3;
      colorPhase = 2;
    }
    // Breakdown (quieter) - cyan
    else if (progress < 0.45) {
      baseAmp = 0.25 + seededRandom(seed) * 0.2;
      colorPhase = 3;
    }
    // Buildup 2 - pink
    else if (progress < 0.55) {
      baseAmp = 0.35 + (progress - 0.45) * 5 + seededRandom(seed) * 0.2;
      colorPhase = 1;
    }
    // Drop 2 (loud) - red
    else if (progress < 0.72) {
      baseAmp = 0.75 + seededRandom(seed) * 0.25;
      colorPhase = 2;
    }
    // Breakdown 2 - green
    else if (progress < 0.82) {
      baseAmp = 0.3 + seededRandom(seed) * 0.25;
      colorPhase = 4;
    }
    // Outro (fading back to intro) - transition to blue
    else {
      // Smoothly fade from breakdown levels back to intro levels
      const outroProgress = (progress - 0.82) / 0.18; // 0 to 1 within outro
      const startAmp = 0.35;
      const endAmp = 0.2; // Match intro starting amplitude
      baseAmp = startAmp + (endAmp - startAmp) * outroProgress + seededRandom(seed) * 0.1;
      colorPhase = 0; // Blue like intro
    }

    const height = Math.max(0.08, Math.min(1, baseAmp + seededRandom(seed + 0.5) * 0.1));

    data.push({
      height,
      color: colors[colorPhase],
    });
  }

  return data;
};

// Full-width scrolling DJ waveform background with wave pulse effect
const FullWaveform = ({ width, height }: { width: number; height: number }) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const wavePulseAnim = useRef(new Animated.Value(0)).current;

  // Generate waveform data once (150 bars for full coverage)
  const waveformData = useRef(generateWaveformData(150)).current;

  useEffect(() => {
    // Scroll at 128 BPM tempo feel - energetic pace
    Animated.loop(
      Animated.timing(scrollAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Wave pulse effect - once every 10 seconds, 4 second duration
    // Creates a breathing/wave effect that moves through the waveform
    Animated.loop(
      Animated.sequence([
        // Wait 6 seconds before pulse
        Animated.delay(6000),
        // Pulse down (compress) over 2 seconds
        Animated.timing(wavePulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        // Pulse back up (expand) over 2 seconds
        Animated.timing(wavePulseAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Each bar is 3px wide + 0.5px margin on each side = 4px total
  const barWidth = 4;
  const singleSetWidth = waveformData.length * barWidth;

  // Scroll exactly one full set width for seamless loop
  const translateX = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -singleSetWidth],
  });

  // Wave pulse creates a vertical scale effect - bars shrink then grow
  const scaleY = wavePulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.7, 1], // Compress to 70% at peak, then back
  });

  // Slight vertical movement during pulse
  const translateY = wavePulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 4, 0], // Move down slightly during compression
  });

  return (
    <View style={[styles.fullWaveformContainer, { width, height }]}>
      <Animated.View
        style={[
          styles.waveformBars,
          {
            transform: [{ translateX }, { scaleY }, { translateY }],
          },
        ]}
      >
        {/* Render waveform twice for seamless loop */}
        {[...waveformData, ...waveformData].map((bar, i) => (
          <View
            key={i}
            style={[
              styles.waveformBar,
              {
                height: height * bar.height,
                backgroundColor: bar.color,
              },
            ]}
          />
        ))}
      </Animated.View>
    </View>
  );
};

// Spinning D that rotates like a vinyl every 10 seconds with tiny needle
const VinylD = ({ fontSize = 56 }: { fontSize?: number }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Spin once every 10 seconds
    const spinSequence = () => {
      Animated.sequence([
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 4000, // 4 second spin
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(6000), // Wait 6 seconds (total 10s cycle)
        Animated.timing(spinAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]).start(() => spinSequence());
    };

    spinSequence();
  }, []);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'], // Clockwise
  });

  const needleSize = fontSize * 0.12;
  const needleArmLength = fontSize * 0.18;

  return (
    <View style={styles.vinylDContainer}>
      <Animated.Text
        style={[
          styles.vinylD,
          {
            fontSize,
            lineHeight: fontSize,
            transform: [{ rotate: rotation }],
          },
        ]}
      >
        D
      </Animated.Text>
      {/* Tiny vinyl needle/tonearm in center */}
      <View style={[styles.needleContainer, { width: fontSize, height: fontSize }]}>
        {/* Needle arm */}
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
        {/* Needle head/cartridge */}
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

// Waveform speed calculation: 150 bars * 4px = 600px in 8000ms = 0.075 px/ms
const WAVEFORM_SPEED = 600 / 8000; // px per ms

export default function IddLogo({ size = 'medium', showTagline = false }: IddLogoProps) {
  const textSlideAnim = useRef(new Animated.Value(0)).current;
  const textPulseAnim = useRef(new Animated.Value(1)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const jumpAnim = useRef(new Animated.Value(0)).current;

  const sizeConfig = {
    small: { fontSize: 42, spacing: 2, waveHeight: 70 },
    medium: { fontSize: 56, spacing: 3, waveHeight: 90 },
    large: { fontSize: 72, spacing: 4, waveHeight: 110 },
  }[size];

  // Calculate slide duration to match waveform speed exactly
  const slideDuration = SCREEN_WIDTH / WAVEFORM_SPEED; // ~5200ms for 390px screen

  useEffect(() => {
    // Logo animation: scan, pulse, jump onto waveform, ride out, come back from right
    Animated.loop(
      Animated.sequence([
        // Wait 10 seconds
        Animated.delay(10000),
        // Scan effect (slight horizontal shake like scanning for a spot)
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(scanAnim, { toValue: -1, duration: 100, useNativeDriver: true }),
          Animated.timing(scanAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(scanAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        ]),
        // Pulse (found a spot!)
        Animated.sequence([
          Animated.timing(textPulseAnim, {
            toValue: 1.15,
            duration: 150,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(textPulseAnim, {
            toValue: 0.95,
            duration: 150,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(textPulseAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
        // Jump up and land on waveform (quick hop before sticking)
        Animated.sequence([
          Animated.timing(jumpAnim, {
            toValue: 1,
            duration: 150,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(jumpAnim, {
            toValue: 0,
            duration: 100,
            easing: Easing.in(Easing.bounce),
            useNativeDriver: true,
          }),
        ]),
        // Ride out with waveform (at exact waveform speed - linear)
        Animated.timing(textSlideAnim, {
          toValue: 1,
          duration: slideDuration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // Pause off screen
        Animated.delay(1500),
        // Jump to right side (instant)
        Animated.timing(textSlideAnim, {
          toValue: 2,
          duration: 0,
          useNativeDriver: true,
        }),
        // Ride back in from right at exact waveform speed
        Animated.timing(textSlideAnim, {
          toValue: 3,
          duration: slideDuration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // Reset
        Animated.timing(textSlideAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [slideDuration]);

  // Text slides out left, then in from right
  const textTranslateX = textSlideAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, -SCREEN_WIDTH, SCREEN_WIDTH, 0],
  });

  // Scan shake effect
  const scanTranslateX = scanAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-8, 0, 8],
  });

  // Jump effect (hop up before sticking to waveform)
  const jumpTranslateY = jumpAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  return (
    <View style={styles.container}>
      {/* Full-width waveform background */}
      <View style={styles.waveformBackground}>
        <FullWaveform width={SCREEN_WIDTH} height={sizeConfig.waveHeight} />
      </View>

      {/* Logo text on top - animated to scan, pulse, jump, and ride waveform */}
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            transform: [
              { translateX: textTranslateX },
              { translateX: scanTranslateX },
              { translateY: jumpTranslateY },
              { scale: textPulseAnim },
            ],
          },
        ]}
      >
        {/* TRACK' */}
        <Text
          style={[
            styles.logoText,
            {
              fontSize: sizeConfig.fontSize,
              lineHeight: sizeConfig.fontSize,
            }
          ]}
        >
          TRACK'
        </Text>

        {/* Spinning D with vinyl needle */}
        <VinylD fontSize={sizeConfig.fontSize} />
      </Animated.View>

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
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  logoText: {
    fontWeight: '800',
    color: '#FFFFFF', // White text
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    fontFamily: 'System',
  },
  apostrophe: {
    fontWeight: '800',
    color: '#FFFFFF', // White text
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    fontFamily: 'System',
  },
  vinylDContainer: {
    position: 'relative',
  },
  vinylD: {
    fontWeight: '800',
    color: '#FFFFFF', // White text
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
    backgroundColor: Colors.dark.textMuted,
    transform: [{ rotate: '-35deg' }],
  },
  needleHead: {
    position: 'absolute',
    backgroundColor: Colors.dark.primary,
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
