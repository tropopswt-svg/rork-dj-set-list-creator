import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Colors from '@/constants/colors';

// ID'D Logo
// Corner-bracketed [ID] with scrolling DJ waveform + 'D

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

    // Color based on section (like Rekordbox)
    const colors = [
      'rgba(100, 180, 255, 0.9)',  // Blue - intro/outro
      'rgba(255, 150, 200, 0.9)',  // Pink - buildup
      'rgba(255, 100, 80, 0.9)',   // Red/Orange - drop
      'rgba(150, 220, 255, 0.9)',  // Cyan - breakdown
      'rgba(180, 255, 180, 0.9)',  // Green - breakdown 2
    ];

    data.push({
      height,
      color: colors[colorPhase],
    });
  }

  return data;
};

// Curved corner brackets
const CurvedBrackets = ({ width, height, thickness = 2, radius = 12 }: {
  width: number;
  height: number;
  thickness?: number;
  radius?: number;
}) => {
  const bracketColor = Colors.dark.textMuted;
  const arcLength = radius * 1.2;

  return (
    <>
      {/* Top Left */}
      <View
        style={[
          styles.curvedCorner,
          {
            top: 0,
            left: 0,
            width: arcLength,
            height: arcLength,
            borderTopWidth: thickness,
            borderLeftWidth: thickness,
            borderTopLeftRadius: radius,
            borderColor: bracketColor,
          },
        ]}
      />

      {/* Top Right */}
      <View
        style={[
          styles.curvedCorner,
          {
            top: 0,
            right: 0,
            width: arcLength,
            height: arcLength,
            borderTopWidth: thickness,
            borderRightWidth: thickness,
            borderTopRightRadius: radius,
            borderColor: bracketColor,
          },
        ]}
      />

      {/* Bottom Left */}
      <View
        style={[
          styles.curvedCorner,
          {
            bottom: 0,
            left: 0,
            width: arcLength,
            height: arcLength,
            borderBottomWidth: thickness,
            borderLeftWidth: thickness,
            borderBottomLeftRadius: radius,
            borderColor: bracketColor,
          },
        ]}
      />

      {/* Bottom Right */}
      <View
        style={[
          styles.curvedCorner,
          {
            bottom: 0,
            right: 0,
            width: arcLength,
            height: arcLength,
            borderBottomWidth: thickness,
            borderRightWidth: thickness,
            borderBottomRightRadius: radius,
            borderColor: bracketColor,
          },
        ]}
      />
    </>
  );
};

// Scrolling DJ waveform
const DJWaveform = ({ width, height }: { width: number; height: number }) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;

  // Generate waveform data once
  const waveformData = useRef(generateWaveformData(200)).current;

  useEffect(() => {
    // Continuous slow scroll
    Animated.loop(
      Animated.timing(scrollAnim, {
        toValue: 1,
        duration: 20000, // Very slow - 20 seconds for full scroll
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const totalWidth = waveformData.length * 3; // Each bar is 2px + 1px gap

  const translateX = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -totalWidth / 2],
  });

  return (
    <View style={[styles.waveformContainer, { width, height, overflow: 'hidden' }]}>
      <Animated.View
        style={[
          styles.waveformBars,
          {
            transform: [{ translateX }],
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

// The scanned [ID] with curved brackets, waveform, and pulse animation
const ScannedID = ({ fontSize = 56 }: { fontSize?: number }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // Pulsing scale animation - like scanning/identifying
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(1500),
      ])
    ).start();

    // Glow animation synced with pulse - more opaque
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.85,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.5,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(1500),
      ])
    ).start();
  }, []);

  const containerWidth = fontSize * 1.6;
  const containerHeight = fontSize * 1.1;
  const bracketRadius = fontSize * 0.18;
  const bracketThickness = 2;

  return (
    <Animated.View
      style={[
        styles.scannedContainer,
        {
          width: containerWidth,
          height: containerHeight,
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      {/* Glow effect behind */}
      <Animated.View
        style={[
          styles.scanGlow,
          {
            width: containerWidth * 0.9,
            height: containerHeight * 0.8,
            borderRadius: bracketRadius,
            opacity: glowAnim,
          },
        ]}
      />

      {/* Curved corner brackets */}
      <CurvedBrackets
        width={containerWidth}
        height={containerHeight}
        thickness={bracketThickness}
        radius={bracketRadius}
      />

      {/* Waveform behind text */}
      <View style={styles.waveformWrapper}>
        <DJWaveform width={containerWidth * 0.85} height={fontSize * 0.7} />
      </View>

      {/* ID text on top */}
      <Text style={[styles.idText, { fontSize }]}>ID</Text>
    </Animated.View>
  );
};

// Spinning D that rotates like a vinyl every 10 seconds
const VinylD = ({ fontSize = 56 }: { fontSize?: number }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Spin once every 10 seconds
    const spinSequence = () => {
      Animated.sequence([
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000, // 2 second spin
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(8000), // Wait 8 seconds (total 10s cycle)
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

  return (
    <Animated.Text
      style={[
        styles.vinylD,
        {
          fontSize,
          transform: [{ rotate: rotation }],
        },
      ]}
    >
      D
    </Animated.Text>
  );
};

export default function IddLogo({ size = 'medium', showTagline = false }: IddLogoProps) {
  const sizeConfig = {
    small: { fontSize: 42, spacing: 2 },
    medium: { fontSize: 56, spacing: 3 },
    large: { fontSize: 72, spacing: 4 },
  }[size];

  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        {/* Scanned [ID] with waveform */}
        <ScannedID fontSize={sizeConfig.fontSize} />

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

        {/* Spinning D */}
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
  scannedContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  curvedCorner: {
    position: 'absolute',
    borderColor: 'transparent',
  },
  scanGlow: {
    position: 'absolute',
    backgroundColor: Colors.dark.primary,
  },
  waveformWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
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
    width: 2,
    marginHorizontal: 0.5,
    borderRadius: 1,
  },
  idText: {
    fontWeight: '900',
    color: Colors.dark.text,
    letterSpacing: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  apostrophe: {
    fontWeight: '900',
    color: Colors.dark.text,
  },
  vinylD: {
    fontWeight: '900',
    color: Colors.dark.text,
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
