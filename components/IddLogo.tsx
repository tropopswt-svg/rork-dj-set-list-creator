import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ID'D Logo - Track Identification theme
// The "I" is a glowing scanner beam, scan line sweeps across, radar pulses emanate

interface IddLogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
}

// Glowing "I" that pulses like a scanner
const ScannerI = ({ height = 40 }: { height?: number }) => {
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={[styles.scannerIContainer, { height }]}>
      {/* Glow behind */}
      <Animated.View
        style={[
          styles.scannerGlow,
          {
            height: height * 0.9,
            width: height * 0.25,
            opacity: glowAnim,
          }
        ]}
      />
      {/* The I beam */}
      <View style={[styles.scannerBeam, { height: height * 0.85, width: height * 0.12 }]} />
      {/* Top notch */}
      <View style={[styles.scannerNotch, { top: 0, width: height * 0.3, height: height * 0.08 }]} />
      {/* Bottom notch */}
      <View style={[styles.scannerNotch, { bottom: 0, width: height * 0.3, height: height * 0.08 }]} />
    </View>
  );
};

// Radar rings that pulse outward from the D
const RadarD = ({ size = 40, fontSize = 36 }: { size?: number; fontSize?: number }) => {
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const ring3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createRingAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    Animated.parallel([
      createRingAnimation(ring1Anim, 0),
      createRingAnimation(ring2Anim, 600),
      createRingAnimation(ring3Anim, 1200),
    ]).start();
  }, []);

  const createRingStyle = (anim: Animated.Value, maxSize: number) => ({
    position: 'absolute' as const,
    width: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [size * 0.3, maxSize],
    }),
    height: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [size * 0.3, maxSize],
    }),
    borderRadius: maxSize / 2,
    borderWidth: 1.5,
    borderColor: Colors.dark.primary,
    opacity: anim.interpolate({
      inputRange: [0, 0.3, 1],
      outputRange: [0.6, 0.4, 0],
    }),
  });

  return (
    <View style={[styles.radarDContainer, { width: size, height: size }]}>
      {/* Radar rings */}
      <Animated.View style={createRingStyle(ring1Anim, size * 1.8)} />
      <Animated.View style={createRingStyle(ring2Anim, size * 1.5)} />
      <Animated.View style={createRingStyle(ring3Anim, size * 1.2)} />
      {/* The D letter */}
      <Text style={[styles.radarDText, { fontSize, lineHeight: size }]}>D</Text>
    </View>
  );
};

// Horizontal scan line that sweeps across
const ScanLine = ({ width = 200, height = 60 }: { width?: number; height?: number }) => {
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const scanSequence = () => {
      Animated.sequence([
        Animated.delay(3000),
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]).start(() => scanSequence());
    };

    scanSequence();
  }, []);

  const translateX = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 0.5, width * 1.5],
  });

  const opacity = scanAnim.interpolate({
    inputRange: [0, 0.1, 0.9, 1],
    outputRange: [0, 0.8, 0.8, 0],
  });

  return (
    <Animated.View
      style={[
        styles.scanLine,
        {
          height: height * 1.2,
          transform: [{ translateX }],
          opacity,
        },
      ]}
    >
      {/* Main scan line */}
      <View style={styles.scanLineCore} />
      {/* Glow trail */}
      <View style={styles.scanLineGlow} />
    </Animated.View>
  );
};

// Waveform background
const WaveformBg = ({ width = 200, height = 80 }: { width?: number; height?: number }) => {
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 10000,
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
                backgroundColor: `rgba(226, 29, 72, ${0.03 + (bar.height / height) * 0.06})`,
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
    small: { fontSize: 32, letterSpacing: 4, scannerHeight: 36, radarSize: 38, waveHeight: 70 },
    medium: { fontSize: 44, letterSpacing: 6, scannerHeight: 50, radarSize: 52, waveHeight: 90 },
    large: { fontSize: 60, letterSpacing: 10, scannerHeight: 68, radarSize: 70, waveHeight: 110 },
  }[size];

  return (
    <View style={styles.container}>
      {/* Waveform background - full width, very subtle */}
      <View style={styles.waveformWrapper}>
        <WaveformBg width={SCREEN_WIDTH} height={sizeConfig.waveHeight} />
      </View>

      {/* Scan line overlay */}
      <View style={styles.scanLineWrapper}>
        <ScanLine width={SCREEN_WIDTH * 0.8} height={sizeConfig.scannerHeight} />
      </View>

      <View style={styles.logoWrapper}>
        {/* Scanner I */}
        <ScannerI height={sizeConfig.scannerHeight} />

        {/* First D with radar rings */}
        <View style={styles.firstD}>
          <RadarD size={sizeConfig.radarSize} fontSize={sizeConfig.fontSize} />
        </View>

        {/* Apostrophe */}
        <Text style={[styles.apostrophe, { fontSize: sizeConfig.fontSize * 0.6, marginTop: -sizeConfig.fontSize * 0.3 }]}>
          '
        </Text>

        {/* Second D */}
        <Text style={[styles.letterD, { fontSize: sizeConfig.fontSize, letterSpacing: sizeConfig.letterSpacing }]}>
          D
        </Text>
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
  scanLineWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scanLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanLineCore: {
    width: 3,
    height: '100%',
    backgroundColor: Colors.dark.primary,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  scanLineGlow: {
    width: 20,
    height: '100%',
    marginLeft: -10,
    backgroundColor: 'transparent',
    borderLeftWidth: 15,
    borderLeftColor: 'rgba(226, 29, 72, 0.3)',
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scannerIContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  scannerGlow: {
    position: 'absolute',
    backgroundColor: Colors.dark.primary,
    borderRadius: 4,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  scannerBeam: {
    backgroundColor: Colors.dark.text,
    borderRadius: 2,
  },
  scannerNotch: {
    position: 'absolute',
    backgroundColor: Colors.dark.text,
    borderRadius: 1,
  },
  firstD: {
    marginLeft: -4,
  },
  radarDContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarDText: {
    fontWeight: '900',
    color: Colors.dark.text,
  },
  apostrophe: {
    fontWeight: '900',
    color: Colors.dark.primary,
    marginLeft: -2,
    marginRight: -4,
  },
  letterD: {
    fontWeight: '900',
    color: Colors.dark.text,
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
