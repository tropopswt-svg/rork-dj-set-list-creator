import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Colors from '@/constants/colors';

// TRACK'D Logo with spinning vinyl record 'C'

interface TrackdLogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
}

// Vinyl Record C - The C is shaped like a record with spinning grooves inside
const VinylC = ({
  size = 24,
  grooveColor = Colors.dark.primary,
  labelColor = Colors.dark.primary,
}: {
  size?: number;
  grooveColor?: string;
  labelColor?: string;
}) => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Continuous spin at 33 1/3 RPM feel (slower, vinyl-like)
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 3000, // Full rotation in 3 seconds
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Subtle pulse on the label
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const grooveCount = Math.floor(size / 4);
  const centerSize = size * 0.25;
  const grooveSpacing = (size / 2 - centerSize / 2) / grooveCount;

  return (
    <View style={[styles.vinylContainer, { width: size, height: size }]}>
      {/* The vinyl record base - dark background */}
      <View style={[styles.vinylBase, {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#0a0a0a',
      }]}>

        {/* Spinning grooves layer */}
        <Animated.View style={[
          styles.groovesContainer,
          {
            width: size,
            height: size,
            transform: [{ rotate: rotation }],
          }
        ]}>
          {/* Concentric groove circles */}
          {Array.from({ length: grooveCount }, (_, i) => {
            const grooveSize = size - (i * grooveSpacing * 2);
            const opacity = 0.15 + (i / grooveCount) * 0.25;
            return (
              <View
                key={i}
                style={[
                  styles.groove,
                  {
                    width: grooveSize,
                    height: grooveSize,
                    borderRadius: grooveSize / 2,
                    borderColor: grooveColor,
                    borderWidth: 0.5,
                    opacity,
                    position: 'absolute',
                    left: (size - grooveSize) / 2,
                    top: (size - grooveSize) / 2,
                  },
                ]}
              />
            );
          })}

          {/* Vinyl shine/reflection effect */}
          <View style={[styles.vinylShine, {
            width: size * 0.6,
            height: size * 0.15,
            top: size * 0.15,
            left: size * 0.1,
            transform: [{ rotate: '-30deg' }],
          }]} />
        </Animated.View>

        {/* Center label (stationary) */}
        <Animated.View style={[
          styles.centerLabel,
          {
            width: centerSize,
            height: centerSize,
            borderRadius: centerSize / 2,
            backgroundColor: labelColor,
            transform: [{ scale: pulseAnim }],
          }
        ]}>
          {/* Spindle hole */}
          <View style={[styles.spindleHole, {
            width: centerSize * 0.2,
            height: centerSize * 0.2,
            borderRadius: centerSize * 0.1,
          }]} />
        </Animated.View>
      </View>

      {/* C-shape mask - creates the "C" by masking part of the record */}
      <View style={[styles.cMask, {
        width: size * 0.35,
        height: size * 0.45,
        right: -size * 0.05,
        top: size * 0.275,
        backgroundColor: Colors.dark.background,
      }]} />
    </View>
  );
};

export default function TrackdLogo({ size = 'medium', showTagline = false }: TrackdLogoProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const sizeConfig = {
    small: { fontSize: 20, vinylSize: 22, letterSpacing: -1 },
    medium: { fontSize: 26, vinylSize: 28, letterSpacing: -1.5 },
    large: { fontSize: 34, vinylSize: 36, letterSpacing: -2 },
  }[size];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.01, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.logoWrapper}>
        {/* TRA */}
        <Text style={[styles.logoText, { fontSize: sizeConfig.fontSize, letterSpacing: sizeConfig.letterSpacing }]}>
          TRA
        </Text>

        {/* Vinyl C */}
        <View style={styles.vinylCWrapper}>
          <VinylC size={sizeConfig.vinylSize} />
        </View>

        {/* K'D */}
        <Text style={[styles.logoText, { fontSize: sizeConfig.fontSize, letterSpacing: sizeConfig.letterSpacing }]}>
          K'D
        </Text>
      </View>

      {showTagline && (
        <Text style={styles.tagline}>Every track. Every set. Identified.</Text>
      )}
    </Animated.View>
  );
}

// Also export a simple text version for badges/small spaces
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
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontWeight: '900',
    color: Colors.dark.text,
    letterSpacing: -1,
  },
  vinylCWrapper: {
    marginHorizontal: -2,
  },
  vinylContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  vinylBase: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  groovesContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groove: {
    backgroundColor: 'transparent',
  },
  vinylShine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 50,
  },
  centerLabel: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  spindleHole: {
    backgroundColor: '#0a0a0a',
  },
  cMask: {
    position: 'absolute',
  },
  tagline: {
    marginTop: 8,
    fontSize: 11,
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});
