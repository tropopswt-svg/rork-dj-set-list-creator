import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// TRACK'D Logo with spinning vinyl grooves inside the C and tonearm needle

interface TrackdLogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
}

// The letter C that spins like a vinyl record - spins once, then waits
const VinylC = ({
  size = 28,
}: {
  size?: number;
}) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Spin once slowly, wait 5 seconds, repeat
    const spinSequence = () => {
      Animated.sequence([
        // Spin one full rotation slowly (like a vinyl)
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2500, // Slow vinyl spin
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // Wait 5 seconds
        Animated.delay(5000),
        // Reset instantly
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
    outputRange: ['0deg', '360deg'],
  });

  const fontSize = size * 0.85;
  const centerSize = size * 0.32; // Vinyl center label size
  const needleSize = size * 0.12;
  const needleArmLength = size * 0.18;

  return (
    <View style={[styles.vinylCContainer, { width: size, height: size }]}>
      {/* The spinning C */}
      <Animated.Text
        style={[
          styles.letterC,
          {
            fontSize,
            lineHeight: size,
            transform: [{ rotate: rotation }],
          },
        ]}
      >
        C
      </Animated.Text>
      {/* Vinyl center label */}
      <View style={[styles.vinylCenter, { width: centerSize, height: centerSize, borderRadius: centerSize / 2 }]}>
        <View style={[styles.vinylCenterDot, { width: centerSize * 0.3, height: centerSize * 0.3, borderRadius: centerSize * 0.15 }]} />
      </View>
      {/* Vinyl needle */}
      <View style={[styles.needleContainer, { width: size, height: size }]}>
        <View
          style={[
            styles.needleArm,
            {
              width: needleArmLength,
              height: 2,
              top: size * 0.48,
              left: size * 0.35,
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
              top: size * 0.44,
              left: size * 0.32,
            },
          ]}
        />
      </View>
    </View>
  );
};

// Animated waveform that runs continuously
const WaveformUnderlay = ({ width = 200, height = 12 }: { width?: number; height?: number }) => {
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Continuous scrolling waveform
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 8000, // Slow continuous scroll
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 0.3, width * 0.1],
  });

  // Generate wave bars - taller
  const barCount = Math.floor(width / 5);
  const bars = Array.from({ length: barCount * 2 }, (_, i) => {
    const progress = i / barCount;
    const waveHeight = Math.sin(progress * Math.PI * 3) * 0.6 + 0.4;
    return { height: waveHeight * height };
  });

  return (
    <View style={[styles.waveformContainer, { width, height, overflow: 'hidden' }]}>
      <Animated.View
        style={[
          styles.waveformBars,
          { transform: [{ translateX }] },
        ]}
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
                backgroundColor: `rgba(196, 30, 58, ${0.08 + (bar.height / height) * 0.1})`,
              },
            ]}
          />
        ))}
      </Animated.View>
    </View>
  );
};

export default function TrackdLogo({ size = 'medium', showTagline = false }: TrackdLogoProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const sizeConfig = {
    small: { fontSize: 28, letterSpacing: 6, vinylSize: 32, waveHeight: 80 },
    medium: { fontSize: 38, letterSpacing: 8, vinylSize: 44, waveHeight: 100 },
    large: { fontSize: 52, letterSpacing: 12, vinylSize: 60, waveHeight: 120 },
  }[size];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 3000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      {/* Waveform underlay - full width, very subtle */}
      <View style={styles.waveformUnderlayWrapper}>
        <WaveformUnderlay width={SCREEN_WIDTH} height={sizeConfig.waveHeight} />
      </View>

      <View style={styles.logoWrapper}>
        {/* TRAC */}
        <Text style={[styles.logoText, { fontSize: sizeConfig.fontSize, letterSpacing: sizeConfig.letterSpacing }]}>
          TRA
        </Text>

        {/* Vinyl C */}
        <VinylC size={sizeConfig.vinylSize} />

        {/* K */}
        <Text style={[styles.logoText, { fontSize: sizeConfig.fontSize, letterSpacing: sizeConfig.letterSpacing }]}>
          K
        </Text>

        {/* 'D */}
        <Text style={[styles.logoTextApostrophe, { fontSize: sizeConfig.fontSize, letterSpacing: sizeConfig.letterSpacing }]}>
          'D
        </Text>
      </View>

      {showTagline && (
        <Text style={styles.tagline}>Every track. Every set.</Text>
      )}
    </Animated.View>
  );
}

// Simple text badge for compact spaces
export function TrackdBadge({ size = 'small' }: { size?: 'small' | 'medium' }) {
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
  },
  waveformUnderlayWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.4,
  },
  waveformContainer: {
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
  logoText: {
    fontWeight: '900',
    color: Colors.dark.text,
  },
  logoTextApostrophe: {
    fontWeight: '900',
    color: Colors.dark.text,
    marginLeft: -2,
  },
  vinylCContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterC: {
    fontWeight: '900',
    color: Colors.dark.text,
  },
  vinylCenter: {
    position: 'absolute',
    backgroundColor: Colors.dark.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylCenterDot: {
    backgroundColor: Colors.dark.background,
  },
  needleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
  },
  needleArm: {
    position: 'absolute',
    backgroundColor: '#6B6B6B', // Grey arm
    transform: [{ rotate: '-35deg' }],
  },
  needleHead: {
    position: 'absolute',
    backgroundColor: '#9E1830', // Dark red cartridge (Circoloco dark)
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
