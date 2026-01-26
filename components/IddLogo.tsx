import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ID'D Logo - Clean, simple, recognizable
// All letters same size, subtle animation on apostrophe and final D

interface IddLogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
}

// Pulsing apostrophe - like a heartbeat/detection indicator
const PulsingApostrophe = ({ fontSize = 44 }: { fontSize?: number }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    // Subtle pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(2000),
      ])
    ).start();

    // Glow synced with pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.7,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.2,
          duration: 600,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(2000),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.apostropheContainer}>
      {/* Glow behind */}
      <Animated.View
        style={[
          styles.apostropheGlow,
          {
            width: fontSize * 0.5,
            height: fontSize * 0.5,
            borderRadius: fontSize * 0.25,
            opacity: glowAnim,
          },
        ]}
      />
      <Animated.Text
        style={[
          styles.apostrophe,
          {
            fontSize,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        '
      </Animated.Text>
    </View>
  );
};

// Final D with spinning vinyl center inside the bowl
const VinylD = ({ fontSize = 44 }: { fontSize?: number }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Continuous slow spin
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const centerSize = fontSize * 0.3;

  return (
    <View style={[styles.vinylDContainer, { height: fontSize }]}>
      <Text style={[styles.letter, { fontSize }]}>D</Text>
      {/* Vinyl center positioned in the D's bowl */}
      <Animated.View
        style={[
          styles.vinylCenter,
          {
            width: centerSize,
            height: centerSize,
            borderRadius: centerSize / 2,
            right: fontSize * 0.15,
            transform: [{ rotate: rotation }],
          },
        ]}
      >
        <View
          style={[
            styles.vinylDot,
            {
              width: centerSize * 0.3,
              height: centerSize * 0.3,
              borderRadius: centerSize * 0.15,
            },
          ]}
        />
        {/* Groove lines */}
        <View style={[styles.vinylGroove, { width: centerSize * 0.8, height: 1 }]} />
        <View style={[styles.vinylGroove, { width: 1, height: centerSize * 0.8 }]} />
      </Animated.View>
    </View>
  );
};

// Waveform background - subtle, full width, full height
const WaveformBg = ({ width = 200, height = 80 }: { width?: number; height?: number }) => {
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 15000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -width * 0.5],
  });

  const barCount = Math.floor(width / 4);
  const bars = Array.from({ length: barCount * 2 }, (_, i) => {
    const progress = i / barCount;
    const waveHeight = Math.sin(progress * Math.PI * 4) * 0.5 + 0.5;
    return { height: waveHeight * height };
  });

  return (
    <View style={[styles.waveformBg, { width, height, overflow: 'hidden' }]}>
      <Animated.View
        style={[styles.waveformBars, { transform: [{ translateX }] }]}
      >
        {bars.map((bar, i) => (
          <View
            key={i}
            style={[
              styles.waveformBar,
              {
                height: bar.height,
                width: 2,
                marginHorizontal: 1,
                backgroundColor: `rgba(226, 29, 72, ${0.015 + (bar.height / height) * 0.03})`,
              },
            ]}
          />
        ))}
      </Animated.View>
    </View>
  );
};

export default function IddLogo({ size = 'medium', showTagline = false }: IddLogoProps) {
  const sizeConfig = {
    small: { fontSize: 36, letterSpacing: 5, waveHeight: 70 },
    medium: { fontSize: 48, letterSpacing: 7, waveHeight: 90 },
    large: { fontSize: 64, letterSpacing: 10, waveHeight: 110 },
  }[size];

  return (
    <View style={styles.container}>
      {/* Waveform background */}
      <View style={styles.waveformWrapper}>
        <WaveformBg width={SCREEN_WIDTH} height={sizeConfig.waveHeight} />
      </View>

      <View style={styles.logoWrapper}>
        {/* I */}
        <Text style={[styles.letter, { fontSize: sizeConfig.fontSize, marginRight: sizeConfig.letterSpacing }]}>
          I
        </Text>

        {/* D */}
        <Text style={[styles.letter, { fontSize: sizeConfig.fontSize, marginRight: sizeConfig.letterSpacing * 0.3 }]}>
          D
        </Text>

        {/* Pulsing apostrophe */}
        <PulsingApostrophe fontSize={sizeConfig.fontSize} />

        {/* Final D with vinyl */}
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
  },
  waveformWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  waveformBg: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waveformBar: {
    borderRadius: 1,
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  letter: {
    fontWeight: '900',
    color: Colors.dark.text,
  },
  apostropheContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -8,
  },
  apostropheGlow: {
    position: 'absolute',
    backgroundColor: Colors.dark.primary,
  },
  apostrophe: {
    fontWeight: '900',
    color: Colors.dark.primary,
  },
  vinylDContainer: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  vinylCenter: {
    position: 'absolute',
    backgroundColor: Colors.dark.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylDot: {
    backgroundColor: Colors.dark.background,
  },
  vinylGroove: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  tagline: {
    marginTop: 8,
    fontSize: 11,
    color: Colors.dark.textMuted,
    letterSpacing: 1,
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
