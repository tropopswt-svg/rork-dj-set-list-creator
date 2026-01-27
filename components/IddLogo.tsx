import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ID'D Logo
// Clean ID'D text with spinning vinyl D and full-width waveform background

interface IddLogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
}

// Generate realistic waveform data - mimics actual track dynamics
const generateWaveformData = (count: number) => {
  const data: { height: number; color: string }[] = [];

  // Simulate a real track with intro, buildup, drop, breakdown, outro
  for (let i = 0; i < count; i++) {
    const progress = i / count;

    // Base amplitude varies by "section" of the track
    let baseAmp = 0.3;
    let colorPhase = 0;

    // Intro (quiet)
    if (progress < 0.1) {
      baseAmp = 0.15 + Math.random() * 0.15;
      colorPhase = 0;
    }
    // Buildup
    else if (progress < 0.2) {
      baseAmp = 0.3 + (progress - 0.1) * 4 + Math.random() * 0.2;
      colorPhase = 1;
    }
    // Drop (loud)
    else if (progress < 0.35) {
      baseAmp = 0.7 + Math.random() * 0.3;
      colorPhase = 2;
    }
    // Breakdown (quieter)
    else if (progress < 0.45) {
      baseAmp = 0.25 + Math.random() * 0.2;
      colorPhase = 3;
    }
    // Buildup 2
    else if (progress < 0.55) {
      baseAmp = 0.35 + (progress - 0.45) * 5 + Math.random() * 0.2;
      colorPhase = 1;
    }
    // Drop 2 (loud)
    else if (progress < 0.75) {
      baseAmp = 0.75 + Math.random() * 0.25;
      colorPhase = 2;
    }
    // Breakdown 2
    else if (progress < 0.85) {
      baseAmp = 0.3 + Math.random() * 0.25;
      colorPhase = 4;
    }
    // Outro (fading)
    else {
      baseAmp = 0.4 - (progress - 0.85) * 2 + Math.random() * 0.15;
      colorPhase = 0;
    }

    // Add some randomness for realism
    const height = Math.max(0.08, Math.min(1, baseAmp + (Math.random() - 0.5) * 0.15));

    // Color based on section (like Rekordbox) - muted/subtle opacity
    const colors = [
      'rgba(100, 180, 255, 0.5)',    // Blue - intro/outro
      'rgba(255, 150, 200, 0.5)',    // Pink - buildup
      'rgba(255, 100, 80, 0.5)',     // Red/Orange - drop
      'rgba(150, 220, 255, 0.5)',    // Cyan - breakdown
      'rgba(180, 255, 180, 0.5)',    // Green - breakdown 2
    ];

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

  const totalWidth = waveformData.length * 4; // Each bar is 3px + 1px gap

  const translateX = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -totalWidth / 2],
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

export default function IddLogo({ size = 'medium', showTagline = false }: IddLogoProps) {
  const sizeConfig = {
    small: { fontSize: 42, spacing: 2, waveHeight: 70 },
    medium: { fontSize: 56, spacing: 3, waveHeight: 90 },
    large: { fontSize: 72, spacing: 4, waveHeight: 110 },
  }[size];

  return (
    <View style={styles.container}>
      {/* Full-width waveform background */}
      <View style={styles.waveformBackground}>
        <FullWaveform width={SCREEN_WIDTH} height={sizeConfig.waveHeight} />
      </View>

      {/* Logo text on top */}
      <View style={styles.logoWrapper}>
        {/* ID */}
        <Text
          style={[
            styles.logoText,
            {
              fontSize: sizeConfig.fontSize,
              lineHeight: sizeConfig.fontSize,
            }
          ]}
        >
          ID
        </Text>

        {/* Apostrophe */}
        <Text
          style={[
            styles.apostrophe,
            {
              fontSize: sizeConfig.fontSize,
              lineHeight: sizeConfig.fontSize,
              marginLeft: sizeConfig.spacing,
            }
          ]}
        >
          '
        </Text>

        {/* Spinning D with vinyl needle */}
        <VinylD fontSize={sizeConfig.fontSize} />
      </View>

      {showTagline && (
        <Text style={styles.tagline}>Every track. Identified.</Text>
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
      <Text style={[styles.badgeText, { fontSize: sizeConfig.fontSize }]}>ID'D</Text>
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
    fontWeight: '900',
    color: Colors.dark.text,
    letterSpacing: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  apostrophe: {
    fontWeight: '900',
    color: Colors.dark.text,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  vinylDContainer: {
    position: 'relative',
  },
  vinylD: {
    fontWeight: '900',
    color: Colors.dark.text,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
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
