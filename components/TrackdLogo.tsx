import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Colors from '@/constants/colors';

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
  const centerSize = size * 0.28; // Vinyl center label size

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
    </View>
  );
};

// Animated waveform that appears every 4-5 seconds
const WaveformUnderlay = ({ width = 200, height = 12 }: { width?: number; height?: number }) => {
  const waveAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Waveform appears every 4-5 seconds, scrolls slowly, then fades
    const waveSequence = () => {
      Animated.sequence([
        // Wait 4-5 seconds before showing
        Animated.delay(4500),
        // Fade in
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // Scroll slowly across
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 3500, // Slower scroll
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // Fade out
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        // Reset position instantly
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]).start(() => waveSequence());
    };

    waveSequence();
  }, []);

  const translateX = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 0.5, width * 0.3],
  });

  // Generate wave bars - taller
  const barCount = Math.floor(width / 5);
  const bars = Array.from({ length: barCount * 2 }, (_, i) => {
    const progress = i / barCount;
    const waveHeight = Math.sin(progress * Math.PI * 3) * 0.6 + 0.4;
    return { height: waveHeight * height };
  });

  return (
    <Animated.View style={[styles.waveformContainer, { width, height, overflow: 'hidden', opacity: opacityAnim }]}>
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
                backgroundColor: `rgba(226, 29, 72, ${0.2 + (bar.height / height) * 0.25})`,
              },
            ]}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
};

export default function TrackdLogo({ size = 'medium', showTagline = false }: TrackdLogoProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const sizeConfig = {
    small: { fontSize: 22, letterSpacing: 3, vinylSize: 24, waveWidth: 140, waveHeight: 10 },
    medium: { fontSize: 30, letterSpacing: 4, vinylSize: 32, waveWidth: 180, waveHeight: 14 },
    large: { fontSize: 40, letterSpacing: 6, vinylSize: 42, waveWidth: 240, waveHeight: 18 },
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
      {/* Waveform underlay - appears every few seconds */}
      <View style={styles.waveformUnderlayWrapper}>
        <WaveformUnderlay width={sizeConfig.waveWidth} height={sizeConfig.waveHeight} />
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
    bottom: '35%',
    opacity: 0.5,
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
