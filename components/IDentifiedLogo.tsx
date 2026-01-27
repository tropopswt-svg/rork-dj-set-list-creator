import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Colors from '@/constants/colors';

// TRACK'D Logo with curved box container and colorful waveform background

interface IDentifiedLogoProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
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
    'rgba(196, 30, 58, 0.5)',     // Circoloco red - lighter (intro/outro)
    'rgba(196, 30, 58, 0.65)',    // Circoloco red - medium (buildup)
    'rgba(196, 30, 58, 0.85)',    // Circoloco red - strong (drop)
    'rgba(180, 25, 50, 0.6)',     // Slightly darker red (breakdown)
    'rgba(220, 40, 70, 0.6)',     // Slightly lighter/brighter red (breakdown 2)
  ];

  for (let i = 0; i < count; i++) {
    const progress = i / count;
    const seed = i * 1.337;

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
      const outroProgress = (progress - 0.82) / 0.18;
      const startAmp = 0.35;
      const endAmp = 0.2;
      baseAmp = startAmp + (endAmp - startAmp) * outroProgress + seededRandom(seed) * 0.1;
      colorPhase = 0;
    }

    const height = Math.max(0.08, Math.min(1, baseAmp + seededRandom(seed + 0.5) * 0.1));

    data.push({
      height,
      color: colors[colorPhase],
    });
  }

  return data;
};

// Waveform constants for speed calculation
const BAR_WIDTH = 2.6; // 2px bar + 0.3px margin each side
const BAR_COUNT = 80;
const SINGLE_SET_WIDTH = BAR_COUNT * BAR_WIDTH; // 208px
const WAVEFORM_DURATION = 8000; // 8 seconds for one loop
const WAVEFORM_SPEED = SINGLE_SET_WIDTH / WAVEFORM_DURATION; // 0.026 px/ms

export default function IDentifiedLogo({ size = 'medium' }: IDentifiedLogoProps) {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const textSlideAnim = useRef(new Animated.Value(0)).current;
  const textPulseAnim = useRef(new Animated.Value(1)).current;
  const jumpAnim = useRef(new Animated.Value(0)).current;
  const waveformData = useRef(generateWaveformData(BAR_COUNT)).current;

  // Compact box that tightly encapsulates the TRACK'D letters
  const sizeConfig = {
    small: { fontSize: 14, waveHeight: 28, boxWidth: 80, boxHeight: 28, borderRadius: 8 },
    medium: { fontSize: 18, waveHeight: 36, boxWidth: 105, boxHeight: 36, borderRadius: 10 },
    large: { fontSize: 24, waveHeight: 46, boxWidth: 140, boxHeight: 46, borderRadius: 12 },
    xlarge: { fontSize: 34, waveHeight: 68, boxWidth: 200, boxHeight: 68, borderRadius: 16 },
  }[size];

  // Calculate text slide duration to match waveform speed exactly
  const slideDistance = sizeConfig.boxWidth * 1.5;
  const slideDuration = slideDistance / WAVEFORM_SPEED; // ms to match waveform speed

  useEffect(() => {
    // Scrolling waveform - continuous loop
    const scrollAnimation = Animated.loop(
      Animated.timing(scrollAnim, {
        toValue: 1,
        duration: WAVEFORM_DURATION,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    scrollAnimation.start();

    // Waveform pulse effect every 10 seconds
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(6000),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    // Text animation: pulse, jump, ride waveform out, come back in from right
    const textAnimation = Animated.loop(
      Animated.sequence([
        // Wait 12 seconds
        Animated.delay(12000),
        // Pulse the text (warning it's about to stick)
        Animated.sequence([
          Animated.timing(textPulseAnim, {
            toValue: 1.2,
            duration: 120,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(textPulseAnim, {
            toValue: 0.9,
            duration: 120,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(textPulseAnim, {
            toValue: 1,
            duration: 80,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        // Jump up and land on waveform
        Animated.sequence([
          Animated.timing(jumpAnim, {
            toValue: 1,
            duration: 120,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(jumpAnim, {
            toValue: 0,
            duration: 80,
            easing: Easing.in(Easing.bounce),
            useNativeDriver: true,
          }),
        ]),
        // Slide out with waveform at exact waveform speed
        Animated.timing(textSlideAnim, {
          toValue: 1,
          duration: slideDuration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // Brief pause while off screen
        Animated.delay(1200),
        // Jump to right side (instant)
        Animated.timing(textSlideAnim, {
          toValue: 2,
          duration: 0,
          useNativeDriver: true,
        }),
        // Ride in from right at exact waveform speed
        Animated.timing(textSlideAnim, {
          toValue: 3,
          duration: slideDuration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // Reset for next cycle
        Animated.timing(textSlideAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    textAnimation.start();

    // Cleanup
    return () => {
      scrollAnimation.stop();
      pulseAnimation.stop();
      textAnimation.stop();
    };
  }, [slideDuration]);

  // Scroll exactly one full set width for seamless loop
  const translateX = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -SINGLE_SET_WIDTH],
  });

  const scaleY = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.75, 1],
  });

  // Jump effect
  const jumpTranslateY = jumpAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  // Text rides waveform out left, then comes in from right
  const textTranslateX = textSlideAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [
      0,                              // Centered
      -sizeConfig.boxWidth * 1.5,     // Off screen left (rode out)
      sizeConfig.boxWidth * 1.5,      // Jump to right side
      0,                              // Ride back to center
    ],
  });

  return (
    <View
      style={[
        styles.boxContainer,
        {
          width: sizeConfig.boxWidth,
          height: sizeConfig.boxHeight,
          borderRadius: sizeConfig.borderRadius,
        },
      ]}
    >
      {/* Waveform background - clipped to box */}
      <View style={[styles.waveformContainer, { height: sizeConfig.waveHeight }]}>
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
                {
                  height: sizeConfig.waveHeight * bar.height,
                  backgroundColor: bar.color,
                },
              ]}
            />
          ))}
        </Animated.View>
      </View>

      {/* Red tint overlay for cool effect */}
      <View style={[styles.tintOverlay, { borderRadius: sizeConfig.borderRadius }]} />

      {/* TRACK'D text on top - animated to jump, stick and slide */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            transform: [
              { translateX: textTranslateX },
              { translateY: jumpTranslateY },
              { scale: textPulseAnim },
            ],
          },
        ]}
      >
        <Text style={[styles.logoText, { fontSize: sizeConfig.fontSize }]}>TRACK'D</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  boxContainer: {
    backgroundColor: '#FFFFFF', // Clean white background
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)', // Subtle border
  },
  waveformContainer: {
    position: 'absolute',
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waveformBar: {
    width: 2,
    marginHorizontal: 0.3,
    borderRadius: 1,
  },
  tintOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Very subtle overlay
  },
  textContainer: {
    zIndex: 2,
  },
  logoText: {
    fontWeight: '900',
    color: '#FFFFFF', // White text
    letterSpacing: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.6)', // Shadow for visibility on white/red
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    fontFamily: 'AvenirNextCondensed-Heavy', // Pioneer DJ style condensed geometric font
  },
});
