import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { Disc3 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface AnimatedLogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
  onPress?: () => void;
}

export default function AnimatedLogo({ 
  size = 'medium', 
  showTagline = false,
  onPress,
}: AnimatedLogoProps) {
  const [isScanning, setIsScanning] = useState(true);
  
  // Animations
  const ringRotation = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;
  const idPulse = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const scanLinePos = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;

  // Ring rotation animation
  useEffect(() => {
    const rotation = Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotation.start();
    return () => rotation.stop();
  }, []);

  // Ring pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.2, duration: 1500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.6, duration: 1500, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // ID text pulse
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(idPulse, { toValue: 1.1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(idPulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Wave animation for scan effect
  useEffect(() => {
    const wave = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    wave.start();
    return () => wave.stop();
  }, []);

  // Scan line animation
  useEffect(() => {
    const scan = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLinePos, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLinePos, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    scan.start();
    return () => scan.stop();
  }, []);

  // Glow animation
  useEffect(() => {
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.7, duration: 1000, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    );
    glow.start();
    return () => glow.stop();
  }, []);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsScanning(prev => !prev);
    onPress?.();
  };

  const ringRotate = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const scanLineTranslate = scanLinePos.interpolate({
    inputRange: [0, 1],
    outputRange: [-15, 15],
  });

  const waveScale = waveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.3, 1],
  });

  const waveOpacity = waveAnim.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0.8, 0.4, 0.2, 0.8],
  });

  // Size configurations
  const sizeConfig = {
    small: { container: 32, ring: 28, icon: 14, fontSize: 16, idSize: 18 },
    medium: { container: 44, ring: 38, icon: 18, fontSize: 20, idSize: 24 },
    large: { container: 64, ring: 56, icon: 24, fontSize: 28, idSize: 34 },
  }[size];

  return (
    <Pressable onPress={handlePress} style={styles.wrapper}>
      <View style={styles.logoContainer}>
        {/* Scanning Ring Container */}
        <View style={[styles.ringContainer, { width: sizeConfig.container, height: sizeConfig.container }]}>
          {/* Outer glow */}
          <Animated.View 
            style={[
              styles.outerGlow,
              {
                width: sizeConfig.ring + 16,
                height: sizeConfig.ring + 16,
                borderRadius: (sizeConfig.ring + 16) / 2,
                opacity: glowOpacity,
              }
            ]}
          />
          
          {/* Wave rings */}
          <Animated.View 
            style={[
              styles.waveRing,
              {
                width: sizeConfig.ring,
                height: sizeConfig.ring,
                borderRadius: sizeConfig.ring / 2,
                transform: [{ scale: waveScale }],
                opacity: waveOpacity,
              }
            ]}
          />
          
          {/* Rotating ring with dashes */}
          <Animated.View 
            style={[
              styles.scanningRing,
              {
                width: sizeConfig.ring,
                height: sizeConfig.ring,
                borderRadius: sizeConfig.ring / 2,
                transform: [{ rotate: ringRotate }, { scale: ringScale }],
                opacity: ringOpacity,
              }
            ]}
          >
            {/* Ring segments */}
            <View style={[styles.ringSegment, styles.ringSegment1, { borderRadius: sizeConfig.ring / 2 }]} />
            <View style={[styles.ringSegment, styles.ringSegment2, { borderRadius: sizeConfig.ring / 2 }]} />
          </Animated.View>

          {/* Center icon */}
          <View style={[styles.iconCenter, { width: sizeConfig.ring - 8, height: sizeConfig.ring - 8, borderRadius: (sizeConfig.ring - 8) / 2 }]}>
            <Disc3 size={sizeConfig.icon} color={Colors.dark.primary} />
            
            {/* Scan line overlay */}
            <Animated.View 
              style={[
                styles.scanLine,
                {
                  transform: [{ translateY: scanLineTranslate }],
                }
              ]}
            />
          </View>
        </View>

        {/* Logo Text */}
        <View style={styles.textContainer}>
          <Animated.Text 
            style={[
              styles.idText,
              { fontSize: sizeConfig.idSize, transform: [{ scale: idPulse }] }
            ]}
          >
            ID
          </Animated.Text>
          <Text style={[styles.entifiedText, { fontSize: sizeConfig.fontSize }]}>
            entified
          </Text>
        </View>
      </View>

      {showTagline && (
        <Text style={styles.tagline}>Track every beat</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'flex-start',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ringContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  outerGlow: {
    position: 'absolute',
    backgroundColor: Colors.dark.primary,
  },
  waveRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  scanningRing: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringSegment: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ringSegment1: {
    borderTopColor: Colors.dark.primary,
    borderRightColor: Colors.dark.primary,
    transform: [{ rotate: '0deg' }],
  },
  ringSegment2: {
    borderBottomColor: Colors.dark.primaryLight,
    borderLeftColor: Colors.dark.primaryLight,
    transform: [{ rotate: '180deg' }],
  },
  iconCenter: {
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    width: '120%',
    height: 2,
    backgroundColor: Colors.dark.primary,
    opacity: 0.6,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  idText: {
    fontWeight: '900',
    color: Colors.dark.primary,
    letterSpacing: -0.5,
  },
  entifiedText: {
    fontWeight: '700',
    color: Colors.dark.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 2,
    marginLeft: 52,
    letterSpacing: 0.5,
  },
});
