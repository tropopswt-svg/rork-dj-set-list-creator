import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Colors from '@/constants/colors';

// IDentified Logo with animated waveform at 128 BPM

interface IDentifiedLogoProps {
  size?: 'small' | 'medium' | 'large';
}

// Generate waveform bars
const generateBars = (width: number, height: number, barCount: number) => {
  const barWidth = Math.max(2, (width - (barCount - 1) * 1.5) / barCount);
  const totalBars = barCount * 3;
  return Array.from({ length: totalBars }, (_, i) => {
    const noise1 = Math.sin(i * 0.8) * 0.3;
    const noise2 = Math.sin(i * 1.7) * 0.2;
    const noise3 = Math.sin(i * 0.3) * 0.25;
    const baseHeight = 0.35 + Math.abs(noise1 + noise2 + noise3);
    return {
      width: barWidth,
      height: Math.min(1, baseHeight) * height,
    };
  });
};

// Animated Waveform Component
const AnimatedWaveform = ({
  width = 60,
  height = 24,
  barCount = 12,
  color = Colors.dark.primary,
  opacity = 1
}: {
  width?: number;
  height?: number;
  barCount?: number;
  color?: string;
  opacity?: number;
}) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const bars = generateBars(width, height, barCount);
  const barWidth = Math.max(2, (width - (barCount - 1) * 1.5) / barCount);
  const singleSetWidth = barCount * (barWidth + 1.5);

  useEffect(() => {
    // 128 BPM = 8 beats at 468.75ms each = 3750ms for full scroll
    Animated.loop(
      Animated.timing(scrollAnim, {
        toValue: 1,
        duration: 3750,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-singleSetWidth, 0],
  });

  return (
    <View style={{ width, height, overflow: 'hidden', opacity }}>
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height,
          transform: [{ translateX }],
        }}
      >
        {bars.map((bar, idx) => (
          <View
            key={idx}
            style={{
              width: bar.width,
              height: bar.height,
              backgroundColor: color,
              borderRadius: 1,
              marginRight: 1.5,
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
};

export default function IDentifiedLogo({ size = 'medium' }: IDentifiedLogoProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  const sizeConfig = {
    small: { fontSize: 18, waveWidth: 36, waveHeight: 16, containerWidth: 42, containerHeight: 26 },
    medium: { fontSize: 22, waveWidth: 44, waveHeight: 20, containerWidth: 50, containerHeight: 32 },
    large: { fontSize: 28, waveWidth: 52, waveHeight: 24, containerWidth: 58, containerHeight: 38 },
  }[size];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.logoWrapper}>
        <View style={[styles.idWaveContainer, { width: sizeConfig.containerWidth, height: sizeConfig.containerHeight }]}>
          <Animated.View style={[styles.idGlowBg, {
            opacity: glowAnim,
            width: sizeConfig.containerWidth - 6,
            height: sizeConfig.containerHeight - 6,
          }]} />

          <View style={[styles.waveformBehind, { top: (sizeConfig.containerHeight - sizeConfig.waveHeight) / 2 }]}>
            <AnimatedWaveform
              width={sizeConfig.waveWidth}
              height={sizeConfig.waveHeight}
              barCount={10}
              color={Colors.dark.primary}
              opacity={0.4}
            />
          </View>

          <Text style={[styles.idText, { fontSize: sizeConfig.fontSize }]}>ID</Text>
        </View>

        <Text style={[styles.entifiedText, { fontSize: sizeConfig.fontSize }]}>entified</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  idWaveContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginRight: 2,
  },
  idGlowBg: {
    position: 'absolute',
    backgroundColor: Colors.dark.primary,
    borderRadius: 6,
  },
  waveformBehind: {
    position: 'absolute',
    left: 3,
    zIndex: 1,
  },
  idText: {
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    zIndex: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  entifiedText: {
    fontWeight: '700',
    color: Colors.dark.text,
    letterSpacing: -0.5,
  },
});
