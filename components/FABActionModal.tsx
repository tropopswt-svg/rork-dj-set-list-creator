import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Plus, Radio, X, ListMusic, Disc3 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const { width } = Dimensions.get('window');

interface FABActionModalProps {
  visible: boolean;
  onClose: () => void;
  onAddSet: () => void;
  onIdentify: () => void;
  onRecordSet?: () => void;
}

export default function FABActionModal({
  visible,
  onClose,
  onAddSet,
  onIdentify,
  onRecordSet,
}: FABActionModalProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim1 = useRef(new Animated.Value(0)).current;
  const scaleAnim2 = useRef(new Animated.Value(0)).current;
  const scaleAnim3 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      slideAnim.setValue(300);
      fadeAnim.setValue(0);
      scaleAnim1.setValue(0);
      scaleAnim2.setValue(0);
      scaleAnim3.setValue(0);

      // Animate in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 10,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Staggered button animations
      Animated.sequence([
        Animated.delay(100),
        Animated.spring(scaleAnim1, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();

      Animated.sequence([
        Animated.delay(200),
        Animated.spring(scaleAnim2, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();

      Animated.sequence([
        Animated.delay(300),
        Animated.spring(scaleAnim3, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();

      // Pulse animation for the identify button
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
    }
  }, [visible]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleAddSet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddSet();
  };

  const handleIdentify = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onIdentify();
  };

  const handleRecordSet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRecordSet?.();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={styles.overlayPressable} onPress={handleClose}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>

        <Animated.View
          style={[
            styles.content,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Close button */}
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <X size={24} color={Colors.dark.textSecondary} />
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>What would you like to do?</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            {/* Identify Track - The big, exciting option */}
            <Animated.View
              style={[
                styles.identifyButtonWrapper,
                {
                  transform: [{ scale: Animated.multiply(scaleAnim1, pulseAnim) }],
                },
              ]}
            >
              <Pressable style={styles.identifyButton} onPress={handleIdentify}>
                <View style={styles.identifyIconContainer}>
                  <View style={styles.identifyPulseRing} />
                  <View style={styles.identifyPulseRing2} />
                  <Radio size={48} color="#fff" strokeWidth={2} />
                </View>
                <Text style={styles.identifyText}>Identify Track</Text>
                <Text style={styles.identifySubtext}>
                  Listen to any track playing nearby
                </Text>
              </Pressable>
            </Animated.View>

            {/* Record a Set - Secondary option */}
            <Animated.View
              style={[
                styles.addSetButtonWrapper,
                { transform: [{ scale: scaleAnim2 }] },
              ]}
            >
              <Pressable style={styles.addSetButton} onPress={handleRecordSet}>
                <View style={[styles.addSetIconContainer, styles.recordSetIconContainer]}>
                  <Disc3 size={28} color={Colors.dark.primary} />
                </View>
                <View style={styles.addSetTextContainer}>
                  <Text style={styles.addSetText}>Record a Set</Text>
                  <Text style={styles.addSetSubtext}>
                    Auto-ID every track at a live set
                  </Text>
                </View>
              </Pressable>
            </Animated.View>

            {/* Add Set - Tertiary option */}
            <Animated.View
              style={[
                styles.addSetButtonWrapper,
                { transform: [{ scale: scaleAnim3 }] },
              ]}
            >
              <Pressable style={styles.addSetButton} onPress={handleAddSet}>
                <View style={styles.addSetIconContainer}>
                  <ListMusic size={28} color={Colors.dark.primary} />
                </View>
                <View style={styles.addSetTextContainer}>
                  <Text style={styles.addSetText}>Add a Set</Text>
                  <Text style={styles.addSetSubtext}>
                    Import from YouTube or SoundCloud
                  </Text>
                </View>
                <Plus size={20} color={Colors.dark.textMuted} />
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  actions: {
    gap: 16,
  },
  identifyButtonWrapper: {
    alignItems: 'center',
  },
  identifyButton: {
    width: width - 48,
    backgroundColor: Colors.dark.primary,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  identifyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  identifyPulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  identifyPulseRing2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  identifyText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  identifySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  addSetButtonWrapper: {
    alignItems: 'center',
  },
  addSetButton: {
    width: width - 48,
    backgroundColor: Colors.dark.background,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  addSetIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  recordSetIconContainer: {
    backgroundColor: 'rgba(196, 30, 58, 0.1)',
  },
  addSetTextContainer: {
    flex: 1,
  },
  addSetText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  addSetSubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
});
