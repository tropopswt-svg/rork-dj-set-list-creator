import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ID'D Logo
// [ID] with scanner waveform + 'D where D is filled with spinning vinyl grooves

interface IddLogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
}

// [ID] with scanning waveform effect
const BracketedID = ({ fontSize = 56 }: { fontSize?: number }) => {
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Scanning waveform sweeps across
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(3000),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const containerWidth = fontSize * 1.8;

  const translateX = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-containerWidth * 0.3, containerWidth * 1.1],
  });

  const opacity = scanAnim.interpolate({
    inputRange: [0, 0.1, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <View style={[styles.bracketedContainer, { height: fontSize * 1.1 }]}>
      {/* Left bracket */}
      <Text style={[styles.bracket, { fontSize }]}>[</Text>

      {/* ID text with scanner overlay */}
      <View style={[styles.idContainer, { width: containerWidth, overflow: 'hidden' }]}>
        <Text style={[styles.idText, { fontSize }]}>ID</Text>

        {/* Scanning waveform line */}
        <Animated.View
          style={[
            styles.scanLine,
            {
              height: fontSize * 0.9,
              transform: [{ translateX }],
              opacity,
            },
          ]}
        >
          {/* Waveform bars */}
          {Array.from({ length: 8 }, (_, i) => {
            const h = Math.sin((i / 8) * Math.PI) * 0.7 + 0.3;
            return (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: fontSize * 0.8 * h,
                    backgroundColor: Colors.dark.primary,
                  },
                ]}
              />
            );
          })}
        </Animated.View>
      </View>

      {/* Right bracket */}
      <Text style={[styles.bracket, { fontSize }]}>]</Text>
    </View>
  );
};

// Vinyl D - the D shape filled with spinning vinyl grooves
const VinylD = ({ fontSize = 56 }: { fontSize?: number }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Continuous vinyl spin
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const dWidth = fontSize * 0.75;
  const dHeight = fontSize;
  const vinylSize = fontSize * 1.4; // Vinyl larger than D to ensure coverage

  return (
    <View style={[styles.vinylDWrapper, { width: dWidth, height: dHeight }]}>
      {/* The D-shaped mask container */}
      <View style={[styles.vinylDMask, { width: dWidth, height: dHeight }]}>
        {/* Spinning vinyl underneath */}
        <Animated.View
          style={[
            styles.vinylDisc,
            {
              width: vinylSize,
              height: vinylSize,
              borderRadius: vinylSize / 2,
              transform: [{ rotate: rotation }],
            },
          ]}
        >
          {/* Vinyl grooves - concentric rings */}
          {Array.from({ length: 12 }, (_, i) => {
            const ringSize = vinylSize * (1 - i * 0.07);
            return (
              <View
                key={i}
                style={[
                  styles.vinylGroove,
                  {
                    width: ringSize,
                    height: ringSize,
                    borderRadius: ringSize / 2,
                    borderWidth: i % 2 === 0 ? 1.5 : 0.5,
                    borderColor: i % 3 === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  },
                ]}
              />
            );
          })}
          {/* Center label */}
          <View
            style={[
              styles.vinylLabel,
              {
                width: vinylSize * 0.25,
                height: vinylSize * 0.25,
                borderRadius: vinylSize * 0.125,
              },
            ]}
          />
          {/* Center hole */}
          <View
            style={[
              styles.vinylHole,
              {
                width: vinylSize * 0.06,
                height: vinylSize * 0.06,
                borderRadius: vinylSize * 0.03,
              },
            ]}
          />
        </Animated.View>
      </View>

      {/* D letter outline on top - acts as the "cookie cutter" mask */}
      <View style={[styles.dOverlay, { width: dWidth, height: dHeight }]}>
        {/* Left side cutout (the inside of D) */}
        <View
          style={[
            styles.dCutout,
            {
              width: dWidth * 0.35,
              height: dHeight * 0.5,
              borderTopRightRadius: dHeight * 0.25,
              borderBottomRightRadius: dHeight * 0.25,
              left: dWidth * 0.22,
            },
          ]}
        />
        {/* Top cutout */}
        <View
          style={[
            styles.dCutoutTop,
            {
              width: dWidth,
              height: dHeight * 0.12,
              top: 0,
            },
          ]}
        />
        {/* Bottom cutout */}
        <View
          style={[
            styles.dCutoutTop,
            {
              width: dWidth,
              height: dHeight * 0.12,
              bottom: 0,
            },
          ]}
        />
        {/* Right side - round off */}
        <View
          style={[
            styles.dCutoutRight,
            {
              width: dWidth * 0.15,
              height: dHeight,
              right: 0,
              borderTopLeftRadius: dHeight * 0.5,
              borderBottomLeftRadius: dHeight * 0.5,
            },
          ]}
        />
      </View>
    </View>
  );
};

export default function IddLogo({ size = 'medium', showTagline = false }: IddLogoProps) {
  const sizeConfig = {
    small: { fontSize: 42, spacing: 4 },
    medium: { fontSize: 56, spacing: 6 },
    large: { fontSize: 72, spacing: 8 },
  }[size];

  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        {/* [ID] with scanner */}
        <BracketedID fontSize={sizeConfig.fontSize} />

        {/* Apostrophe */}
        <Text
          style={[
            styles.apostrophe,
            {
              fontSize: sizeConfig.fontSize,
              marginLeft: sizeConfig.spacing,
            }
          ]}
        >
          '
        </Text>

        {/* Vinyl D */}
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
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bracketedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bracket: {
    fontWeight: '300',
    color: Colors.dark.textMuted,
  },
  idContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  idText: {
    fontWeight: '900',
    color: Colors.dark.text,
    letterSpacing: 2,
  },
  scanLine: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  apostrophe: {
    fontWeight: '900',
    color: Colors.dark.text,
  },
  vinylDWrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  vinylDMask: {
    position: 'absolute',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylDisc: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
  },
  vinylGroove: {
    position: 'absolute',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  vinylLabel: {
    position: 'absolute',
    backgroundColor: Colors.dark.primary,
  },
  vinylHole: {
    position: 'absolute',
    backgroundColor: Colors.dark.background,
  },
  dOverlay: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  dCutout: {
    position: 'absolute',
    backgroundColor: Colors.dark.background,
    top: '25%',
  },
  dCutoutTop: {
    position: 'absolute',
    backgroundColor: Colors.dark.background,
    left: 0,
  },
  dCutoutRight: {
    position: 'absolute',
    backgroundColor: Colors.dark.background,
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
