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
  const waveAnim = useRef(new Animated.Value(0)).current;
  const scanLinePos = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  
  // ID Scanning animations
  const idScanLine = useRef(new Animated.Value(0)).current;
  const idGlow = useRef(new Animated.Value(0.4)).current;
  const idScannerBar = useRef(new Animated.Value(0)).current;

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

  // ID Scanner bar animation - sweeps horizontally across ID text
  useEffect(() => {
    const scan = Animated.loop(
      Animated.sequence([
        Animated.timing(idScannerBar, { 
          toValue: 1, 
          duration: 1000, 
          easing: Easing.inOut(Easing.ease), 
          useNativeDriver: true 
        }),
        Animated.delay(200),
        Animated.timing(idScannerBar, { 
          toValue: 0, 
          duration: 1000, 
          easing: Easing.inOut(Easing.ease), 
          useNativeDriver: true 
        }),
        Animated.delay(400),
      ])
    );
    scan.start();
    return () => scan.stop();
  }, []);

  // ID Glow pulse - pulses when scanner bar passes
  useEffect(() => {
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(idGlow, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(idGlow, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.delay(1400),
      ])
    );
    glow.start();
    return () => glow.stop();
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
    small: { container: 32, ring: 28, icon: 14, fontSize: 16, idSize: 18, scanBarWidth: 36, scanBarHeight: 22 },
    medium: { container: 44, ring: 38, icon: 18, fontSize: 20, idSize: 24, scanBarWidth: 48, scanBarHeight: 28 },
    large: { container: 64, ring: 56, icon: 24, fontSize: 28, idSize: 34, scanBarWidth: 68, scanBarHeight: 40 },
  }[size];

  // ID scanner bar translation
  const idScannerTranslate = idScannerBar.interpolate({
    inputRange: [0, 1],
    outputRange: [-sizeConfig.scanBarWidth, sizeConfig.scanBarWidth],
  });

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

        {/* Logo Text with ID Scanner Effect */}
        <View style={styles.textContainer}>
          {/* ID text with scanning effect */}
          <View style={[styles.idScanContainer, { width: sizeConfig.scanBarWidth, height: sizeConfig.scanBarHeight }]}>
            {/* Glow background behind ID */}
            <Animated.View 
              style={[
                styles.idGlowBackground,
                { 
                  opacity: idGlow,
                  width: sizeConfig.scanBarWidth - 4,
                  height: sizeConfig.scanBarHeight - 4,
                  borderRadius: 6,
                }
              ]} 
            />
            
            {/* Scanner corners - top left */}
            <View style={[styles.scannerCorner, styles.scannerCornerTL]} />
            {/* Scanner corners - top right */}
            <View style={[styles.scannerCorner, styles.scannerCornerTR]} />
            {/* Scanner corners - bottom left */}
            <View style={[styles.scannerCorner, styles.scannerCornerBL]} />
            {/* Scanner corners - bottom right */}
            <View style={[styles.scannerCorner, styles.scannerCornerBR]} />
            
            {/* The ID text */}
            <Text style={[styles.idText, { fontSize: sizeConfig.idSize }]}>
              ID
            </Text>
            
            {/* Scanning bar overlay */}
            <Animated.View 
              style={[
                styles.idScanBar,
                {
                  height: sizeConfig.scanBarHeight + 4,
                  transform: [{ translateX: idScannerTranslate }],
                }
              ]}
            />
          </View>
          
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
    alignItems: 'center',
  },
  // ID Scanner container with corner brackets
  idScanContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  idGlowBackground: {
    position: 'absolute',
    backgroundColor: Colors.dark.primary,
  },
  // Scanner corner brackets
  scannerCorner: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderColor: Colors.dark.primary,
    borderWidth: 2,
  },
  scannerCornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 3,
  },
  scannerCornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 3,
  },
  scannerCornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
  },
  scannerCornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 3,
  },
  idText: {
    fontWeight: '900',
    color: Colors.dark.primary,
    letterSpacing: -0.5,
    zIndex: 1,
  },
  // Scanning bar that sweeps across ID
  idScanBar: {
    position: 'absolute',
    width: 3,
    backgroundColor: Colors.dark.primary,
    opacity: 0.8,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  entifiedText: {
    fontWeight: '700',
    color: Colors.dark.text,
    letterSpacing: -0.5,
    marginLeft: 2,
  },
  tagline: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 2,
    marginLeft: 52,
    letterSpacing: 0.5,
  },
});
