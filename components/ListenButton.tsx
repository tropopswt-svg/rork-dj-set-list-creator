import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Mic } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface ListenButtonProps {
  isListening: boolean;
  onPress: () => void;
}

export default function ListenButton({ isListening, onPress }: ListenButtonProps) {
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const pulseAnim3 = useRef(new Animated.Value(1)).current;
  const opacityAnim1 = useRef(new Animated.Value(0.6)).current;
  const opacityAnim2 = useRef(new Animated.Value(0.4)).current;
  const opacityAnim3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    if (isListening) {
      const createPulse = (scaleAnim: Animated.Value, opacityAnim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(scaleAnim, {
                toValue: 2.2,
                duration: 1500,
                useNativeDriver: true,
              }),
              Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 1500,
                useNativeDriver: true,
              }),
            ]),
            Animated.parallel([
              Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 0,
                useNativeDriver: true,
              }),
              Animated.timing(opacityAnim, {
                toValue: 0.6,
                duration: 0,
                useNativeDriver: true,
              }),
            ]),
          ])
        );
      };

      const pulse1 = createPulse(pulseAnim1, opacityAnim1, 0);
      const pulse2 = createPulse(pulseAnim2, opacityAnim2, 500);
      const pulse3 = createPulse(pulseAnim3, opacityAnim3, 1000);

      pulse1.start();
      pulse2.start();
      pulse3.start();

      return () => {
        pulse1.stop();
        pulse2.stop();
        pulse3.stop();
      };
    } else {
      pulseAnim1.setValue(1);
      pulseAnim2.setValue(1);
      pulseAnim3.setValue(1);
      opacityAnim1.setValue(0.6);
      opacityAnim2.setValue(0.4);
      opacityAnim3.setValue(0.2);
    }
  }, [isListening]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onPress();
  };

  return (
    <View style={styles.container}>
      {isListening && (
        <>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim1 }],
                opacity: opacityAnim1,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim2 }],
                opacity: opacityAnim2,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim3 }],
                opacity: opacityAnim3,
              },
            ]}
          />
        </>
      )}
      <Pressable
        style={[styles.button, isListening && styles.buttonActive]}
        onPress={handlePress}
      >
        <Mic size={40} color={Colors.dark.text} />
      </Pressable>
      <Text style={styles.label}>
        {isListening ? 'Listening...' : 'Tap to identify'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 280,
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.dark.primary,
  },
  button: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonActive: {
    backgroundColor: Colors.dark.primaryDark,
  },
  label: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    marginTop: 24,
    fontWeight: '500' as const,
  },
});
