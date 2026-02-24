import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BubbleGlassLogoProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
}

const SIZE_MAP = {
  small: 28,
  medium: 46,
  large: 56,
  xlarge: 70,
};

export default function BubbleGlassLogo({ size = 'medium' }: BubbleGlassLogoProps) {
  const px = SIZE_MAP[size];

  return (
    <View style={styles.row}>
      {/* Glass letter body — translucent red with crisp edge */}
      <Text style={[
        styles.glassText,
        { fontSize: px, lineHeight: px * 1.2 },
      ]}>
        trak<Text style={styles.glassTextD}>d</Text>
      </Text>
      {/* Single top-edge shine — like light catching glass */}
      <Text style={[
        styles.glassShine,
        { fontSize: px, lineHeight: px * 1.2 },
      ]}>
        trak<Text style={{ color: 'rgba(255, 255, 255, 0.35)' }}>d</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
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
