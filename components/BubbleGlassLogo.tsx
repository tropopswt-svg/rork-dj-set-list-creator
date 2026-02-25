import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

interface BubbleGlassLogoProps {
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge';
  loading?: boolean;
}

const SIZE_MAP = {
  tiny: 16,
  small: 28,
  medium: 46,
  large: 56,
  xlarge: 70,
};

const LETTERS = ['t', 'r', 'a', 'k', 'd'];

export default function BubbleGlassLogo({ size = 'medium', loading = false }: BubbleGlassLogoProps) {
  const px = SIZE_MAP[size];
  const anims = useRef(LETTERS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!loading) {
      anims.forEach(a => a.setValue(0));
      return;
    }

    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 100),
          Animated.timing(anim, {
            toValue: 1,
            duration: 350,
            easing: Easing.out(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 350,
            easing: Easing.in(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.delay((LETTERS.length - 1 - i) * 100),
        ])
      )
    );

    const composite = Animated.parallel(animations);
    composite.start();
    return () => composite.stop();
  }, [loading]);

  // Static version — original render
  if (!loading) {
    return (
      <View style={styles.row}>
        <Text style={[
          styles.glassText,
          { fontSize: px, lineHeight: px * 1.2 },
        ]}>
          trak<Text style={styles.glassTextD}>d</Text>
        </Text>
        <Text style={[
          styles.glassShine,
          { fontSize: px, lineHeight: px * 1.2 },
        ]}>
          trak<Text style={{ color: 'rgba(255, 255, 255, 0.35)' }}>d</Text>
        </Text>
      </View>
    );
  }

  // Animated wavy version
  const lift = px * 0.15;

  return (
    <View style={styles.row}>
      <View style={styles.lettersRow}>
        {LETTERS.map((letter, i) => {
          const translateY = anims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0, -lift],
          });
          const isD = letter === 'd';
          return (
            <Animated.Text
              key={i}
              style={[
                styles.glassText,
                isD && styles.glassTextD,
                {
                  fontSize: px,
                  lineHeight: px * 1.4,
                  transform: [{ translateY }],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  glassText: {
    fontWeight: '900',
    letterSpacing: -0.5,
    color: 'rgba(196, 30, 58, 0.7)',
    textShadowColor: 'rgba(120, 15, 30, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  glassTextD: {
    color: 'rgba(196, 30, 58, 0.85)',
  },
  glassShine: {
    position: 'absolute',
    top: -1,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: 'rgba(255, 255, 255, 0.25)',
  },
});
